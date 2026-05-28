# Continuation — Phase 2: consolidate pipeline_* (and recruit_*) RLS policies

Date filed: 2026-05-28
Status: NOT STARTED. Phase 1 (user_profiles) is DONE + live on both DBs.

## Why this exists (context)

Pages were 500-ing with `canceling statement due to statement timeout`. Root cause: **RLS policy
bloat** — tables with many overlapping permissive policies make Postgres' query *planner* (not
execution) explode. A query on `pipeline_automations` (24 rows) had **~26,000 ms planning time** /
<0.5s execution because its policies subquery `user_profiles`, which itself had 16 SELECT policies.

**Phase 1 (done, commit `8f0e1fd3` on branch `fix/consolidate-user-profiles-rls`):** consolidated
`user_profiles`' 16 SELECT policies → 1 equivalent policy. Proven row-set-identical for all 115 live
users (0 mismatches). That worst query dropped **26,000 ms → 5,015 ms planning**; direct
`user_profiles` select 18.7 ms → 2.6 ms. Also shipped a targeted RPC `get_system_automations()`
(commit `9d9e5fcb`, on main) that already serves the specific `/admin` query.

**The residual ~5,015 ms** on that query is `pipeline_automations`' OWN policy bloat compounding with
`pipeline_phases` / `pipeline_templates` (their policies cross-reference each other). Phase 2 removes
that. **Not urgent** — `/admin` is already fixed (RPC + the user_profiles win), and 5s is under the
15s timeout — but other queries touching these tables still plan slowly and risk timeouts.

## Target tables (policy counts as of 2026-05-28, from `pg_policies`)

| table | total policies |
|---|---|
| `pipeline_phases` | 21 |
| `pipeline_templates` | 19 |
| `recruit_checklist_progress` | 18 |
| `recruit_phase_progress` | 18 |
| `pipeline_automation_logs` | 15 |
| `pipeline_automations` | 15 |

Start with `pipeline_automations` + `pipeline_phases` + `pipeline_templates` (the ones in the proven-
slow query path). Decide per table whether to also fold UPDATE/DELETE or just SELECT (SELECT is what
cross-table `EXISTS` triggers — the perf driver — so SELECT-first, like Phase 1).

## Proven approach (reuse Phase 1's exactly)

1. Dump each table's SELECT policy quals: `SELECT policyname, qual FROM pg_policies WHERE
   tablename='<t>' AND cmd='SELECT'`.
2. Write ONE consolidated SELECT policy = faithful OR of all the original quals, factoring shared
   scope tails out once. Wrap `auth.uid()` as `(SELECT auth.uid())`; leave STABLE SECURITY DEFINER
   helpers (`get_my_imo_id`, `super_admin_in_scope`, `is_imo_admin`, etc.) bare so the planner hoists
   them. **Watch for per-policy qualifiers** (e.g. Phase 1's `imo_staff` policy required
   `'agent' = ANY(roles)` — do NOT drop those or you broaden access).
3. Migration idiom (team standard, see `20260521213701_harden_imo_scoped_operational.sql` and the
   Phase-1 migration `supabase/migrations/20260528141931_consolidate_user_profiles_select_policies.sql`):
   `DROP POLICY IF EXISTS "<each old>" ON public.<t>;` then one `CREATE POLICY <t>_select_consolidated
   ... FOR SELECT TO authenticated USING (<predicate>);`. Write a matching rollback in
   `supabase/migrations/_rollback/`.

## MANDATORY safety gate — exact row-set equivalence BEFORE applying

Reuse the Phase-1 harness pattern (it lived at `/tmp/equiv_harness.sql`; recreate it). For a table T it
runs entirely in `BEGIN…ROLLBACK` (nothing commits): for every relevant caller, hash the visible row-
id set of T under the OLD policies, swap to the consolidated policy, re-hash, assert **0 mismatches**.
Skeleton:
```sql
BEGIN; SET LOCAL statement_timeout=0;
CREATE TEMP TABLE eq(caller uuid PRIMARY KEY, old_hash text, new_hash text) ON COMMIT DROP;
DO $h$ DECLARE r record; h text; BEGIN
  FOR r IN SELECT id FROM public.user_profiles ORDER BY id LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', r.id::text,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT md5(coalesce(string_agg(x.id::text, ',' ORDER BY x.id),'(none)')) INTO h FROM public.<T> x;
    RESET ROLE; INSERT INTO eq(caller, old_hash) VALUES (r.id, h);
  END LOOP; END $h$;
-- <DROP the old policies + CREATE the consolidated one here>
DO $h$ ... same loop, UPDATE eq SET new_hash=h ... $h$;
SELECT count(*) FILTER (WHERE old_hash IS DISTINCT FROM new_hash) AS mismatches FROM eq;
ROLLBACK;
```
Run on LOCAL first (mechanics), then REMOTE (the real 115-caller proof). **Do not apply if any
mismatch.** Note: a table whose visibility is per-row but not user-keyed may need a different "visible
set" probe (e.g. hash the full visible id-set as above — that already captures any difference).

## After applying (both DBs via run-migration.sh)

- Planning proof: re-run `EXPLAIN (ANALYZE) SELECT * FROM pipeline_automations WHERE phase_id IS NULL
  AND checklist_item_id IS NULL` under the authenticated super-admin (Nick:
  `d0d3edea-af6d-4990-80b8-1765ba829896`) — target: well under 1,000 ms planning (was 5,015 after
  Phase 1).
- Re-run `scripts/check-revocation-gate-completeness.sql` (must stay 0) and the
  `wipe-export-parity` RUN_DB_TESTS suite.
- `npm run build`. No frontend/types change expected (policy-only).
- Commit on a branch off main; STOP for explicit approval before merge (RLS change is live on the DB
  once applied to remote — same model as Phase 1; the merge just records the file in the repo).

## Gotchas / notes

- The `/admin` query is ALREADY RPC-served (`get_system_automations`), so don't reintroduce a direct
  select expecting it to be the test path — use EXPLAIN directly for the planning proof.
- These tables' policies reference `is_imo_admin()`, `get_my_imo_id()`, `super_admin_in_scope()`, and
  EXISTS subqueries against `pipeline_phases`/`pipeline_templates`/`phase_checklist_items` — so
  consolidating them ALSO de-amplifies each other; expect compounding wins.
- Migrations rule: apply EVERY migration to LOCAL and REMOTE; never raw psql; use
  `./scripts/migrations/run-migration.sh` (and `DATABASE_URL=$REMOTE_SUPABASE...`? — use
  `DATABASE_URL=$REMOTE_DATABASE_URL` for migrations).
- Remote service-role key for edge/REST probes is `REMOTE_SUPABASE_SERVICE_ROLE_KEY` (NOT
  `SUPABASE_SERVICE_ROLE_KEY`, which is the local demo key).
