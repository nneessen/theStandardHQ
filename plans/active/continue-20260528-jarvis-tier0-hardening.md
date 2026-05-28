# CONTINUATION PROMPT — Jarvis Command Center: Tier-0 hardening (+ deploy)

> Paste this into a fresh session. It is self-contained: it assumes no memory of the
> session that built the MVP. Read the three reference docs below before coding.

## Start here

```bash
cd /Users/nickneessen/projects/commissionTracker-jarvis
git branch --show-current   # expect: feat/assistant-command-center
git log --oneline -1        # expect: 7c3aa3fe feat(assistant): embedded Jarvis command center MVP foundation
```

**Goal of the next session:** implement **Tier-0 hardening** (the should-fix-before-prod
items from the code review) on the Jarvis command center, verify, then (on the user's
explicit go-ahead) do the live E2E + production deploy.

**Do NOT** start broad — Tier-0 is three focused fixes (H1, M1, L3). Read the plan first.

## Reference docs (read these first — they hold the full detail)

- **Plan (what to do):** `plans/active/jarvis-phase2-hardening.md` — tiered remediation.
- **Review (why):** `docs/features/jarvis-command-center-code-review-2026-05.md` — findings H1/H2/M1/M2/L1–L3/N1–N2 with file:line + recommended fixes.
- **Architecture/handoff:** `docs/features/jarvis-command-center-handoff-2026-05.md` — full design, file map, data model, safety invariants (honestly caveated), decisions, verification status.
- **Memory:** `project_jarvis_command_center.md` (auto-memory).

## Worktree + environment (important — this is NOT the main checkout)

- The Jarvis work lives in a **git worktree** at `/Users/nickneessen/projects/commissionTracker-jarvis`
  on branch `feat/assistant-command-center` (off `main`). The **main checkout**
  (`/Users/nickneessen/projects/commissionTracker`) is held by a **parallel session on the
  sunset branch** — do not touch it / do not `git checkout` there.
- The worktree has these **symlinks** (gitignored, already present): `.env`, `node_modules`,
  and `.husky/_` (husky bootstrap, so the pre-commit hook runs — do NOT commit with `--no-verify`).
- `deno` is installed (`/opt/homebrew/bin/deno`). Edge functions are Deno; validate with
  `deno check`, not the frontend tsc.
- The MVP DB migration (`supabase/migrations/20260528064814_assistant_foundation.sql`) was
  applied to **LOCAL only**. Remote/prod is NOT applied (deferred).
- Migrations: **runner script only** (`./scripts/migrations/run-migration.sh FILE.sql`), never
  `psql` directly. Apply local AND remote at deploy time.
- **Never push** non-main branches (Vercel deploys on push). Commit locally; push only on `main`
  or explicit request.

## Tier-0 work (do these; full detail in the plan)

### H1 — DB-enforce the action lifecycle + idempotent execution *(top priority; security)*
Today the lifecycle is enforced only in `supabase/functions/assistant-orchestrator/core/state-machine.ts`.
The UPDATE RLS policy (`migration:176-177`, `USING/WITH CHECK (user_id = auth.uid())`) lets an
owner set `status` to ANY value on their own row via the raw Supabase client the frontend already
imports — so an `executed` row can be reset to `approved` and re-sent within the 24h `expires_at`
window (`assistant-action-execute` only checks `status === "approved" && !expired`). This breaks
"one human approval = one send."
- New migration: a `BEFORE UPDATE` trigger on `assistant_action_requests` rejecting illegal status
  transitions (mirror `TRANSITIONS` in `state-machine.ts`) and forbidding mutation of terminal rows.
- Idempotent execution: in `assistant-action-execute/index.ts` claim update, add `.is("executed_at", null)`
  alongside `.eq("status","approved")`.
- Tighten the UPDATE policy so terminal rows can't be mutated.
- Tests: state-machine "terminal is immutable"; a `run-sql` assertion that `executed → approved` is rejected.

### M1 — Stop logging PII values in the audit log
`core/redaction.ts` redacts sensitive *key names* only; RPC output *values* (client/agent names,
premiums, possibly DOB) land in `assistant_tool_calls.output_redacted` in clear. Fix: log a compact
**summary** (row counts + per-section `available` flags), not raw rows — change what
`assistant-orchestrator/index.ts` writes for `output_redacted`, and/or add value-pattern redaction.

### L3 — Verify `get_at_risk_commissions` caller guard before prod
Its CREATE is not in-repo (out-of-band SQL backlog). On the deployed DB confirm it enforces
`p_user_id = auth.uid()` (or relies on RLS), and add the missing CREATE to a tracked migration.

## Verify (after Tier-0)

```bash
cd /Users/nickneessen/projects/commissionTracker-jarvis
./scripts/migrations/run-migration.sh supabase/migrations/<new>.sql   # local
./scripts/test-assistant-edge.sh         # deno safety tests (were 23/23)
npx vitest run src/features/assistant     # frontend tests (were 7/7)
npm run build                             # tsc + vite (matches Vercel)
deno check supabase/functions/assistant-action-execute/index.ts
```
Manual check that closes H1: approve+send an action once, then attempt a second execute on the
same row → must be rejected. Confirm `assistant_tool_calls` carries no raw PII (M1).

## After Tier-0

- **Tier 1/2** (recipient auth, acting_imo_id, fabrication guardrail, wire next agents, cleanups) —
  see the plan. Separate pass; not blocking.
- **Deploy (task #13, needs user go-ahead):** apply the MVP migration + the new Tier-0 migration to
  REMOTE (`DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh ...`), deploy the
  3 edge functions (`assistant-orchestrator`, `assistant-action-execute`, `assistant-voice-token`),
  confirm `ANTHROPIC_API_KEY`/Twilio/Mailgun secrets, and confirm the Mailgun **verified sender** for
  `noreply@thestandardhq.com` on the deployed `MAILGUN_DOMAIN`.

## Uncommitted state to be aware of

As of this handoff, **committed** to the branch: the MVP code (commit `7c3aa3fe`).
**Uncommitted** in the worktree: `docs/features/jarvis-command-center-handoff-2026-05.md`,
`docs/features/jarvis-command-center-code-review-2026-05.md`,
`plans/active/jarvis-phase2-hardening.md`, and this file. The Obsidian vault was already updated
(new page `command-center-assistant.md`, lint 0) — those vault edits are also uncommitted (vault has
its own sync). Decide whether to commit the docs at the start of the next session.

## Hard constraints (from CLAUDE.md)

Migration runner only (no psql); apply local+remote; regen or surgically add to
`src/types/database.types.ts` (full regen leaks undeployed schema); no CHECK constraints on
enum-like columns (enforce in TS); never push non-main; never `--no-verify`; verify by running
the code path, not just typecheck.
