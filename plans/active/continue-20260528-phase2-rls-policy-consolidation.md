# Phase 2 — RLS Policy Consolidation (pipeline_* / recruit_*)

Repo: `/Users/nickneessen/projects/commissionTracker` (React 19 + TypeScript + Supabase/Postgres).
Filed 2026-05-28. Status: NOT STARTED. This document is the complete, self-contained plan — read it
top to bottom and execute it.

## Problem & root cause

Several pages intermittently 500 with `canceling statement due to statement timeout`. Root cause,
proven via live `EXPLAIN`: **RLS policy bloat** — tables with many overlapping permissive policies make
Postgres' query *planner* (not execution) explode. A query on `pipeline_automations` (24 rows) had
**~26,000 ms PLANNING time** / <0.5s execution, because its policies subquery `user_profiles`, which
itself had 16 SELECT policies.

## What's already done (Phase 1 — merged to `main`, CI green, live on prod + local)

- Consolidated `user_profiles`' **16 SELECT policies → 1** equivalent policy (migration
  `supabase/migrations/20260528141931_consolidate_user_profiles_select_policies.sql`; rollback under
  `supabase/migrations/_rollback/`). Proven **row-set-identical for all 115 live users (0 mismatches)**
  before applying. Worst-query planning **26,000 ms → 5,015 ms**; direct `user_profiles` select
  18.7 → 2.6 ms.
- Shipped `get_system_automations()` SECURITY DEFINER RPC (migration `20260528124737`) which already
  serves the `/admin` automations query — so `/admin` is not a fire.

## The task (Phase 2)

Remove the **residual ~5,015 ms** — it's the *own* policy bloat of these tables (they also `EXISTS`-
subquery each other, so consolidating several de-amplifies the rest):

| table | policies |
|---|---|
| `pipeline_phases` | 21 |
| `pipeline_templates` | 19 |
| `recruit_checklist_progress` | 18 |
| `recruit_phase_progress` | 18 |
| `pipeline_automation_logs` | 15 |
| `pipeline_automations` | 15 |

Start with `pipeline_automations` + `pipeline_phases` + `pipeline_templates` (the proven-slow path);
re-measure, then continue down the list as needed (the residual may largely resolve after the first
few). **SELECT-first** — SELECT is what cross-table `EXISTS` triggers, i.e. the perf driver; decide
per table whether folding UPDATE/DELETE is worth it.

## Method (reuse Phase 1 exactly)

1. Dump each table's SELECT quals: `SELECT policyname, qual FROM pg_policies WHERE schemaname='public'
   AND tablename='<t>' AND cmd='SELECT'`.
2. Write ONE consolidated SELECT policy = faithful OR of all original quals, shared scope tail factored
   out once. Wrap `auth.uid()` as `(SELECT auth.uid())`; leave STABLE SECURITY DEFINER helpers
   (`get_my_imo_id`, `get_effective_imo_id`, `super_admin_in_scope`, `is_imo_admin`, …) bare so the
   planner hoists them to InitPlans. **Transcribe every per-policy qualifier faithfully** — e.g.
   Phase 1's `imo_staff` policy required `'agent' = ANY(roles)`; dropping such a clause broadens access
   and is a tenant-isolation leak.
3. Migration idiom (team standard — see `20260528141931_consolidate_user_profiles_select_policies.sql`
   and `20260521213701_harden_imo_scoped_operational.sql`): `DROP POLICY IF EXISTS "<each old>" ON
   public.<t>;` then one `CREATE POLICY <t>_select_consolidated ... FOR SELECT TO authenticated USING
   (<predicate>);`. Write a matching rollback in `supabase/migrations/_rollback/`.

## MANDATORY safety gate — exact row-set equivalence BEFORE applying (non-negotiable)

Run this harness entirely in `BEGIN…ROLLBACK` (nothing commits). For each of the ~115 live callers it
hashes their visible row-id set of table `<T>` under the OLD policies, swaps to the consolidated
policy, re-hashes, and reports mismatches. Run on **LOCAL first** (mechanics), then **REMOTE** (the real
proof). **Do not apply the migration if `mismatches` > 0** — that means a transcription bug (leak or
lockout). Replace `<T>` and paste your migration's DROP+CREATE where marked.

```sql
BEGIN; SET LOCAL statement_timeout = 0;
CREATE TEMP TABLE eq(caller uuid PRIMARY KEY, old_hash text, new_hash text) ON COMMIT DROP;
DO $h$ DECLARE r record; h text; BEGIN
  FOR r IN SELECT id FROM public.user_profiles ORDER BY id LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', r.id::text,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT md5(coalesce(string_agg(x.id::text, ',' ORDER BY x.id),'(none)')) INTO h FROM public.<T> x;
    RESET ROLE; INSERT INTO eq(caller, old_hash) VALUES (r.id, h);
  END LOOP; END $h$;
-- >>> paste the migration body here: DROP POLICY IF EXISTS ... + CREATE POLICY ... (NO BEGIN/COMMIT) <<<
DO $h$ DECLARE r record; h text; BEGIN
  FOR r IN SELECT id FROM public.user_profiles ORDER BY id LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', r.id::text,'role','authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT md5(coalesce(string_agg(x.id::text, ',' ORDER BY x.id),'(none)')) INTO h FROM public.<T> x;
    RESET ROLE; UPDATE eq SET new_hash = h WHERE caller = r.id;
  END LOOP; END $h$;
SELECT count(*) AS total, count(*) FILTER (WHERE old_hash IS DISTINCT FROM new_hash) AS mismatches FROM eq;
SELECT caller FROM eq WHERE old_hash IS DISTINCT FROM new_hash;
ROLLBACK;
```

## Apply & verify (after equivalence passes with 0 mismatches)

1. Apply to BOTH DBs: `./scripts/migrations/run-migration.sh FILE.sql` then
   `source .env && DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh FILE.sql`.
2. Planning proof (under authenticated super-admin, sub `d0d3edea-af6d-4990-80b8-1765ba829896`):
   `EXPLAIN (ANALYZE) SELECT * FROM pipeline_automations WHERE phase_id IS NULL AND checklist_item_id IS NULL;`
   — target well under 1,000 ms planning (was 5,015 after Phase 1).
3. `scripts/check-revocation-gate-completeness.sql` must stay **0**; run
   `RUN_DB_TESTS=1 PARITY_DB_URL=$REMOTE_DATABASE_URL npx vitest run src/features/sunset/__tests__/wipe-export-parity.test.ts`.
4. `npm run build` (expect no `database.types.ts` change — policy-only).
5. Commit on a branch off `main`; **STOP for explicit user approval before merging to `main`**.

## Hard rules & gotchas

- Migrations: ALWAYS `./scripts/migrations/run-migration.sh`, NEVER raw psql; apply to BOTH local + remote.
- Applying a migration to REMOTE makes the RLS change **live on prod immediately** (RLS is DB-layer) —
  so the equivalence harness MUST pass on remote data first. Merging to `main` only records the file in
  the repo (no Vercel/runtime impact for a policy-only migration).
- Remote DB URL = `REMOTE_DATABASE_URL`. Remote service-role key (for any edge/REST probe) =
  `REMOTE_SUPABASE_SERVICE_ROLE_KEY` — NOT `SUPABASE_SERVICE_ROLE_KEY` (that's the local demo key).
- Validate with `npm run build`, NOT `validate-app.sh` (it hangs).
- CI runs a `gen types` drift check. Policy-only migrations don't change types, but if CI flags drift
  it's usually concurrent schema from other sessions — regenerate
  `npx supabase gen types typescript --project-id pcyaqwodnyrpkaiojnpz > src/types/database.types.ts`,
  prettier it, confirm additive, commit.
- The `/admin` query is already RPC-served, so use `EXPLAIN` directly (not the live page) for the proof.
- Orientation (read-only): `../_knowledge-vault/wiki/commission-tracker/security-multi-tenancy.md`
  ("RLS planning-time hardening" subsection summarizes Phase 1).

## First step

Dump the SELECT quals for `pipeline_automations`, `pipeline_phases`, `pipeline_templates`, then report
your consolidation approach before writing any migration.
