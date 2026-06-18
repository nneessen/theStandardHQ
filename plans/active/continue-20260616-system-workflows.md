# Continue: System Workflows overhaul

**Branch:** `feat/system-workflows-overhaul` (off `main`) · **PR:** #20 (open, pushed)
**Full context:** read memory `project_system_workflows_overhaul_20260616` (and `MEMORY.md` pointer)
and the plan `~/.claude/plans/system-workflows-need-a-swift-wombat.md`.

## DONE (committed + pushed in PR #20, verified: build / tsc / eslint / 17 Deno tests / drift test / DB queue chain)
- **Phase 0** security hardening (`21947ac`) · **Phase 1** event-type single source of truth (`d3f3b55`)
- **Phase 2** async SKIP-LOCKED queue: data layer (`9c4c2b1`) + **engine cutover** (`6962000`, `2310df8a`)
  — the queue is now LIVE (enqueue-only trigger → worker → process-workflow → cron).
- **Phase 3 SMS action** (`b9798c9`).

## NEXT — ✅ ALL DONE (session 2, Jun 16, committed NOT pushed)
1. ✅ **E2E'd the cutover** (`b86993ea`) — full chain verified on local served fns; the fire-and-forget
   kick fires. **Found+fixed 2 real prod schema bugs:** create_notification `is_read`→`read`;
   all_agents/all_trainers recipient queries (email+SMS) `is_deleted`→`archived_at` (no is_deleted col).
   New `scripts/test-workflow-e2e.sh` smoke test.
2. ✅ **Idempotency** (`e62b979c`) — surgical per-recipient ledger (mig `20260616152822`:
   workflow_send_log + claim_workflow_send + reaper TTL 5→15min), NOT email_queue (can't carry
   provider/from/replyTo/dedupe). A 3-lens xhigh review found 3 HIGH bugs, all fixed+verified:
   per-action `resume_action_index` persist (reaped resume no longer re-fires webhook/notification),
   cooldown gated to `attempts<=1`, rate-limit pre-filter of already-claimed recipients.
3. ✅ **AI email-gen** (`96f7b2c9`) — `generate-workflow-email-template` edge fn (gate+rate-limit+
   Anthropic strict-JSON → email_templates) + `src/lib/workflow-email-starter-prompts.ts`. Live AI call
   untested locally (.env.local ANTHROPIC key invalid); gate/validation/insert-shape verified.
4. ✅ **Phase 4 access** (`bafff864`) — `/system/workflows` route + nav opened to IMO admins
   (`permission="nav.user_management"`); workflows write RLS already present (verified).

## DEPLOY (when ready)
Apply all `2026061607*`–`20260616152822` migrations to prod via `./scripts/migrations/run-migration.sh`;
deploy **4** edge fns (process-workflow, process-pending-workflows, trigger-workflow-event,
generate-workflow-email-template); ensure `app_config`/secrets have `supabase_project_url` +
`supabase_service_role_key` + **`ANTHROPIC_API_KEY`**; set up the `workflow-worker` pg_cron;
**regen `src/types/database.types.ts`** (targets prod → only AFTER migrations land; adds workflow_send_log,
no frontend imports it yet so tsc is green now); then E2E + a real AI-gen test on the live site.

## GOTCHAS (don't relearn the hard way)
- **pgmq can't be created from a migration** on Supabase (postgres ≠ superuser, no CREATE on the
  supabase_admin-owned pgmq schema) → the `workflow_runs` row IS the queue entry (SKIP LOCKED).
- **Local DB lags prod** — apply specific prod-but-unapplied migrations locally to test (already did
  `trigger_event_types` seed + `workflow_events.imo_id`).
- **`generate:types` targets the PROD project-id** → can't regen for local-only schema; defer to deploy.
- **ESLint boundary:** `src/features/**` may NOT import `@/services/**` (build/tsc don't catch it;
  only `npm run lint`/pre-commit does). Cross-layer constants go in `@/lib`.
- **Pre-existing bug** (noticed, not fixed): email `ActionConfigPanel` writes recipientType
  `triggeruser`/`currentuser` but the engine expects `trigger_user`/`current_user`.
- Run `npx supabase start` if local DB is down (Docker must be running).
