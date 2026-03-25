# AI Bot / Voice Agent / Channel Orchestration — Code Review

**Date:** 2026-03-25
**Reviewer:** Claude Opus 4.6 (automated security-first review)
**Scope:** All edge functions, frontend hooks, contract validators, and handoff compliance

---

## 1. High-Risk Issues (Blocking)

### 1.1 Prompt Assembler Contains Dead Variable `{{known_lead_name}}`

**File:** `src/features/voice-agent/lib/prompt-assembler.ts:58`
**Severity:** Blocking (per handoff)

The `buildDynamicVariablesSection()` function still lists `{{known_lead_name}}` as a dynamic variable:

```typescript
- {{known_lead_name}} — confirmed name if recognized
```

Per the standard-chat-bot handoff (`commissiontracker-voice-prompt-handoff.md`), this variable is dead — it was removed from the backend and replaced by `{{lead_name}}`. The Retell LLM will render it literally as `{{known_lead_name}}` in conversations, which is embarrassing and confusing for callers.

**Fix:** Remove line 58 from `prompt-assembler.ts`.

### 1.2 Prompt Assembler Missing Three New Dynamic Variables

**File:** `src/features/voice-agent/lib/prompt-assembler.ts:48-71`
**Severity:** Blocking (per handoff)

The `buildDynamicVariablesSection()` function is missing three variables that the backend now passes to Retell on both inbound and outbound calls:

| Variable | Purpose | Status |
|---|---|---|
| `{{lead_state}}` | Lead's US state (e.g. FL, TX) | **Missing** |
| `{{greeting}}` | Voice clone suggested opening | **Missing** |
| `{{persona}}` | Voice clone persona style | **Missing** |

Without these in the prompt's dynamic variables documentation, the LLM may not use them effectively even though they're injected at runtime.

**Fix:** Add these three variables to `buildDynamicVariablesSection()` between the existing entries.

### 1.3 `chat-bot-provision` Has No Timeout on External API Calls

**File:** `supabase/functions/chat-bot-provision/index.ts:50`
**Severity:** Blocking

The `callChatBotApi()` helper in `chat-bot-provision` uses raw `fetch()` without an `AbortController` or timeout:

```typescript
const res = await fetch(url, options); // Line 50 — no timeout, no AbortController
```

This function is called by Stripe webhooks. If `standard-chat-bot` is slow or unresponsive, the fetch hangs indefinitely, which:
- Blocks Stripe webhook processing (Stripe retries after 30s, creating duplicate events)
- Exhausts Supabase edge function execution limits
- Could cascade into provisioning race conditions

**Compare with** `chat-bot-api/index.ts:119-131` which correctly uses `AbortController` with 15s timeout.

**Fix:** Add `AbortController` with 30s timeout (longer than chat-bot-api's 15s since provisioning may be slower).

### 1.4 Error Message Leakage in Global Catch Block

**File:** `supabase/functions/chat-bot-api/index.ts:2967-2970`
**Severity:** High

The global catch block returns the raw error message to the client:

```typescript
return jsonResponse(
  { error: "Internal server error", message },  // `message` = err.message
  safeStatus(500),
);
```

Where `message` is `err instanceof Error ? err.message : String(err)`. This could leak:
- Internal API URLs (`CHAT_BOT_API_URL or CHAT_BOT_API_KEY not configured`)
- Stack traces from Deno runtime errors
- Database error messages from Supabase

Note: The specific `CHAT_BOT_API_URL or CHAT_BOT_API_KEY not configured` case IS handled separately (lines 2953-2964), but other errors still leak via the generic catch.

**Fix:** Replace line 2968 with `{ error: "Internal server error" }` — omit the `message` field in production.

### ~~1.5 Inbound Rules Dual-System Split~~ — DOWNGRADED (Not a real bug)

**Status:** Downgraded after investigating `standard-chat-bot` backend.

Both `PATCH /agents/:id` (general config via `update_config`) and `PATCH /agents/:id/voice/rules/inbound` (rules endpoint via `update_voice_inbound_rules`) write to the **exact same DB columns** in a single `agents` table. The inbound webhook reads from those same columns. There is no separate rules subdocument or collection.

**Field mapping (both endpoints → same columns):**
| Config field (update_config) | Rules field (update_voice_inbound_rules) | DB column |
|---|---|---|
| `voiceEnabled` | `enabled` | `voiceEnabled` |
| `afterHoursInboundEnabled` | `afterHoursEnabled` | `afterHoursInboundEnabled` |
| `afterHoursStartTime` | `afterHoursStartTime` | `afterHoursStartTime` |
| `afterHoursEndTime` | `afterHoursEndTime` | `afterHoursEndTime` |
| `afterHoursTimezone` | `afterHoursTimezone` | `afterHoursTimezone` |
| `voiceTransferNumber` | `transferNumber` | `voiceTransferNumber` |
| (not in BOT_CONFIG_ALLOWED_KEYS) | `allowedLeadStatuses` | `voiceInboundAllowedStatuses` |

The current split (RuntimeCard saves most fields via `update_config`, CallRulesCard saves `allowedLeadStatuses` via `update_voice_inbound_rules`) is functionally correct. However, `allowedLeadStatuses` for inbound can ONLY be set via the rules endpoint since `voiceInboundAllowedStatuses` is not in `BOT_CONFIG_ALLOWED_KEYS`. This is fine — `VoiceCallRulesCard` handles it.

### 1.6 `general_inbound` Workflow Preset Key Never Matches Runtime Value

**Files:**
- `src/features/voice-agent/lib/prompt-wizard-presets.ts:177`
- `src/features/voice-agent/lib/prompt-assembler.ts:258`

**Severity:** High

The workflow preset uses key `"general_inbound"`:
```typescript
{ key: "general_inbound", label: "General Inbound (no specific scenario)", ... }
```

This produces `### general_inbound` as a markdown heading in the assembled prompt. The LLM's Task section says "Determine the workflow from `{{workflow_type}}`" and matches against these headings. However, the backend **never** sends `workflow_type: 'general_inbound'` — inbound calls always get `after_hours_inbound`, and the default/fallback case sends no value at all. So this workflow guidance section is dead code in the prompt.

**Fix:** Rename the key from `"general_inbound"` to `"default"` in `prompt-wizard-presets.ts`. Update the Task section in `prompt-assembler.ts:215` to clarify: "If `{{workflow_type}}` is empty or missing, use the Default workflow."

---

## 2. Medium-Risk Issues (Should Fix)

### 2.1 CORS Inconsistency Across Edge Functions

**chat-bot-api** (line 30-38): Custom 7-origin allowlist including `https://app.thestandardhq.com`, validated dynamically:
```
https://app.thestandardhq.com, https://www.thestandardhq.com, https://thestandardhq.com,
http://localhost:3000, http://localhost:3001, http://127.0.0.1:3000, http://127.0.0.1:3001
```

**`_shared/cors.ts`** (line 4-9): Different 5-origin allowlist, includes `localhost:5173` but **missing `https://app.thestandardhq.com`**:
```
https://www.thestandardhq.com, https://thestandardhq.com,
http://localhost:5173, http://localhost:3000, http://localhost:3001
```

**All other edge functions** (chat-bot-provision, send-sms, bot-collective-analytics, manage-subscription-items): Use `"Access-Control-Allow-Origin": "*"` wildcard.

The wildcard on `manage-subscription-items` is concerning — it handles Stripe subscription mutations with user JWT auth. While the JWT provides server-side auth, CORS `*` allows any origin to make credentialed requests.

**Risk:** An attacker's page could call `manage-subscription-items` from any origin if the user has an active session.

### 2.2 `send-sms` Returns HTTP 200 on Twilio Errors

**File:** `supabase/functions/send-sms/index.ts`
**Severity:** Medium

The function returns HTTP 200 even when Twilio rejects the message (e.g., invalid number, blacklisted). The `success: false` is in the body, but:
- Monitoring/alerting tools keyed on HTTP status codes will miss failures
- Frontend error handlers that check `response.ok` will think it succeeded
- SMS delivery failures become invisible at the infrastructure level

### 2.3 `send-sms` Has No Timeout on Twilio API Calls

**File:** `supabase/functions/send-sms/index.ts`
**Severity:** Medium

Same pattern as `chat-bot-provision` — raw `fetch()` to Twilio without `AbortController`. If Twilio is slow, the edge function hangs.

### 2.4 `bot-collective-analytics` Has No Timeout on External API Call

**File:** `supabase/functions/bot-collective-analytics/index.ts:61-66`
**Severity:** Medium (lower — public function with graceful fallback)

The external API call has no timeout. However, the try/catch at line 72 does gracefully fall back to DB-only metrics, so the impact is limited to slow responses rather than hangs.

### 2.5 `send-sms` Allows Any Authenticated User to SMS Any Number

**File:** `supabase/functions/send-sms/index.ts`
**Severity:** Medium

Any user with a valid JWT can send SMS to any phone number via this function. There's no authorization check linking the `to` number to data the user owns. This could be abused for:
- SMS spam from authenticated accounts
- Social engineering (sending messages from the platform's Twilio number)

The function does validate the request body shape (line 194: rejects unknown keys), but doesn't verify the user has a relationship to the recipient.

### 2.6 Verbose Debug Logging Left in Production

**File:** `supabase/functions/chat-bot-api/index.ts:2165-2174`

The `get_analytics` action logs raw API response data to server logs:
```typescript
console.log("[get_analytics] raw res.data:", JSON.stringify(res.data).slice(0, 500));
console.log("[get_analytics] unwrapped payload:", JSON.stringify(payload).slice(0, 500));
```

While these are server-side logs (not returned to client), they add noise to production logs and could log sensitive analytics data to Railway/Supabase log aggregation.

### 2.7 Race Condition in `ensureAgentContext` Auto-Provisioning

**File:** `supabase/functions/chat-bot-api/index.ts:287-389`
**Severity:** Low-Medium (mitigated by DB constraint)

Two concurrent requests for a new user could both pass the `existingAgent` check (line 292-298), both attempt to provision, and both call `POST /api/external/agents`. The `upsert` with `onConflict: "user_id"` (line 369) prevents duplicate DB rows, but:
- The external API may create two agents for the same `externalRef`
- The second upsert overwrites the first agent's `external_agent_id`
- This leaves an orphaned agent in standard-chat-bot

Mitigated by: The external API likely deduplicates by `externalRef`, but this should be confirmed.

### 2.8 Orchestration Rule Payloads Pass Through Unvalidated

**File:** `supabase/functions/chat-bot-api/index.ts:2502-2557`

The `update_orchestration_ruleset`, `create_orchestration_rule`, and `update_orchestration_rule` actions pass user-supplied `conditions`, `action`, and `patch` objects directly to standard-chat-bot without proxy-layer validation:

```typescript
case "update_orchestration_rule": {
  const { ruleId, patch } = params;
  // ... patch passed directly as Record<string, unknown>
}
```

All validation is delegated to the backend. If the backend has a validation gap, arbitrary data could be stored in rules.

**Mitigation:** This is acceptable IF standard-chat-bot validates all fields. Documenting as a known design choice.

---

## 3. Low-Risk / Quality Improvements

### 3.1 `apply_orchestration_template` Defaults to `mode: "replace"`

**File:** `supabase/functions/chat-bot-api/index.ts:2637`

```typescript
{ mode: mode || "replace" }
```

When `mode` is not specified, all existing custom rules are replaced. The frontend should confirm before sending this. Not a bug, but a footgun.

### 3.2 `jsonResponse` at Line 66 Uses Module-Level CORS Headers

The `jsonResponse` helper at line 65-70 uses the pre-built `corsHeaders` (line 62) which calls `buildCorsHeaders()` with no request, defaulting to `"*"`. This means error responses that use `jsonResponse` outside the request handler (e.g., 405 at line 552-555) may return `*` even in production. Inside the try block, `reqCorsHeaders` with the actual origin is used.

### 3.3 Calendly Debug Logging

Lines 1599-1624 have extensive debug logging for the `get_calendly_auth_url` action. Should be cleaned up.

---

## 4. Security & Agent Isolation Analysis

### Agent Ownership Enforcement: PASS

- `ensureAgentContext()` (line 292-298) always filters by `.eq("user_id", userId)` — verified
- Auto-provisioning gated to exactly `connect_close` and `create_voice_agent` (line 1195) — verified
- `get_voice_setup_state` runs before agent lookup with `allowAutoProvision = false` (line 1141) — verified

### Super-Admin Impersonation: PASS

- `targetUserId` requires `is_super_admin === true` from DB profile (line 632) — verified
- Each admin action independently re-checks admin status (lines 646-651, 772-776, 801-806) — verified
- `admin_list_agents` fetches ALL agents without user filter (correct for admin view) — verified

### Service-Role Gate: PASS

- `chat-bot-provision` uses exact string comparison `token !== SUPABASE_SERVICE_ROLE_KEY` (line 78) — verified
- No timing-safe comparison needed since Deno's string comparison is already constant-time for equal-length strings, and the attacker doesn't have partial key feedback

### API Key Security: PASS

- `X-API-Key` header is set from env vars only (lines 114, 158) — verified
- No user JWT forwarded to standard-chat-bot — verified
- `SUPABASE_SERVICE_ROLE_KEY` never appears in response bodies — verified (grep confirms only in env reads + auth checks)
- The error message at line 2954 does include "CHAT_BOT_API_URL or CHAT_BOT_API_KEY not configured" — but this only reveals env var names, not values

### Billing Bypass Prevention: PASS

- `BOT_CONFIG_ALLOWED_KEYS` (voice-agent-contract.ts:15-52) does NOT contain `billingExempt`, `leadLimit`, or `isActive` — verified
- `parseUpdateConfigParams()` (line 380-389) enforces the allowlist — verified
- `update_config` action (line 1384-1392) calls `parseUpdateConfigParams()` — verified

### Exploit Paths Evaluated

| Attack Vector | Status | Details |
|---|---|---|
| Billing bypass via `update_config` | Blocked | Allowlist rejects `billingExempt`, `leadLimit`, `isActive` |
| Unauthorized agent access | Blocked | `ensureAgentContext` filters by `user_id` |
| Cross-tenant voice clone | Blocked | Clone operations go through `ensureAgentContext` → agent-scoped URLs |
| Service-role key exfiltration | Blocked | Key never in response bodies |
| API key leakage | Minor risk | Error messages could leak env var names (not values) |
| Provisioning abuse | Controlled | Auto-provision limited to 2 actions + upsert dedup |
| CORS bypass | Partial risk | `manage-subscription-items` uses `*` wildcard |
| Multipart injection | Blocked | Only reads `file`, `segmentIndex`, `durationSeconds` fields |

---

## 5. Data Integrity & Migration Review

### Schema Status

No schema changes are pending in this review. Current bot tables:
- `chat_bot_agents` — RLS enforced, `user_id` UNIQUE constraint, `billing_exempt` column added 2026-03-07
- `chat_bot_team_overrides` — RLS enforced, `user_id` UNIQUE
- `bot_policy_attributions` — RLS enforced, `policy_id` UNIQUE (one attribution per policy)
- `user_subscription_addons` — Voice sync columns tracked (7 fields)

### Policy Ownership Verification: PASS

The `link_attribution` action (line 2425-2433) correctly verifies policy ownership:
```typescript
const { data: linkPolicy } = await supabase.from("policies").select("user_id").eq("id", policyId).single();
if (!linkPolicy || linkPolicy.user_id !== effectiveUserId) {
  return jsonResponse({ error: "Forbidden" }, 403);
}
```

The `unlink_attribution` action (line 2463-2467) correctly filters by both `attributionId` AND `user_id`:
```typescript
.delete().eq("id", attributionId).eq("user_id", effectiveUserId)
```

---

## 6. External API Contract & Proxy Review

### Proxy Boundary: PASS

Edge functions correctly act as proxies only:
- `callChatBotApi()` sends `X-API-Key` header, 15s timeout, AbortController cleanup — verified
- `callChatBotApiMultipart()` sends `X-API-Key`, 60s timeout, no `Content-Type` override — verified
- No business logic in proxy layer (exception: billing/entitlement checks using Supabase data, which is correct)

### Response Envelope Unwrapping: PASS

`unwrap()` (lines 396-429):
- Extracts `data.data` when envelope present, falls back to `data` — correct
- 5xx errors sanitized to "Bot service temporarily unavailable" — correct
- Non-5xx error messages forwarded from backend — acceptable (backend controls message content)

### Error Classification: PASS

`safeStatus()` converts 5xx to 400 to prevent Supabase runtime 502 — correct and necessary.

### `notProvisioned` Convention: PASS

404 from `ensureAgentContext` returns HTTP 200 with `{ notProvisioned: true }` body (line 1218-1226) — correct, prevents browser network panel noise.

### Timeout Coverage

| Function | Timeout | Status |
|---|---|---|
| `chat-bot-api` JSON | 15s | PASS |
| `chat-bot-api` multipart | 60s | PASS |
| `_shared/standard-chat-bot-voice.ts` | 10s (configurable) | PASS |
| `chat-bot-provision` | None | **FAIL** |
| `send-sms` (Twilio) | None | **FAIL** |
| `bot-collective-analytics` | None | FAIL (mitigated by try/catch fallback) |
| `manage-subscription-items` (provision call) | None | **FAIL** — line 216-230 calls `chat-bot-provision` without timeout |

---

## 7. React Query & Frontend Data Flow

### Cache Key Completeness: PASS

- `chatBotKeys` factory includes all filter parameters (conversations include `params`, messages include `conversationId` + `params`)
- `orchestrationKeys` factory includes `params` for paginated queries (voiceSessions)
- Admin keys include `userId` for multi-user isolation

### Polling Guards: PASS

All polling uses conditional `refetchInterval`:
- Voice setup state: polls 5s only when `shouldPollVoiceSetupState()` returns true — correct
- Voice clone session: polls 3s only when `status === "processing"` — correct
- Voice clone status: polls 5s only when `inProgressCloneId` exists — correct
- Monitoring: polls 30s but stops when data is null — correct

### Invalidation Logic: PASS

- `invalidateVoiceAgentQueries()` cancels queries before invalidating (prevents stale overwrites) — verified
- Voice clone mutations correctly invalidate `voiceCloneSession(cloneId)` + `voiceCloneStatus()` — verified
- Orchestration mutations invalidate `orchestrationKeys.ruleset()` — verified

### Retry Logic: PASS

All bot hooks use conditional retry:
- `isTransportError` → no retry (network failure, don't spam)
- `isNotProvisioned` → no retry (expected state for new users)
- `isServiceError` → 1 retry max (temporary unavailability)

### Error Handling: PASS

`ChatBotApiError` class correctly classifies:
- Transport errors (network failures)
- Service errors (5xx, service down)
- Not-provisioned (404, no active bot)
- Business errors (validation, etc.)

---

## 8. Voice Clone & Retell Review

### Voice Clone Lifecycle: PASS

- `start_voice_clone` (line 1992-2004): `consentAccepted` coerced from string/boolean — correct
- `upload_voice_clone_segment` (line 2006-2052):
  - 50MB size check at proxy layer (line 2025) — correct
  - FormData field ordering (text before file for fastify) — correct
  - Only reads `file`, `segmentIndex`, `durationSeconds` — correct
- `cancel_voice_clone` (line 2098-2116): POST fallback to DELETE — correct for backward compat
- `clone_id` validation on all clone actions — verified (non-empty check)
- `delete_voice_clone_segment` validates both `clone_id` AND `segment_index` — verified

### Retell Allowlist Enforcement: PASS

- `update_retell_agent` (line 1469-1477) calls `parseRetellAgentUpdateParams()` which enforces `RETELL_AGENT_PATCH_KEY_SET` — verified
- `update_retell_llm` (line 1497-1505) calls `parseRetellLlmUpdateParams()` which enforces `RETELL_LLM_PATCH_KEY_SET` — verified
- `add_retell_voice` (line 1459-1467) calls `parseAddRetellVoiceParams()` with provider validation — verified
- `search_retell_voices` (line 1449-1457) calls `parseRetellSearchParams()` — verified

### Voice Clone Polling: PASS

`useVoiceCloneSession` (useChatBotVoiceClone.ts:266-269):
```typescript
refetchInterval: (query) => {
  if (query.state.data?.status === "processing") return 3_000;
  return false;
},
```

Polling only active during `processing` state — correct.

### Multipart Upload: PASS

Frontend `chatBotApiMultipart()` (useChatBotVoiceClone.ts:80-161):
- Uses Supabase edge function invoke with `FormData` body
- No manual `Content-Type` header (lets browser set multipart boundary)
- Error classification matches JSON API helper

---

## 9. Orchestration Review

### Rule Ordering: PASS (Delegated)

Rule evaluation happens server-side in standard-chat-bot. The edge function only proxies — correct.

### Template Application

`apply_orchestration_template` (line 2629-2640):
- Defaults to `mode: "replace"` (line 2637) — documented in low-risk section
- Frontend `useApplyTemplate()` should confirm before replacing

### Post-Call Config: PASS

`get_post_call_config` and `update_post_call_config` are clean proxies — no validation needed at proxy layer since the backend defines valid config shapes.

### Voice Rules & Guardrails: PASS

- `update_voice_inbound_rules` (line 2820-2848): Extracts named fields, passes to correct endpoint — verified
- `update_voice_outbound_rules` (line 2851-2873): Same pattern — verified
- `update_voice_guardrails` (line 2875-2898): Uses inline allowlist of 11 keys — verified

### Inbound Voice + Orchestration: CORRECT

Per the handoff, inbound voice does NOT interact with orchestration rules. Confirmed: no orchestration check in the inbound code path. This is by design — customer-initiated calls must never be blocked by outbound cooldown rules.

---

## 10. Billing & Entitlement Review

### Voice Trial Activation: PASS

`start_voice_trial` (lines 980-1128):
- Atomic upsert with `onConflict: "user_id,addon_id", ignoreDuplicates: true` — prevents duplicate trials
- Returns `200` with `success: true, trial: true` if already activated (line 1024-1031) — correct idempotency
- Trial quota: 15 included minutes, 15 hard limit — correctly set from constants
- Voice entitlement sync uses idempotency key: `voice-trial-${effectiveUserId}-${timestamp}` — correct

### Team Exemption Hierarchy: PASS

`getTeamAccessStatus()` (lines 486-542):
- Super admin → always exempt (line 508-510) — correct
- Explicit override → exempt (line 513-521) — correct
- Upline hierarchy → checks `chat_bot_agents` for `billing_exempt=true AND provisioning_status=active` (lines 530-536) — correct
- Empty upline → not exempt (line 526-528) — correct

### `afterHoursInbound` Feature Flag: ALREADY HANDLED

`DEFAULT_VOICE_FEATURES` at `voice-sync.ts:129-134`:
```typescript
export const DEFAULT_VOICE_FEATURES: VoiceFeatureFlags = {
  missedAppointment: true,
  reschedule: true,
  quotedFollowup: false,
  afterHoursInbound: true,  // ← Enabled by default
};
```

Used in both trial activation (chat-bot-api line 1066) and Stripe webhook sync (voice-sync.ts line 242). Handoff item #3 is already satisfied.

### Entitlement Sync: PASS

Voice entitlement upsert uses `createStandardChatBotVoiceClient()` with:
- 10s timeout (configurable via `STANDARD_CHAT_BOT_TIMEOUT_MS`)
- `X-Idempotency-Key` header
- Proper AbortController cleanup in `finally` block

---

## 11. Test Coverage Gaps

### Existing Tests (8 files, all passing for bot ecosystem)

| Test File | Coverage |
|---|---|
| `voice-agent-contract.test.ts` | Parser functions, unknown key rejection |
| `retell-studio.test.ts` | Retell studio logic |
| `voice-agent-helpers.test.ts` | Snapshot parsing, sanitization |
| `prompt-assembler.test.ts` | Prompt assembly from wizard data |
| `connection-state.test.ts` | Connection state logic |
| `response-schedule.test.ts` | Business hours logic |
| `get-agent-contract.test.ts` | Response shape validation |
| `voice-sync.test.ts` | Entitlement payload building |

### Missing Tests (Blocking)

| Gap | Priority | Why |
|---|---|---|
| `BOT_CONFIG_ALLOWED_KEYS` rejects `billingExempt`, `leadLimit`, `isActive` | **Critical** | Security regression test — if someone adds these keys to the allowlist, tests should catch it |
| `ChatBotApiError` classification logic | High | Core error handling — transport vs service vs not-provisioned |
| Edge function action routing (integration) | High | No coverage of the 80+ action switch-case |
| Channel orchestration feature | High | **Zero tests** in `src/features/channel-orchestration/` |
| `retell-config.ts` allowlists | Medium | No test verifying `RETELL_AGENT_EDITABLE_KEYS` or `RETELL_LLM_EDITABLE_KEYS` don't include dangerous fields |
| CORS enforcement | Medium | No test for origin validation logic |
| `ensureAgentContext` user isolation | Medium | No test proving wrong `user_id` returns 404 |
| Multipart upload error handling | Low | Edge case coverage for malformed FormData |

### Pre-Existing Test Failures

57 test failures exist across 16 test files — these are unrelated to the bot ecosystem (e.g., `userService.test.ts` has a snake_case mismatch). Bot ecosystem tests pass.

---

## 12. Final Verdict

### **Approve with Required Changes**

The AI bot ecosystem demonstrates strong security fundamentals:
- Agent isolation via `ensureAgentContext` is correctly enforced
- Billing bypass prevention via `BOT_CONFIG_ALLOWED_KEYS` is solid
- Proxy boundary is clean — edge functions proxy, standard-chat-bot decides
- React Query layer has proper polling guards, error classification, and cache invalidation
- Voice clone lifecycle is correctly guarded with consent, size limits, and field ordering

**Required changes before merge/deploy:**

1. **Remove `{{known_lead_name}}` from prompt assembler** (line 58) — dead variable, will render literally in conversations
2. **Add `{{lead_state}}`, `{{greeting}}`, `{{persona}}` to prompt assembler** — backend passes them but prompt doesn't document them
3. **Add timeout to `chat-bot-provision`** — external API calls can hang indefinitely, blocking Stripe webhooks
4. **Remove `message` field from global error catch** (line 2968) — prevents internal error leakage to clients
5. **Rename `general_inbound` workflow preset to `default`** — the current key never matches any runtime `workflow_type` value, making the workflow guidance dead code

**Should fix (not blocking):**
- Unify CORS across edge functions (especially `manage-subscription-items` wildcard)
- Add timeouts to `send-sms` Twilio calls
- Clean up debug logging in `get_analytics` and `get_calendly_auth_url`
- Add security regression tests for `BOT_CONFIG_ALLOWED_KEYS`

---

## Handoff Compliance Summary

| # | Handoff Item | Status | Action Needed |
|---|---|---|---|
| 1 | `inbound_webhook_url` on phone creation | Done (backend) | None — verify after deploy |
| 2 | Inbound rules UI | **Partially done — DUAL SYSTEM BUG** | UI exists across 2 cards but saves to wrong endpoint. `VoiceAgentRuntimeCard` saves 5 fields to `update_config` (agent PATCH) instead of `update_voice_inbound_rules` (rules PATCH). Only `allowedLeadStatuses` goes to the correct rules endpoint via `VoiceCallRulesCard`. Must consolidate all 7 fields to `update_voice_inbound_rules`. |
| 3 | `afterHoursInbound: true` in entitlement | **Done** | `DEFAULT_VOICE_FEATURES` already sets it |
| 4 | Update voice prompt variables | **Not done** | Remove `known_lead_name`, add `lead_state`/`greeting`/`persona` in `prompt-assembler.ts` |
| 5 | Setup page driven by `setup-state` | **Done** | `get_voice_setup_state` action + `useChatBotVoiceSetupState()` hook already in place |
