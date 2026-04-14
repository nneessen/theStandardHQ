# API Contract Accuracy Audit — commissionTracker ↔ standard-chat-bot

You are performing a **line-by-line contract accuracy audit** between the commissionTracker frontend/edge-function layer and the standard-chat-bot external API.

Your job is to find **every mismatch** between what commissionTracker sends/expects and what standard-chat-bot actually accepts/returns. This includes wrong field names, missing fields, wrong types, stale response interfaces, incorrect URL paths, wrong HTTP methods, missing error handling, and unhandled edge cases.

---

## How To Execute This Audit

### Step 1: Read the API source of truth

Read every external API route file in the standard-chat-bot project. These define what the server **actually** accepts and returns:

```
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/agents.ts
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/connections.ts
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/conversations.ts
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/appointments.ts
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/usage.ts
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/analytics.ts
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/monitoring.ts
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/orchestration.ts
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/retell.ts
/Users/nickneessen/projects/standard-chat-bot/apps/api/src/routes/external/voice.ts
```

Also read the Zod validation schemas (these define the exact request/response contracts):

```
/Users/nickneessen/projects/standard-chat-bot/packages/shared/src/schemas/external-api.ts
/Users/nickneessen/projects/standard-chat-bot/packages/shared/src/schemas/voice.ts
/Users/nickneessen/projects/standard-chat-bot/packages/shared/src/schemas/orchestration.ts
/Users/nickneessen/projects/standard-chat-bot/packages/shared/src/constants.ts
```

### Step 2: Read the commissionTracker consumers

These files consume the API. Read every one fully:

**Edge function proxy (translates frontend actions → API calls):**
```
supabase/functions/chat-bot-api/index.ts          (~80 action cases)
supabase/functions/chat-bot-provision/index.ts     (4 actions)
supabase/functions/_shared/standard-chat-bot-voice.ts  (voice entitlement client)
```

**Frontend hooks (consume edge function responses):**
```
src/features/chat-bot/hooks/useChatBot.ts              (23 queries, 20 mutations)
src/features/chat-bot/hooks/useChatBotVoiceClone.ts    (2 queries, 8 mutations)
src/features/channel-orchestration/hooks/useOrchestration.ts  (9 queries, 13 mutations)
src/features/voice-agent/hooks/useAudioRecorder.ts     (MediaRecorder hook)
```

**TypeScript interfaces (define expected response shapes):**
```
src/features/chat-bot/types/admin.types.ts
src/features/channel-orchestration/types/orchestration.types.ts
```

**Contract validation (allowlists and parsers):**
```
src/features/voice-agent/lib/voice-agent-contract.ts
src/features/voice-agent/lib/retell-config.ts
```

### Step 3: Compare each action end-to-end

For **every action** in the `chat-bot-api` switch-case router, trace the full data flow:

```
Frontend hook (sends action + params)
  → Edge function (constructs HTTP request to standard-chat-bot)
    → Standard-chat-bot route handler (validates request, returns response)
  ← Edge function (unwraps response, transforms data)
← Frontend hook (parses response into TypeScript interface)
```

At each boundary, check:

1. **Request accuracy:**
   - Does the edge function construct the correct URL path?
   - Does the edge function use the correct HTTP method?
   - Does the request body include all required fields?
   - Does the request body use the correct field names (camelCase vs snake_case)?
   - Are query params properly encoded?
   - Are optional fields handled correctly (omitted vs null vs undefined)?

2. **Response accuracy:**
   - Does the frontend TypeScript interface match the actual response shape?
   - Are all returned fields represented in the interface?
   - Are field types correct (string vs number, nullable vs optional)?
   - Does the edge function's unwrapping/transformation preserve all fields?
   - Are new fields from recent API changes missing from the frontend interface?
   - Are deprecated/removed fields still referenced in the frontend?

3. **Error handling accuracy:**
   - Are all possible HTTP status codes handled?
   - Are error messages properly extracted and surfaced?
   - Is `isNotProvisioned` correctly set for 404 responses?
   - Is `isServiceError` correctly set for 5xx responses?
   - Is `isTransportError` correctly set for network failures?
   - Are retries appropriate (no retry on 4xx, conditional on 5xx/transport)?

---

## What Constitutes a Finding

### BLOCKING (will cause runtime errors or data loss)

- Frontend interface has a field that doesn't exist in the API response → runtime `undefined` access
- Edge function sends a request body field the API doesn't accept → 422 validation error
- Edge function constructs the wrong URL path → 404 in production
- Edge function uses wrong HTTP method (e.g., POST instead of PATCH) → 405
- Frontend expects `data.items` but API returns `data.conversations` → UI shows empty
- Type mismatch: frontend expects `number` but API returns `string` → comparison/display bugs
- Missing required field in request body → 422 in production
- Edge function doesn't handle a status code the API actually returns (e.g., 409) → unhandled error

### HIGH (will cause incorrect behavior or silent data loss)

- Field name mismatch between what the edge function sends and what the API expects (e.g., `apiKey` vs `api_key`)
- Response transformation drops fields that the frontend interface expects
- Pagination response shape mismatch (e.g., `totalItems` vs `total`)
- Date format mismatch (ISO string vs Unix timestamp)
- Boolean coercion issues (string `"true"` vs boolean `true`)
- Enum value mismatch (e.g., frontend expects `"replace"` but API accepts `"merge"` not `"replace"`)
- Missing `X-Idempotency-Key` header on endpoints that require it
- Query param not forwarded (e.g., `status` filter on conversations)

### MEDIUM (edge cases that may cause issues under specific conditions)

- Frontend interface has optional fields that the API always returns (unnecessary null checks)
- Frontend interface marks fields as required that the API sometimes omits
- staleTime or gcTime values that could cause stale data display
- Missing `enabled` guard on a query that fires before preconditions are met
- Polling runs when it shouldn't (e.g., `refetchInterval` not conditional on state)
- Query key missing a filter param (causes cache collisions)
- Mutation invalidates too many or too few query keys

### LOW (correctness improvements)

- TypeScript interface has `any` where a specific type exists in the API
- Missing JSDoc on complex response interfaces
- Unused interface fields (API no longer returns them but they're harmless)
- Inconsistent naming between hook and action (e.g., hook says `useCalendarHealth` but action is `get_calendar_health`)

---

## Specific Comparison Points Per Layer

### Edge Function → API URL Paths

For each action, verify the constructed URL matches the actual route:

| Action | Expected URL Pattern |
|--------|---------------------|
| `get_agent` | `GET /api/external/agents/:id` |
| `get_status` | `GET /api/external/agents/:id/status` |
| `update_config` | `PATCH /api/external/agents/:id` |
| `create_voice_agent` | `POST /api/external/agents/:id/voice/agent/create` |
| `connect_close` | `POST /api/external/agents/:id/connections/close` |
| `disconnect_close` | `DELETE /api/external/agents/:id/connections/close` |
| `get_close_status` | `GET /api/external/agents/:id/connections/close` |
| `get_close_lead_statuses` | `GET /api/external/agents/:id/lead-statuses` |
| `get_phone_numbers` | `GET /api/external/agents/:id/phone-numbers` |
| `get_close_lead_sources` | `GET /api/external/agents/:id/close/lead-sources` |
| `get_close_custom_fields` | `GET /api/external/agents/:id/close/custom-fields` |
| `get_close_smart_views` | `GET /api/external/agents/:id/close/smart-views` |
| `create_close_custom_field` | `POST /api/external/agents/:id/close/custom-fields/create` |
| `create_close_smart_view` | `POST /api/external/agents/:id/close/smart-views/create` |
| `refresh_close_metadata` | `POST /api/external/agents/:id/close/metadata/refresh` |
| `get_calendly_auth_url` | `GET /api/external/agents/:id/calendly/authorize` |
| `disconnect_calendly` | `DELETE /api/external/agents/:id/connections/calendly` |
| `get_calendly_status` | `GET /api/external/agents/:id/connections/calendly` |
| `get_calendly_event_types` | `GET /api/external/agents/:id/calendly/event-types` |
| `get_calendar_health` | `GET /api/external/agents/:id/calendar-health` |
| `get_google_auth_url` | `GET /api/external/agents/:id/google/authorize` |
| `get_google_status` | `GET /api/external/agents/:id/connections/google` |
| `disconnect_google` | `DELETE /api/external/agents/:id/connections/google` |
| `update_business_hours` | `PATCH /api/external/agents/:id` |
| `get_conversations` | `GET /api/external/agents/:id/conversations` |
| `get_messages` | `GET /api/external/agents/:id/conversations/:convId/messages` |
| `get_appointments` | `GET /api/external/agents/:id/appointments` |
| `get_usage` | `GET /api/external/agents/:id/usage` |
| `get_voice_entitlement` | `GET /api/external/agents/:id/voice-entitlement` |
| `get_voice_usage` | `GET /api/external/agents/:id/voice-usage` |
| `get_voice_clone_status` | `GET /api/external/agents/:id/voice/clone-status` |
| `get_voice_clone_scripts` | `GET /api/external/agents/:id/voice/clone/scripts` |
| `update_voice_clone_scripts` | `PUT /api/external/agents/:id/voice/clone/scripts` |
| `reset_voice_clone_scripts` | `DELETE /api/external/agents/:id/voice/clone/scripts` |
| `start_voice_clone` | `POST /api/external/agents/:id/voice/clone/start` |
| `upload_voice_clone_segment` | `POST /api/external/agents/:id/voice/clone/:cloneId/segments` |
| `get_voice_clone_session` | `GET /api/external/agents/:id/voice/clone/:cloneId` |
| `submit_voice_clone` | `POST /api/external/agents/:id/voice/clone/:cloneId/submit` |
| `activate_voice_clone` | `POST /api/external/agents/:id/voice/clone/:cloneId/activate` |
| `deactivate_voice_clone` | `POST /api/external/agents/:id/voice/clone/deactivate` |
| `cancel_voice_clone` | `POST /api/external/agents/:id/voice/clone/:cloneId/cancel` |
| `delete_voice_clone_segment` | `DELETE /api/external/agents/:id/voice/clone/:cloneId/segments/:idx` |
| `save_retell_connection` | `POST or PATCH /api/external/agents/:id/connections/retell` |
| `disconnect_retell_connection` | `DELETE /api/external/agents/:id/connections/retell` |
| `get_retell_runtime` | `GET /api/external/agents/:id/retell/runtime` |
| `get_retell_voices` | `GET /api/external/agents/:id/retell/voices` |
| `search_retell_voices` | `POST /api/external/agents/:id/retell/voices/search` |
| `add_retell_voice` | `POST /api/external/agents/:id/retell/voices/add` |
| `update_retell_agent` | `PATCH /api/external/agents/:id/retell/agent` |
| `publish_retell_agent` | `POST /api/external/agents/:id/retell/agent/publish` |
| `get_retell_llm` | `GET /api/external/agents/:id/retell/llm` |
| `update_retell_llm` | `PATCH /api/external/agents/:id/retell/llm` |
| `get_analytics` | `GET /api/external/agents/:id/analytics` |
| `get_monitoring` | `GET /api/external/agents/:id/monitoring` |
| `get_system_health` | `GET /api/external/monitoring/system` |
| `get_orchestration_ruleset` | `GET /api/external/agents/:id/orchestration` |
| `update_orchestration_ruleset` | `PUT /api/external/agents/:id/orchestration` |
| `patch_orchestration_ruleset` | `PATCH /api/external/agents/:id/orchestration` |
| `delete_orchestration_ruleset` | `DELETE /api/external/agents/:id/orchestration` |
| `create_orchestration_rule` | `POST /api/external/agents/:id/orchestration/rules` |
| `update_orchestration_rule` | `PATCH /api/external/agents/:id/orchestration/rules/:ruleId` |
| `delete_orchestration_rule` | `DELETE /api/external/agents/:id/orchestration/rules/:ruleId` |
| `toggle_orchestration_rule` | `PATCH /api/external/agents/:id/orchestration/rules/:ruleId/enabled` |
| `reorder_orchestration_rules` | `POST /api/external/agents/:id/orchestration/rules/reorder` |
| `get_orchestration_templates` | `GET /api/external/agents/:id/orchestration/templates` |
| `get_orchestration_template_preview` | `GET /api/external/agents/:id/orchestration/templates/:key/preview` |
| `apply_orchestration_template` | `POST /api/external/agents/:id/orchestration/templates/:key/apply` |
| `evaluate_orchestration` | `POST /api/external/agents/:id/orchestration/evaluate` |
| `get_post_call_config` | `GET /api/external/agents/:id/orchestration/post-call-config` |
| `update_post_call_config` | `PATCH /api/external/agents/:id/orchestration/post-call-config` |
| `get_voice_sessions` | `GET /api/external/agents/:id/voice-sessions` |
| `get_voice_session` | `GET /api/external/agents/:id/voice-sessions/:sessionId` |
| `manual_voice_writeback` | `POST /api/external/agents/:id/voice-sessions/:sessionId/writeback` |
| `update_voice_inbound_rules` | `PATCH /api/external/agents/:id/voice/rules/inbound` |
| `update_voice_outbound_rules` | `PATCH /api/external/agents/:id/voice/rules/outbound` |
| `update_voice_guardrails` | `PATCH /api/external/agents/:id/voice/guardrails` |
| `get_voice_setup_state` | `GET /api/external/agents/:id/voice/setup-state` |

### Edge Function Response Transformations

Several actions transform the API response before returning to the frontend. These are the highest-risk points for contract drift:

1. **`get_agent`** — Flattens nested agent object, reshapes connection objects, syncs billing exemption. Compare the flattened shape against `ChatBotAgent` interface.

2. **`get_appointments`** — Normalizes Calendly-style fields (snake_case → camelCase, status mapping). Compare normalized output against `ChatBotAppointment` interface.

3. **`get_conversations`** — Reshapes pagination from API `{ items, pagination }` to edge function `{ data, total, page, limit }`. Verify frontend expects the edge function's shape, not the API's shape.

4. **`get_messages`** — Same pagination reshaping as conversations.

5. **`get_usage`** — Renames fields: API returns `{ leadCount, leadLimit, periodStart, periodEnd }`, edge function returns `{ leadsUsed, leadLimit, periodStart, periodEnd, tierName }`. Verify `leadsUsed` vs `leadCount`.

6. **`get_voice_clone_status`** — Adds `cloneWizardUrl` field not present in API response. Verify frontend interface includes this field.

7. **`get_analytics`** — Falls back to empty analytics shell on error. Verify empty shell matches `ChatBotAnalytics` interface.

8. **`get_close_lead_sources`** — Normalizes to `{ sources: [{ id, label }] }`. API returns `{ sources: [{ value, configured }] }`. Verify frontend expects the edge function's normalized shape.

9. **`get_close_custom_fields`** — Normalizes to `{ fields: [{ key, name, type }] }`. API returns `{ fields: [{ id, label, key, type, acceptsMultipleValues }] }`. Verify field name mapping.

10. **`check_attribution`** — Combines API conversation search with local DB policy lookup. Complex multi-step operation — verify all intermediate shapes are correct.

### Frontend Interface Completeness

For each TypeScript interface in the hooks, check:

1. Are there fields in the API response that are **NOT** in the TypeScript interface? (Missing data — may be needed by new features)
2. Are there fields in the TypeScript interface that are **NOT** in the API response? (Will always be `undefined` — likely stale)
3. Are nullable vs optional correctly aligned? (API returns `null` but interface says `string` without `| null`)
4. Are new API fields from recent standard-chat-bot changes reflected? Cross-reference git log for recent schema changes.

### Validation Allowlist Drift

Compare these allowlists against the actual API validation:

1. **`BOT_CONFIG_ALLOWED_KEYS`** (in `voice-agent-contract.ts`) — every key must exist as a valid field in `updateExternalAgentSchema` (in standard-chat-bot). If the API added new updatable fields, the allowlist is stale.

2. **`RETELL_AGENT_EDITABLE_KEYS`** (in `retell-config.ts`) — every key must be a valid Retell agent field that the API's patch endpoint accepts. Cross-check against Retell's actual agent model.

3. **`RETELL_LLM_EDITABLE_KEYS`** (in `retell-config.ts`) — same as above for LLM fields.

---

## Edge Cases To Verify

For every hook, confirm these scenarios are handled:

### Network & Transport
- [ ] AbortController timeout fires (15s JSON, 60s multipart) — does the frontend show a meaningful error?
- [ ] Standard-chat-bot is completely down (ECONNREFUSED) — does `isTransportError` propagate correctly?
- [ ] Edge function returns 5xx (Supabase runtime crash) — does frontend distinguish from business error?

### Agent State
- [ ] Agent not provisioned (first-time user) — do queries return `null` gracefully without throwing?
- [ ] Agent in "failed" provisioning state — does `get_agent` handle the 404 → local status update correctly?
- [ ] Auto-provisioning race condition (two tabs call `connect_close` simultaneously) — is the upsert idempotent?

### Voice Clone
- [ ] Clone session in each state (recording, processing, ready, failed, active, archived) — does the UI handle all 6 states?
- [ ] `upload_voice_clone_segment` with 50 MB file — does the 60s timeout allow enough time?
- [ ] `cancel_voice_clone` POST → DELETE fallback — does the frontend handle both response shapes?
- [ ] `remainingAttempts === 0` — does the UI block new clone attempts?

### Orchestration
- [ ] No ruleset exists yet (first-time) — does `get_orchestration_ruleset` 404 return `null` not throw?
- [ ] `apply_orchestration_template` with `mode: "replace"` — does the edge function send `"replace"` or `"merge"`? (API accepts `"replace" | "merge"`, not `"replace" | "append"`)
- [ ] Rule `reorder` with stale `version` — is optimistic concurrency handled?
- [ ] `evaluate_orchestration` with missing optional fields — does the request body validation pass?

### Pagination
- [ ] API returns `{ items, pagination: { page, limit, totalItems, totalPages, hasNext, hasPrev } }` — does the edge function forward all pagination fields or only some?
- [ ] Frontend expects `{ data, total, page, limit }` — is the reshaping consistent across all paginated endpoints?
- [ ] Edge case: `totalItems === 0` — does the UI handle empty arrays correctly?

### Billing & Entitlement
- [ ] Voice entitlement upsert requires `X-Idempotency-Key` header — does `standard-chat-bot-voice.ts` send it?
- [ ] Voice entitlement cancel requires `X-Idempotency-Key` header — does the client send it?
- [ ] Billing-exempt agent with `leadLimit: null` — does the frontend handle null gracefully?

### Connections
- [ ] Calendly auth URL with `returnUrl` param — is the URL properly encoded?
- [ ] Google auth URL with `returnUrl` param — same check
- [ ] Close connection returns 502 (upstream error) — does the frontend show a meaningful error vs generic failure?
- [ ] Retell connection save (upsert pattern: GET → POST/PATCH) — if GET fails with non-404, does it error correctly?

---

## Output Format

Structure your findings as:

### 1. BLOCKING Issues (Runtime Errors / Data Loss)
For each issue:
- **File:** exact file path and line number
- **Action/Hook:** which action or hook is affected
- **What's wrong:** precise description of the mismatch
- **Expected (API):** what standard-chat-bot actually sends/expects
- **Actual (commissionTracker):** what commissionTracker sends/expects
- **Impact:** what breaks in production
- **Fix:** exact code change needed

### 2. HIGH Issues (Incorrect Behavior)
Same format as above.

### 3. MEDIUM Issues (Edge Cases)
Same format as above.

### 4. LOW Issues (Improvements)
Same format as above.

### 5. Allowlist Drift Report
For each allowlist:
- Keys in allowlist but NOT in API schema (dead keys)
- Keys in API schema but NOT in allowlist (missing keys — new features blocked)

### 6. Missing API Coverage
Actions that exist in standard-chat-bot's external API but have NO corresponding edge function action or frontend hook. These represent features that are available but not exposed to users.

### 7. Summary Statistics
- Total actions audited: N
- BLOCKING issues found: N
- HIGH issues found: N
- Contract accuracy percentage: N%

---

## Rules

- Do NOT guess. If you cannot determine the actual API response shape from reading the route handler code, say so and flag it.
- Do NOT skip actions because they "probably work." Check every one.
- Do NOT accept TypeScript `any` as "matches." It always masks potential mismatches.
- If a response interface has more than 3 fields of type `any`, flag the entire interface as needing proper typing.
- If you find a field name mismatch (e.g., `leadCount` vs `leadsUsed`), check whether the edge function renames it — if so, it's intentional. If not, it's a bug.
- Pay special attention to the **10 response transformations** listed above — these are where most bugs hide.
- Check the `apply_orchestration_template` mode values carefully — the API may accept `"replace" | "merge"` while the frontend sends `"replace" | "append"`. This is a known drift risk.
