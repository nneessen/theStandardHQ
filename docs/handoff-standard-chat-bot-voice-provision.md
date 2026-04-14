# Handoff: Voice-Only Agent Flow — Full Review

## Status

Trial activation (`start_voice_trial`) works at the DB level. The `user_subscription_addons`
row gets created. But the UI doesn't update after activation, and the `connect_close` flow
fails because workspace provisioning returns 422.

There are bugs in **both** projects. This document covers both.

---

## Part 1: Bugs in commissionTracker (THIS project)

### Bug 1: `invalidateVoiceAgentQueries` doesn't invalidate `voiceSetupState`

**File:** `src/features/chat-bot/hooks/useChatBot.ts`
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

**File:** `src/features/chat-bot/hooks/useChatBot.ts`
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

**File:** `src/features/voice-agent/VoiceAgentPage.tsx`
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

**File:** `supabase/functions/chat-bot-api/index.ts`

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
   (defined in `supabase/functions/_shared/standard-chat-bot-voice.ts`)

### Files to review in standard-chat-bot

- The external agents router — handles `POST /api/external/agents` (provision)
- The Zod validation schema for the provision endpoint — where `leadLimit` is required
- The Close CRM connection handler — `POST /api/external/agents/:agentId/connections/close`
- The voice agent create handler — `POST /api/external/agents/:agentId/voice/agent/create`
- The voice setup state handler — `GET /api/external/agents/:agentId/voice/setup-state`

---

## Part 3: Default Voice Agent Prompt Template

### Problem

When `create_voice_agent` is called with `templateKey: "default_sales"`, the
Standard-ChatBot API generates a bare-bones default prompt:

```
You are the phone assistant for Nick Neessen. The business timezone is
America/New_York. Keep responses concise, natural, and practical. You may
help with appointment scheduling, appointment rescheduling, callback
collection, and after-hours triage. Do not provide quote details, policy
advice, underwriting guidance, eligibility decisions, or product
recommendations. When a request is ambiguous, high-risk, or needs a human,
offer a callback or transfer instead of improvising.
```

This is too restrictive. It bans ALL product discussion, which turns leads
away when they ask about mortgage protection, life insurance, IULs, etc.

### Required Changes in Standard-ChatBot

The `default_sales` template (or whatever template key the voice agent create
handler uses) should generate a prompt with these sections:

1. **Identity** — Uses `{{agent_name}}` and `{{company_name}}` variables
2. **Dynamic Variables** — Lists all runtime variables the voice system injects
3. **Style** — Concise, warm, one-question-at-a-time, natural tone
4. **Insurance Knowledge** — Agent CAN discuss products in general educational
   terms (mortgage protection, term life, IUL, final expense, the application
   process). This is critical — leads asking about products should get helpful
   answers, not refusals.
5. **Pricing Handling** — "Bridge" technique: acknowledge question warmly,
   explain rates are personalized (age, health, coverage amount), bridge to
   scheduling an appointment. NEVER quote specific numbers.
6. **Hard Limits** — No specific dollar amounts, no guarantees, no licensed
   advice, no competitor comparisons, no fabricated facts
7. **Task Flow** — Workflow-aware task steps with human handoff support
8. **Workflow-Specific Openings** — Per-workflow greeting guidance
   (missed_appointment, reschedule, after_hours_inbound, quoted_followup,
   general inbound)

### Full Template

The complete recommended template is in the commissionTracker project at:
`docs/reference/voice-agent-prompt-template.md`

Copy the content of that file as the `default_sales` template body in the
voice agent create handler. The template should be set as the `general_prompt`
field in the Retell LLM configuration when creating the voice agent.

### Where to find the voice agent create handler

Look for the route that handles:
`POST /api/external/agents/:agentId/voice/agent/create`

This handler receives `{ templateKey: "default_sales" }` and should:
1. Look up the template by key
2. Substitute agent-specific variables (agent name, company, timezone)
3. Set it as the `general_prompt` on the Retell LLM config
4. Set an appropriate `begin_message` (opening greeting)

### Recommended default `begin_message`

```
Hi, this is {{agent_name}}'s office. How can I help you today?
```

Keep it short — the workflow system will override this per-call with
context-specific openings.

---

## Part 4: Fix Order

### Already fixed in commissionTracker (bugs 1-3):
- [x] `invalidateVoiceAgentQueries` now invalidates `voiceSetupState`
- [x] `useStartVoiceTrial.onSuccess` uses correct query key `["subscription"]`
- [x] `voiceAccessActive` has addon status fallback

### Still needed in standard-chat-bot:
- [ ] Make `leadLimit` optional or accept 0 for voice-only workspaces
- [ ] Update `default_sales` template to use the comprehensive prompt
- [ ] Set appropriate default `begin_message`
