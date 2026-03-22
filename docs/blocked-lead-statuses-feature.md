# Blocked Lead Statuses — Chat Bot Feature

## Date: 2026-03-21

## What

Added a "Blocked Lead Statuses" configuration to the AI SMS chat bot's Audience tab. This allows users to select CRM lead statuses that act as a universal kill switch — the bot will not respond to leads with any of these statuses, for both inbound and outbound messages.

## Why

The standard-chat-bot backend API added a new `blockedLeadStatuses` field on agent objects. Previously, blocking was hardcoded on the backend and broke when CRM status labels changed. The new field is configurable per-agent and already live in production — this change adds the frontend UI to manage it.

## How It Differs from `allowedLeadStatuses`

| Field | Scope | Purpose |
|-------|-------|---------|
| `allowedLeadStatuses` | Outbound only | Controls which statuses trigger proactive outreach (intro SMS, drip campaigns). Bot still replies to inbound from any status. |
| `blockedLeadStatuses` | Inbound + Outbound | Universal kill switch. Bot will NOT respond at all — no inbound replies, no outbound automation. Overrides all other settings. |

These are intentionally separate arrays. A status can be in `allowedLeadStatuses` (eligible for outreach) but also in `blockedLeadStatuses` (blocked takes priority on the backend).

## API Contracts

### Read
```
GET /api/external/agents/:id
→ { "blockedLeadStatuses": ["Closed Won", "DNC", "Bad Number"] }
```

### Write
```
PATCH /api/external/agents/:id
Header: X-API-Key: <key>
Body: { "blockedLeadStatuses": ["Closed Won", "DNC"] }
```
Full array replacement (not a diff). Empty array `[]` clears all blocks.

### Available Statuses
```
GET /api/external/agents/:id/lead-statuses
→ { "success": true, "data": { "statuses": [{ "id": "...", "label": "..." }] } }
```
Same endpoint used by `allowedLeadStatuses` — reused via existing `useChatBotCloseLeadStatuses()` hook.

## Files Changed

| File | Change |
|------|--------|
| `src/features/voice-agent/lib/voice-agent-contract.ts` | Added `"blockedLeadStatuses"` to `BOT_CONFIG_ALLOWED_KEYS` — the edge function allowlist that gates which fields can be sent to the external API |
| `src/features/chat-bot/hooks/useChatBot.ts` | Added `blockedLeadStatuses?: string[]` to `ChatBotAgent` interface and `useUpdateBotConfig` mutation input type |
| `src/features/chat-bot/components/SetupTab.tsx` | Added blocked status state/handler/save, summary tile, and `BlockedLeadStatusSelector` section in Audience tab |
| `src/features/chat-bot/components/AdminTab.tsx` | Added `blockedLeadStatuses` `EditableList` for admin panel visibility |

## File Created

| File | Purpose |
|------|---------|
| `src/features/chat-bot/components/BlockedLeadStatusSelector.tsx` | Multi-select dropdown with search, removable chips, Close CRM disconnected state, and helper text |

## Data Flow

```
User selects statuses in BlockedLeadStatusSelector
  → SetupTab state (blockedStatuses, blockedDirty)
  → handleSaveBlockedStatuses()
  → useUpdateBotConfig().mutate({ blockedLeadStatuses: [...] })
  → chatBotApi("update_config", { blockedLeadStatuses: [...] })
  → Supabase edge function (chat-bot-api)
  → parseUpdateConfigParams() validates against BOT_CONFIG_ALLOWED_KEYS
  → PATCH /api/external/agents/:id with { blockedLeadStatuses: [...] }
```

## UI Behavior

- **Location**: Bot Config → Setup → Audience tab → third section card
- **Component**: Dropdown with search input + removable Badge chips
- **Empty state**: "No statuses blocked — bot will respond to all leads"
- **No CRM**: "Connect Close CRM to configure status filtering"
- **Save**: Dirty-flag pattern — Save button appears only after changes
- **Optimistic updates**: Leverages existing `useUpdateBotConfig` optimistic update + rollback
- **Admin tab**: Read/write via `EditableList` component (comma-separated)

## Edge Cases

- Status labels come from the user's Close CRM org (fully customizable)
- Matching is case-insensitive on the backend; labels stored as-is from dropdown
- Empty array = no blocking, bot responds to all leads
- Close CRM disconnected = selector disabled with connect prompt
