# Jarvis Command Center — Phase 2 Hardening Plan

## Context

The MVP foundation shipped on `feat/assistant-command-center` (commit `7c3aa3fe`), all
automated gates green. A local code review (opus) returned **ship-with-fixes**: the
architecture is sound (user-JWT client scopes every tool through RLS; no secret/service-role
reaches the browser; all 5 tables' RLS policies complete; no cross-user/cross-IMO path), but
it surfaced security gaps where invariants are enforced in **TypeScript only**, not at the DB.

This plan sequences the work by urgency. Sources: the review
(`docs/features/jarvis-command-center-code-review-2026-05.md`) and the handoff §9 risks
(`docs/features/jarvis-command-center-handoff-2026-05.md`). Do **Tier 0 before the production
deploy** (task #13); Tier 1/2 can follow.

---

## Tier 0 — Close before the live run / prod deploy (security)

### H1 — DB-enforce the action lifecycle + make execution idempotent  *(highest priority)*
Today the lifecycle lives only in `core/state-machine.ts`. The UPDATE RLS policy
(`migration:176-177`) is `USING/WITH CHECK (user_id = auth.uid())`, so an owner can
`update({ status: "approved" })` on an already-`executed` row via the raw Supabase client the
frontend already imports, then re-invoke `assistant-action-execute` — the same approved
email/SMS re-sends within the 24h `expires_at` window. This breaks "one human approval = one
send" and, with the branded `noreply@thestandardhq.com` sender (M2), is a real abuse vector.

Fix (one new migration + small edge-fn change):
- **Idempotent execution:** in `assistant-action-execute/index.ts` claim update, add
  `.is("executed_at", null)` alongside `.eq("status","approved")`; set `executed_at` on success
  (already set). A re-reset row would still have a non-null `executed_at` → claim fails.
- **DB-enforced transitions:** add a `BEFORE UPDATE` trigger on `assistant_action_requests`
  that rejects status transitions not in `TRANSITIONS` and forbids mutating a terminal row
  (`executed|failed|cancelled|expired`). Mirror `core/state-machine.ts` exactly.
- **Tighten UPDATE policy** so terminal rows can't be mutated (belt-and-suspenders with the trigger).
- Tests: state-machine "terminal is immutable"; a `run-sql` assertion that the trigger rejects
  `executed → approved`.

### M1 — Stop logging PII values in the audit log
`core/redaction.ts` redacts sensitive *key names* but tool *output values* (client/agent names,
premiums, possibly DOB/partial SSN under benign keys like `full_name`) land in
`assistant_tool_calls.output_redacted` verbatim (truncated, not redacted).
Fix (recommended): log a compact **summary** of tool output (row counts + per-section
`available` flags), not raw rows. Keep inputs + status + duration. Alternatively add
value-pattern redaction (email/phone/SSN). Touches `core/redaction.ts` + what `index.ts` logs.

### L3 — Verify `get_at_risk_commissions` caller guard before prod apply
Its CREATE isn't in-repo (out-of-band SQL backlog). On the deployed DB, confirm it enforces
`p_user_id = auth.uid()` or relies on RLS (the sibling `avg_lead_heat_score` migration shows the
canonical SECURITY DEFINER + `p_user_id != auth.uid()` guard). Bounded today because `ctx.userId`
is the verified caller and the model can't inject another id — but verify, and add the missing
CREATE to a tracked migration.

## Tier 1 — Phase-2 security + feature hardening

### M2 — Server-side recipient authorization
Before sending in `assistant-action-execute`, verify the recipient ∈ the caller's allowed set
(their leads / downline / contacts). Define the allowed-set query; reject otherwise. Removes the
"any address from the branded sender" risk that pairs with H1.

### acting_imo_id propagation (super-admin "act as IMO")
Handoff §9.1: cross-tenant briefing for super-admins only works once `acting_imo_id` is in the
JWT (the access-token-hook initiative) and the RPCs read `get_effective_imo_id()`. Wire the
orchestrator's imo resolution to `get_effective_imo_id()` when that lands. Until then, document
that super-admin act-as is not reflected in the assistant.

### H2 — Honest no-fabrication posture (+ optional guardrail)
The `{available:false}` *shape* is enforced/tested, but model adherence is prompt-only. Reframe
handoff §5 to "grounding shape enforced; adherence prompt-guided, not verified." Optional
guardrail: flag/annotate any assistant turn that emits numerics when every tool section that turn
returned `available:false`.

### Wire the next specialist agents
The 12 stubs in `core/agents.ts` are typed configs only. Wire **Production Analyst** and
**Policy Risk** first (reuse existing read tools + add routing), then Lead Prioritization /
Recruiting. Each: real tool(s) + agent config + routing classification.

## Tier 2 — Cleanups (don't block merge)

- **L1** — `firstName` is loaded into `ctx` but never reaches the model, yet the briefing prompt
  promises a greeting. Inject `firstName` into `buildSystemPrompt` (or the first user turn), or
  drop the instruction.
- **L2** — Document the history-replay limitation (follow-up turns see prose, not the cited
  numbers). Optional later: persist `tool_use`/`tool_result` blocks for richer continuity.
- **N1** — `assistant-action-execute/index.ts:108` `Deno.env.get("SUPABASE_URL")!` — add an
  explicit guard (mirror the `ANTHROPIC_API_KEY` guard) for a clearer failure.
- **N2** — the guard runs with `[]` permissions for MVP (tools require none). Wire
  `get_user_permissions` when a tool needs a real permission code.

## Verification

- New migration via runner, applied **local + remote**; regen/surgical types; `npm run build`.
- Deno: terminal-immutability + idempotent-execution tests; `scripts/test-assistant-edge.sh` + vitest green.
- Live E2E: approve→send once, then confirm a second execute on the same row is **rejected**
  (H1 closed); confirm `assistant_tool_calls` carries **no raw PII** (M1).

## Sequencing note

Batch H1 + M1 into one migration/PR (both touch the action/logging path) and land them before
the prod deploy in task #13. Tier 1/2 follow as a separate pass.
