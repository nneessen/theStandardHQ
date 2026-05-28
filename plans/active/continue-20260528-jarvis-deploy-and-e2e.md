# CONTINUATION PROMPT — Jarvis Command Center: deploy + live E2E

> Paste the block below into a fresh Claude Code session. It is self-contained.

---

You are continuing work on the **Jarvis Command Center** in the commissionTracker project.

Working directory (a separate git worktree — NOT the main checkout):
`/Users/nickneessen/projects/commissionTracker-jarvis`, branch `feat/assistant-command-center`.

```bash
cd /Users/nickneessen/projects/commissionTracker-jarvis
git branch --show-current   # expect: feat/assistant-command-center
git log --oneline -1        # expect: 357b1cb6 feat(assistant): wire the remaining 9 agents
```

## Read these first (they hold the full detail)
- `docs/features/jarvis-command-center-handoff-v2-2026-05-28.md` — current state, file map, the
  5 migrations, the deploy runbook (§8), and constraints. **START HERE.**
- `plans/active/jarvis-phase2-hardening.md` — what's done vs remaining.
- Auto-memory `project_jarvis_command_center.md` (and `MEMORY.md` index).
- Knowledge vault: `../_knowledge-vault/wiki/commission-tracker/command-center-assistant.md`.

## Where things stand
The build is COMPLETE and verified locally: all 13 agents wired, Tier-0 (H1/M1/L3) + Tier-1
(M2/H2) security hardening done. Gates green — `deno test` 47/47, `vitest` 7/7, `npm run build`
clean. Everything is committed to the branch but **LOCAL only**: 5 assistant migrations applied to
the local DB only, edge functions not deployed, nothing on `main`, and **no live E2E has ever run**
(no real Anthropic round-trip, no real email/SMS send).

## Your task: production deploy + live end-to-end test (task #13)

**Do NOT deploy until the user explicitly confirms** — this touches the prod DB, shared edge
infrastructure, and can send real email/SMS. First confirm with the user, and confirm the Mailgun
**verified sender** for `noreply@thestandardhq.com` exists on the deployed `MAILGUN_DOMAIN` (without
it, email sends fail). Then follow the runbook in handoff §8:

1. Apply the 5 migrations to REMOTE, in order, with the migration runner (NEVER psql):
   `source .env && DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh supabase/migrations/<file>.sql`
   Order: `20260528064814` → `20260528090704` → `20260528090923` → `20260528112134` →
   `20260528115847`. Confirm the "Target DB" banner reads REMOTE each time.
2. Deploy the 3 edge functions WITH jwt verification (no `--no-verify-jwt`):
   `npx supabase functions deploy <fn> --project-ref pcyaqwodnyrpkaiojnpz` for
   `assistant-orchestrator`, `assistant-action-execute`, `assistant-voice-token`.
3. Confirm `ANTHROPIC_API_KEY` is set on the project; confirm the existing `send-email`/`send-sms`
   functions (which the assistant reuses) are healthy in prod.
4. Live E2E as an Epic Life user at `/command-center`:
   - "brief me on what needs my attention" → grounded reply (or honest per-section "no data").
   - a specialist intent (e.g. "who should I call?" → Lead Prioritization) routes + grounds.
   - draft → approve → send a real email to one of YOUR OWN clients → confirm it sends and the row
     goes `executed`; attempt a second execute on the same row → must be **rejected** (H1).
   - confirm `assistant_tool_calls` has no raw PII (M1); a drafted send to a non-contact is blocked (M2).

If the live run surfaces a bug, fix it on the branch (typecheck-green is NOT proof — exercise the
real code path), re-verify, commit.

## Hard constraints
- Migration runner only; never psql. Apply local + remote.
- **Never push non-main branches** (Vercel deploys on push); merging to `main` is a separate
  explicit user decision. Never `--no-verify` on commits.
- Edge functions are Deno → validate with `deno check`, not the frontend tsc; IDE Deno-global
  errors are false positives.
- After any durable new doc under `docs/`, sync the vault (`-p commission-tracker`, lint must be 0).

## Secondary / deferred (only if the user redirects here)
- `acting_imo_id` propagation — blocked on the JWT access-token-hook initiative.
- Real integrations behind the advisory agents (Google Calendar / Slack API / workflow engine) so
  Calendar/Slack/Workflow do more than draft copy.
