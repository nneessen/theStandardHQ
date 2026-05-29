# Continuation — Live Close CRM integration for Jarvis (command center)

**Created:** 2026-05-29
**Branch:** `feat/jarvis-data-correctness` (or a fresh branch off it / main once merged)
**Status:** NOT STARTED — this is a build plan/handoff.

---

## Goal

Give the Jarvis command-center assistant **live** Close CRM (close.com) capabilities for the
signed-in user: look up a lead and its real activity, search/triage leads and opportunities,
and (behind the existing approve gate) write back to Close — notes, tasks, email/SMS, sequence
enrollment.

Today Jarvis only sees the **synced lead-heat slice** (avg score + ranked hot-lead list from the
weekly scoring run). It has **no live Close API tool**. This plan adds that, read-first.

---

## Current state (verified 2026-05-29)

**How Close is connected — per-user, encrypted:**
- Table `close_config`: one row per `user_id` (UNIQUE), `api_key_encrypted TEXT`. RLS: a user
  reads/writes only their own row; service_role full access.
- Connect flow: `supabase/functions/chat-bot-api/index.ts` (~L1677–1759) encrypts the key
  (verifying against `https://api.close.com/api/v1/me/`) and upserts it.
- Retrieval: RPC `get_close_api_key(p_user_id uuid)` — **SECURITY DEFINER, service_role only**,
  returns the *encrypted* key; caller must `decrypt()` via `supabase/functions/_shared/encryption.ts`.
  There is an **agency-fallback** variant (migration `20260331142602_close_config_agency_fallback.sql`)
  — confirm whether to honor agency fallback for Jarvis or require the user's own key.
- Local dev only: `CLOSE_API_KEY` env honored when `ENVIRONMENT=local`.

**Existing Close API clients to REUSE (don't rewrite the HTTP layer):**
- `supabase/functions/close-lead-drop/close/client.ts`
- `supabase/functions/close-ai-builder/close/client.ts`
- Live-fetch reference functions: `close-kpi-data`, `close-lead-heat-score`, `close-ai-smart-view`,
  `get-team-call-stats` (all hit `https://api.close.com/api/v1`).
- Consider promoting a single Close client into `supabase/functions/_shared/close/` so the
  orchestrator and the existing functions share one implementation (rate-limit handling, retries).

**Synced data already in Postgres (no API call needed):** `lead_heat_scores`,
`lead_heat_agent_weights`, `lead_heat_outcomes`, `lead_heat_scoring_runs`,
`lead_heat_ai_portfolio_analysis`. Refreshed by `pg_cron` job `lead-heat-scoring` (Mon 11:00 UTC)
→ `close-lead-heat-score`.

**Orchestrator today:** `supabase/functions/assistant-orchestrator/`
- Runs with the **user JWT** (RLS-scoped); tools in `tools/*.ts`, registered in `tools/index.ts`.
- Close-origin data reaches it only via synced tables: `getLeadPriorities.ts`
  (`get_lead_priorities`) and `getDailyBriefingData.ts` (`avg_lead_heat_score`).
- Action/write lifecycle (for sends): `assistant_action_requests` table + draft→approve→execute
  state machine in `core/state-machine.ts`, executed by `supabase/functions/assistant-action-execute/index.ts`;
  server-side recipient authz via `assistant_recipient_is_allowed` + content-freeze on approval.

---

## Key architecture decision: how the orchestrator gets the Close key

The orchestrator is invoked with the **user's JWT**. `get_close_api_key` is **service_role only**
and returns an encrypted key. So:

1. The orchestrator edge function must hold a **service-role client** (server-side secret, never
   exposed to the browser) **solely** to call `get_close_api_key(ctx.userId)` and then `decrypt()`.
   - **CRITICAL:** only ever fetch the key for `ctx.userId` (the verified caller from the JWT).
     Never accept a user id from the model/tool input. This preserves the per-user boundary.
2. Decrypt with `_shared/encryption.ts`, instantiate the shared Close client, make the call.
3. Never put the raw key (or full contact PII) into the model context or logs.

Confirm `SUPABASE_SERVICE_ROLE_KEY` + the encryption secret are already set on the deployed
orchestrator (they're used by other functions; verify for this one).

---

## Build plan (phased)

### Phase 1 — Read-only tools (ship first)
Add to `tools/` and register in `tools/index.ts`; wire into the CRM agent (or a new `close`
agent) in `core/agents.ts` + routing in `core/routing.ts`.

- `getCloseLeadSnapshot` — look up a lead by name or `close_lead_id` → compact summary: status,
  primary contact channels (presence, not raw PII unless needed), open opportunities, last N
  activities (type + date + one-line). **Mirror `getClientSnapshot.ts`'s PII-drop discipline.**
- `getCloseLeadActivity` — recent calls/emails/SMS/notes/meetings for a lead (summarized).
- `searchCloseLeads` — Close Advanced Filtering API and/or the user's Smart Views (e.g.
  "no touch in 14 days", "open opps over $X"). Return names + ids + the signal, not full records.
- `getCloseOpportunities` — open/stalled opportunities (value, status, age), for triage.

Each returns the `{ available: bool, ... }` shape so the grounding backstop
(`core/grounding.ts`) covers it. Return `available:false` with a clear reason when the user has
no `close_config` row (not connected) or Close 401s.

### Phase 2 — Writes (behind the existing approve gate)
Reuse the `assistant_action_requests` draft→approve→execute lifecycle — **do not** let the model
write to Close directly.
- New action types/channels: `close_note`, `close_task`, `close_email`, `close_sms`,
  `close_sequence_enroll`.
- Execution in `assistant-action-execute` (or a sibling) using the service-role→key path above.
- Keep recipient authz + content-freeze semantics (`assistant_recipient_is_allowed`) for sends.
- Writes act **as the user** (their key) → must stay human-approved.

---

## Close API capability reference (developer.close.com)

- **Read:** leads (contacts, custom fields, status), advanced filtering / saved Smart Views,
  opportunities (pipeline/value/status/dates), activities (calls w/ duration/recording, emails,
  SMS, notes, meetings, status changes), tasks, users, lead & opportunity statuses, pipelines,
  email/SMS templates, sequences, reporting metrics, 30-day event log.
- **Write/act:** create/update leads, contacts, opportunities, tasks, notes; send email & SMS;
  enroll in sequences; bulk actions; webhooks. (Calling is via the softphone; API logs/manages
  calls, doesn't place them headlessly.)
- **Auth:** API key (what we use) or OAuth2. **Rate limits:** per-endpoint, HTTP 429 with reset
  headers — handle 429/backoff in the shared client; batch carefully.

---

## Safety / non-negotiables
- Per-user key boundary: fetch key ONLY for `ctx.userId`; never from tool input.
- No raw API key or full contact PII (email/phone/DOB/notes) in model context or logs — summarize.
- All writes behind draft→approve→execute; never claim a write happened without execution.
- Honor `access_revoked_at` / sunset gating if applicable (this is platform data access).
- 429/backoff + graceful `available:false` on not-connected / auth failure.

## Open decisions (resolve before/early in build)
1. Agency-fallback key (`close_config_agency_fallback`) — honor for Jarvis, or require the user's
   own key only?
2. Read-only v1 only, or include Phase-2 writes in the first release?
3. New dedicated `close` agent vs. extend the existing `crm` agent (currently `getClientSnapshot`).
4. Live-every-call vs. short cache (mirror `close_kpi_cache` 15-min TTL) to respect rate limits.

## Verification (per repo rule: typecheck ≠ verification)
- Deno unit tests for each tool (mock the Close client) under
  `supabase/functions/assistant-orchestrator/tools/__tests__/`.
- Grounding test: tools return the `available` shape; not-connected → `available:false`.
- **Live E2E** against a real test Close account: connect a key, ask Jarvis to look up a known
  lead, confirm the real record/activity comes back; then (Phase 2) draft→approve→confirm a note
  actually lands in Close. Check function logs for the real call, not just a green build.
- `deno check`; `npm run build`; then `supabase functions deploy assistant-orchestrator`
  (JWT-verified — NOT `--no-verify-jwt`). Migration only needed if adding action types/tables.

## Reference
- Close docs: https://developer.close.com/
- This session's findings + the data-correctness/expandable-panels work: memory
  `project_jarvis_data_correctness.md`; broader assistant context: `project_jarvis_command_center.md`.
