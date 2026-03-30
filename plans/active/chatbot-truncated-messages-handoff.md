# Handoff: Truncated Message Content in standard-chat-bot

## Problem

Some messages displayed in the CommissionTracker chat bot conversation viewer show truncated content. Example: a human-sent SMS shows `"we have an"` instead of the full message text.

The issue is **not** in the CommissionTracker frontend or edge function. The external API (`/api/external/agents/:agentId/conversations/:convId/messages`) already returns the `content` field truncated. The data is incomplete at the source — the standard-chat-bot database.

---

## Evidence

### Truncated message (raw API response)

```json
{
  "id": "e9b14860-ae6e-481a-9dd4-2b25b1ae7b02",
  "conversationId": "aec8bfa1-7ece-4313-9bd9-0b1bfb13eca1",
  "direction": "outbound",
  "channel": "sms",
  "content": "we have an",           // <-- TRUNCATED
  "senderType": "human",
  "messageKind": "generic",
  "closeActivityId": "acti_7KYvlA0Ile754YcbHfkTiJeYmg55fbWnURukG0suBBz",
  "sourceActivityId": null,
  "createdAt": "2026-03-27T17:55:46.076Z"
}
```

### Key observations

| Field | Value | Significance |
|-------|-------|-------------|
| `senderType` | `"human"` | Not bot-generated — sent by a human agent |
| `direction` | `"outbound"` | Sent FROM the agent TO the lead |
| `closeActivityId` | `acti_7KYvlA0Ile754YcbHfkTiJeYmg55fbWnURukG0suBBz` | Has a Close activity ID — was synced from Close CRM |
| `sourceActivityId` | `null` | Not sourced from another activity |
| `promptVersion` | `null` | Not AI-generated |
| `modelName` | `null` | Not AI-generated |
| `messageKind` | `"generic"` | No special classification |

### Conversation context

- **Lead**: Kilvio Corniel (`+13476035515`)
- **Conversation ID**: `aec8bfa1-7ece-4313-9bd9-0b1bfb13eca1`
- **Close Lead ID**: `lead_DBIYfGHrTgapy8dDfwcL86y3sbtWLy6LPKPfCsaiHY1`
- **History sync completed**: `true`
- **History sync cursor**: `2026-03-27T17:55:38.995Z` (just before the truncated message at `17:55:46`)

---

## Likely Root Cause: History Sync from Close CRM

The standard-chat-bot syncs message history from Close CRM so the bot has context about prior conversations. The truncated message has a `closeActivityId` but no `sourceActivityId`, meaning it was **ingested from Close's SMS activity feed**.

### Where to investigate

1. **Close SMS Activity API response** — Verify the full content exists in Close:
   ```
   GET https://api.close.com/api/v1/activity/sms/acti_7KYvlA0Ile754YcbHfkTiJeYmg55fbWnURukG0suBBz
   ```
   Check the `text` field in the response. If Close returns the full text, the truncation happens during ingestion.

2. **History sync code** — The sync logic that pulls SMS activities from Close and creates messages in the bot's database. Look for:
   - Character limits on the `content` column (DB schema — is it `VARCHAR(N)` instead of `TEXT`?)
   - Truncation during field extraction (e.g., `text.substring(0, N)` or similar)
   - Close API pagination issues where multi-part responses get cut off
   - SMS body extraction — Close may return `text` or `body_text` or `body_html`; check which field is being read

3. **SMS segment reassembly** — Long SMS messages (>160 chars) are split into segments by carriers. If Close stores segments separately, the sync might only be grabbing the first segment. However, `"we have an"` is only 10 characters, so this is less likely unless the message was genuinely longer and got truncated elsewhere.

4. **Message creation/upsert logic** — When the bot creates a message record from a Close activity, check if there's an upsert that might overwrite full content with a partial update.

### Relevant conversation fields on the sync

```json
{
  "historySyncCursorAt": "2026-03-27T17:55:38.995Z",
  "historyFullSyncCompleted": true,
  "historySyncLastAttemptAt": "2026-03-27T17:55:40.705Z",
  "historySyncLastSuccessAt": "2026-03-27T17:55:40.872Z"
}
```

The cursor is at `17:55:38` and the truncated message was created at `17:55:46` — the message was created AFTER the last sync cursor. This could mean:
- The message was created by a **real-time webhook** (not the batch sync), and the webhook payload had truncated content
- OR the message was created during a subsequent sync cycle that isn't reflected in the cursor yet

---

## How to Verify

### Step 1: Check Close for full content
```bash
curl -s -u "YOUR_CLOSE_API_KEY:" \
  "https://api.close.com/api/v1/activity/sms/acti_7KYvlA0Ile754YcbHfkTiJeYmg55fbWnURukG0suBBz" | jq .text
```

If this returns the full message, truncation is in the bot's ingestion code.

### Step 2: Check the bot's DB directly
Query the messages table for this message ID and check the raw stored content:
```sql
SELECT id, content, LENGTH(content) as content_length
FROM messages
WHERE id = 'e9b14860-ae6e-481a-9dd4-2b25b1ae7b02';
```

Also check if the content column has a length constraint:
```sql
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'messages' AND column_name = 'content';
```

### Step 3: Check for other truncated messages
```sql
-- Find suspiciously short human messages that might be truncated
SELECT id, content, LENGTH(content) as len, "createdAt"
FROM messages
WHERE "senderType" = 'human'
  AND LENGTH(content) < 20
  AND content NOT IN ('Yes', 'No', 'Ok', 'Stop', 'Hi', 'Hello', 'Thanks', 'Sure', 'K', 'Y', 'N')
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Step 4: Search for the ingestion path
Look for where Close SMS activities get turned into message records. Search for:
- `closeActivityId` assignment
- Close API activity fetch + message creation
- Webhook handlers for Close activity events
- Any `text` → `content` field mapping

---

## What was fixed in CommissionTracker

While debugging, the following improvements were made to the edge function and frontend:

1. **Field normalization** — `get_messages` handler now normalizes external API fields (`content`/`text`/`body`, `createdAt`/`created_at`, etc.) so the frontend always gets consistent field names regardless of what the external API returns.

2. **Reduced redundant API calls** — Fixed an unstable `refetch` dependency in a `useEffect` that caused the conversations list to fire 4-5x per click. Now uses a `useRef` for stable reference. Also increased `staleTime` from 10s to 30s and refresh interval from 10s to 30s.

---

## Files in CommissionTracker that were changed

| File | Change |
|------|--------|
| `supabase/functions/chat-bot-api/index.ts` | Field normalization for `get_messages` handler |
| `src/features/chat-bot/components/ConversationsTab.tsx` | Stable refetch ref, 30s interval |
| `src/features/chat-bot/hooks/useChatBot.ts` | Conversations staleTime 10s → 30s |
