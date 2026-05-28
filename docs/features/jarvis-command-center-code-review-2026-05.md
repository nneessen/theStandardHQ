# Jarvis Command Center — Code Review (2026-05-28)

Reviewer: code-reviewer agent (opus). Scope: `git diff main...HEAD` on
`feat/assistant-command-center` (commit `7c3aa3fe`). Companion to
`jarvis-command-center-handoff-2026-05.md`.

## Summary

Net-new feature (3,401 insertions, no deletions). The core architecture is sound: the
anon-key + user-JWT client (`createSupabaseClient(authHeader)`) correctly scopes every
tool's DB access through RLS as the calling user; no service-role client is constructed in
any of the three new edge functions, and no secret reaches the browser. The five tables'
RLS policies are present and correct for SELECT/INSERT/UPDATE/DELETE. The pure `core/`
safety logic (guard, state-machine, redaction, routing) is well-factored and offline-tested.

The issues below cluster in two areas: (1) safety invariants that are *enforced in TypeScript
only* but **not** at the database layer, so an authenticated user using the raw Supabase client
(which the frontend already imports) can bypass them; and (2) the handoff §5 "no fabrication"
claim being framed as an enforced invariant when it is in fact prompt-only. None is a
hard-blocker, but two should be fixed before the live end-to-end run / prod deploy.

---

### High

**H1 — Approved/executed action rows can be reset and re-sent by the owning user (DB does not enforce the state machine).**
`supabase/migrations/20260528064814_assistant_foundation.sql:176-177` — the UPDATE policy is
`USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`, which lets the owner set
`status` to *any* value on their own rows directly via `supabase.from("assistant_action_requests").update(...)`.
The lifecycle (`core/state-machine.ts`) is enforced only in TS. Concretely: after a send,
the row is `executed`; a user can `update({ status: "approved" })` on it and re-invoke
`assistant-action-execute`. The "race-safe" guard at `assistant-action-execute/index.ts:78-87`
only rejects concurrent `executing` collisions — it requires `status === "approved"`, which is
now true again — and `canExecute` (`core/state-machine.ts:47-53`) checks only
`status === "approved" && !isExpired`. Since `expires_at` defaults to +24h
(`migration:160`), the same approved email/SMS can be re-sent repeatedly within the window.
This breaks the §5 "no send without approval" invariant's intent (one human approval = one send).
**Fix:** enforce the transition in the DB, not just TS. Either (a) a `BEFORE UPDATE` trigger on
`assistant_action_requests` that rejects illegal `status` transitions (mirroring `TRANSITIONS`)
and forbids leaving a terminal state; or (b) make execution idempotent by guarding on
`executed_at IS NULL` in the claim update (`.is("executed_at", null)`) and/or a partial unique
index; and tighten the UPDATE policy so a row in a terminal status cannot be mutated.

**H2 — "No fabrication" is prompt-only, not enforced; handoff §5 overstates it.**
`core/agents.ts:10-19` (BASE_SYSTEM_RULES) + the per-section `available` flag in
`tools/getDailyBriefingData.ts` / `tools/types.ts:50-63`. The *shape* (`{available:false,...}`)
is real and tested, and the system prompt forbids inventing numbers — but nothing
programmatically prevents the model from emitting an ungrounded figure. Handoff §5 says the
tests "lock in" no fabrication; they lock in the data *shape*, not the model's adherence. For
the feature's central safety claim this gap should be stated honestly. **Fix:** reframe §5 of
the handoff to "grounding shape enforced; model adherence is prompt-guided, not verified," and
consider a lightweight post-hoc check (e.g. flag assistant turns that state numerics when every
tool section for that turn returned `available:false`) before trusting this in production.

### Medium

**M1 — Audit-log redaction is key-name-only; PII in RPC *values* is logged in clear.**
`core/redaction.ts:5-6,31-33` matches sensitive *keys* (`token`, `ssn`, `dob`, ...) but the
grounding RPCs (`get_at_risk_commissions`, `get_team_leaderboard_data`, recruiting/lead stats)
return business rows whose *values* are client/agent names, premiums, and potentially DOB/partial
SSN under innocuous keys (e.g. `full_name`, `birth_date`). Those land in `assistant_tool_calls.output_redacted`
verbatim (truncated, not redacted). For an insurance platform this is a PII-in-logs concern.
**Fix:** either drop tool *outputs* from the audit log (keep inputs + status + counts), hash/omit
known PII columns, or redact by value-pattern for emails/phones/SSNs in addition to key names.

**M2 — Re-send / no recipient authorization, from the platform's official domain.**
`assistant-action-execute/index.ts:17` hardcodes `SYSTEM_FROM = "The Standard HQ <noreply@thestandardhq.com>"`;
the only guard on *who* receives mail/SMS is the human-typed recipient in the modal
(`ActionApprovalModal.tsx:105-115`) — acknowledged in handoff §9.2. Combined with H1, a user can
send arbitrary content to arbitrary addresses *from the platform's branded sender*. Reply-to is
the user (`index.ts:147`) but recipients see the official From. **Fix (Phase-2, as flagged):**
add a server-side recipient-authorization check (recipient ∈ caller's book/downline/leads) in
`assistant-action-execute` before the send; keep it on the explicit hardening list.

### Low

**L1 — `firstName` is loaded but never reaches the model; the briefing prompt promises a greeting it cannot produce.**
`assistant-orchestrator/index.ts:69,136` puts `firstName` into `ctx`, but `buildSystemPrompt`
(`core/agents.ts:129-138`) takes only `(agent, assistantName)`, and no tool returns the name.
Yet EXECUTIVE_BRIEFING_PROMPT (`core/agents.ts:27`) instructs a "greeting using the user's first
name if known." The model will either omit it or — worse, given H2 — guess. **Fix:** inject
`firstName` into the system prompt (or pass via the first user turn), or remove the instruction.

**L2 — Lossy (but valid) history replay drops tool context across turns.**
`assistant-orchestrator/index.ts:245-260` persists the assistant turn as the plain `finalText`
string (no `tool_use`/`tool_result` blocks), and `:116-126` replays prior `content` directly.
This is a *valid* Anthropic sequence (string content is accepted) and is intentional per the
comment, so not a correctness bug — but on a follow-up turn the model has the prose, not the
grounded numbers it cited, so "what was that figure again?" can only be answered by re-calling a
tool. Acceptable for MVP; document the limitation.

**L3 — `get_at_risk_commissions` has no CREATE in the migrations tree (only an `ALTER ... SET search_path`).**
Referenced at `tools/getDailyBriefingData.ts:11` and `tools/getPolicyRiskAlerts.ts:12-13` with
`p_user_id: ctx.userId`. The sibling `avg_lead_heat_score` migration
(`20260330100310_fix_avg_score_rpc_security.sql`) shows the canonical pattern: SECURITY DEFINER
*with* an explicit `p_user_id != auth.uid()` guard. `get_at_risk_commissions`' definition isn't
in-repo (consistent with this repo's known out-of-band-SQL backlog), so I could not confirm it
carries the same caller check. Risk is bounded here because `ctx.userId` is the *verified* caller
and the model cannot inject a different id (not in the tool input schema) — but **verify on the
deployed DB** that `get_at_risk_commissions` either enforces `p_user_id = auth.uid()` or relies on
RLS, before the prod apply. **Fix:** add the missing CREATE to a tracked migration; assert the
caller guard.

### Nit

**N1 — `assistant-action-execute/index.ts:108`** `Deno.env.get("SUPABASE_URL")!` non-null-asserts;
if unset the throw is swallowed into a generic 500. Mirror the explicit `ANTHROPIC_API_KEY` guard
in `anthropic.ts:14-19` for a clearer failure. Minor.

**N2 — `core/guard.ts` is invoked with an empty permission list.**
`assistant-orchestrator/index.ts:186` calls `canUseTool(meta, [], { isSuperAdmin })`. All MVP
tools have `requiredPermissions: []`, so this is inert today, but the moment a tool declares a
required permission, every non-super-admin is denied (empty `userPermissions`). Wire real
permissions before adding a gated tool, or add a TODO at the call site.

**N3 — Cross-function import bundling (handoff §9.5).**
`assistant-action-execute/index.ts:12-14` imports from `../assistant-orchestrator/core/`. This is
fine for `supabase functions deploy` (relative imports bundle), but confirm in the deploy smoke
test since the functions are deployed independently.

---

## Verdict: **ship-with-fixes**

The foundation is well-architected and the multi-tenant/RLS story holds: no cross-user or
cross-IMO read/write path exists through these tools, no service-role or secret reaches the
browser, and the approval gate's happy path is correct. Two items should be closed before the
deferred live run + prod deploy:
- **H1** (enforce the action-request state machine at the DB layer so approved/executed rows
  can't be reset and re-sent) — this is the only finding that materially weakens the
  "no send without approval" guarantee.
- **M1** (stop logging raw PII-bearing tool outputs).

**H2** is an honesty edit to the handoff (the no-fabrication invariant is prompt-guided, not
enforced) plus an optional guardrail. **M2** (recipient authorization) is correctly already on
the Phase-2 list — keep it there and gate prod outbound volume accordingly. L/N items are
cleanup. None blocks merge to the feature branch; H1 + M1 block the production send path.
