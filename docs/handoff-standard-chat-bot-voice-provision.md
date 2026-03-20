# Handoff: Voice-Only Agent Flow — Full Review

## Status

Trial activation (`start_voice_trial`) works at the DB level. The `user_subscription_addons`
row gets created. But the UI doesn't update after activation, and the `connect_close` flow
fails because workspace provisioning returns 422.

There are bugs in **both** projects. This document covers both.

---

## Part 1: Bugs in commissionTracker (THIS project)

### Bug 1: `invalidateVoiceAgentQueries` doesn't invalidate `voiceSetupState`

**File:** `/Users/nickneessen/projects/commissionTracker/src/features/chat-bot/hooks/useChatBot.ts`
**Line:** ~465

```typescript
function invalidateVoiceAgentQueries(queryClient: QueryClient) {
  void queryClient.cancelQueries({
    queryKey: chatBotKeys.voiceSetupState(), // ← CANCELS but never INVALIDATES
  });
  void queryClient.invalidateQueries({ queryKey: chatBotKeys.agent() });
  void queryClient.invalidateQueries({ queryKey: chatBotKeys.voiceEntitlement() });
  void queryClient.invalidateQueries({ queryKey: chatBotKeys.voiceUsage() });
}
```

**Problem:** After trial activation, `voiceSetupState` cache is stale. The cancel prevents
in-flight requests but doesn't trigger a refetch. The page continues using the old cached
`readiness.entitlementActive: false`.

**Fix:** Add `invalidateQueries` for `voiceSetupState` after the cancel:
```typescript
void queryClient.cancelQueries({ queryKey: chatBotKeys.voiceSetupState() });
void queryClient.invalidateQueries({ queryKey: chatBotKeys.voiceSetupState() });
```

### Bug 2: `useStartVoiceTrial.onSuccess` invalidates wrong query key for addons

**File:** `/Users/nickneessen/projects/commissionTracker/src/features/chat-bot/hooks/useChatBot.ts`
**Line:** ~1048

```typescript
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
  void queryClient.invalidateQueries({ queryKey: ["user-addons"] });  // ← WRONG KEY
  invalidateVoiceAgentQueries(queryClient);
},
```

**Problem:** `useUserActiveAddons` uses query key `["subscription", "activeAddons", userId]`
(defined in `userAddonKeys`). The invalidation key `["user-addons"]` matches nothing.
`["subscriptions"]` also doesn't match `["subscription"]` (missing the "s").

**Fix:** Use the actual key prefixes:
```typescript
void queryClient.invalidateQueries({ queryKey: ["subscription"] });
```
This matches both `subscriptionKeys.all` and `userAddonKeys.activeAddons(...)` since
`userAddonKeys` extends `subscriptionKeys.all`.

### Bug 3: `voiceAccessActive` doesn't check addon status directly

**File:** `/Users/nickneessen/projects/commissionTracker/src/features/voice-agent/VoiceAgentPage.tsx`
**Line:** ~608

```typescript
const voiceAccessActive =
  voiceSetupState?.readiness?.entitlementActive ??
  isVoiceAccessActive(voiceEntitlement?.status ?? voiceSnapshot?.status);
```

**Problem:** Three failure modes:
1. `voiceSetupState?.readiness?.entitlementActive` is `false` (not undefined) from stale
   cache → `??` doesn't fall through
2. `voiceEntitlement` only loads when `activeTab === "stats"` → null on Subscription tab
3. `voiceSnapshot` is null because trial activation without an agent skips the entitlement
   sync, leaving `voice_entitlement_snapshot: null`

**Fix:** Add a direct addon status check as final fallback:
```typescript
const voiceAccessActive =
  voiceSetupState?.readiness?.entitlementActive ??
  isVoiceAccessActive(voiceEntitlement?.status ?? voiceSnapshot?.status) ||
  voiceAddon?.status === "active";
```

### Bug 4: Synthetic `get_voice_setup_state` needs to check addon status properly

**File:** `/Users/nickneessen/projects/commissionTracker/supabase/functions/chat-bot-api/index.ts`

The synthetic response for `get_voice_setup_state` when no agent exists does:
```typescript
readiness: { entitlementActive: !!voiceAddon }
```

But the voiceAddon lookup uses a nested subquery that may fail silently. The check should
also verify `voiceAddon.status === "active"`.

---

## Part 2: Bugs in standard-chat-bot (OTHER project)

### Bug 5: `POST /api/external/agents` requires `leadLimit` for non-exempt users

**Endpoint:** `POST /api/external/agents`

**Current behavior:** Returns 422 with:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION",
    "message": "Invalid input",
    "details": {
      "fieldErrors": {
        "leadLimit": ["leadLimit is required when billingExempt is not true"]
      }
    }
  }
}
```

**Payload sent by commissionTracker:**
```json
{
  "externalRef": "<supabase-user-uuid>",
  "name": "Nick Neessen",
  "billingExempt": false,
  "leadLimit": 5
}
```

The `leadLimit: 5` workaround was added but voice-only users shouldn't need an SMS lead
limit at all. The provision endpoint should either:
- Accept `leadLimit: 0` for voice-only workspaces
- Make `leadLimit` optional with a default
- Accept a `voiceOnly: true` flag that bypasses the leadLimit requirement

### How to test the provision endpoint

```bash
# From the commissionTracker project root:
source .env

# Test with current workaround (leadLimit: 5)
curl -s -X POST "${CHAT_BOT_API_URL}/api/external/agents" \
  -H "X-API-Key: ${CHAT_BOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"externalRef": "test-uuid", "name": "Test", "billingExempt": false, "leadLimit": 5}'

# Test what voice-only should look like (currently fails)
curl -s -X POST "${CHAT_BOT_API_URL}/api/external/agents" \
  -H "X-API-Key: ${CHAT_BOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"externalRef": "test-uuid-2", "name": "Test", "billingExempt": false, "leadLimit": 0}'
```

### Full voice-only flow (all calls to standard-chat-bot)

1. **Provision workspace:**
   `POST /api/external/agents` with `{ externalRef, name, billingExempt, leadLimit }`
   Returns `{ success: true, data: { agentId } }`

2. **Connect Close CRM:**
   `POST /api/external/agents/{agentId}/connections/close` with `{ apiKey }`

3. **Create voice agent:**
   `POST /api/external/agents/{agentId}/voice/agent/create` with `{ templateKey }`

4. **Get setup state:**
   `GET /api/external/agents/{agentId}/voice/setup-state`

5. **Sync voice entitlement:**
   Uses `createStandardChatBotVoiceClient().upsertVoiceEntitlement(agentId, ...)`
   (defined in `/Users/nickneessen/projects/commissionTracker/supabase/functions/_shared/standard-chat-bot-voice.ts`)

### Files to review in standard-chat-bot

- The external agents router — handles `POST /api/external/agents` (provision)
- The Zod validation schema for the provision endpoint — where `leadLimit` is required
- The Close CRM connection handler — `POST /api/external/agents/:agentId/connections/close`
- The voice agent create handler — `POST /api/external/agents/:agentId/voice/agent/create`
- The voice setup state handler — `GET /api/external/agents/:agentId/voice/setup-state`

---

## Part 3: Fix order

1. Fix bugs 1-3 in commissionTracker (query invalidation + voiceAccessActive fallback)
2. Fix bug 5 in standard-chat-bot (make leadLimit optional or accept 0)
3. Restart edge functions, test full flow:
   - Start trial → page updates to show "Active" + connect Close CRM card
   - Connect Close CRM → auto-provisions workspace + connects
   - Create Voice Agent → agent created, Setup tab unlocks
