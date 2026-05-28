# Phase 2 — RLS policy consolidation (pipeline_* / recruit_*) — KICKOFF PROMPT

> Paste the block below into a fresh Claude Code session in this repo
> (`/Users/nickneessen/projects/commissionTracker`). It is self-contained.
> Everything under "REFERENCE" is the supporting detail.

---

## KICKOFF PROMPT (paste this)

You are continuing a multi-phase RLS performance fix in the commissionTracker repo (React 19 +
TypeScript + Supabase/Postgres). Work from the repo root `/Users/nickneessen/projects/commissionTracker`.
Start a new branch off `main`.

**The problem.** Several pages intermittently 500 with `canceling statement due to statement timeout`.
Root cause (proven via live `EXPLAIN`): **RLS policy bloat** — tables with many overlapping permissive
policies make Postgres' query *planner* (not execution) explode. A query on `pipeline_automations`
(24 rows) had **~26,000 ms PLANNING time**, <0.5s execution, because its policies subquery
`user_profiles`, which itself had 16 SELECT policies.

**What's already done (Phase 1, merged to `main`, CI green, live on prod + local):**
- `user_profiles`' 16 SELECT policies were consolidated into **1** equivalent policy (migration
  `supabase/migrations/20260528141931_consolidate_user_profiles_select_policies.sql`, rollback in
  `supabase/migrations/_rollback/`). Proven **row-set-identical for all 115 live users (0 mismatches)**
  before applying. Worst-query planning dropped **26,000 ms → 5,015 ms**; direct `user_profiles` select
  18.7 ms → 2.6 ms.
- A targeted `get_system_automations()` SECURITY DEFINER RPC (migration `20260528124737`) already
  serves the `/admin` automations query, so that page is not a fire.

**Your task (Phase 2).** Remove the **residual ~5,015 ms** — it's the *own* policy bloat of
`pipeline_automations` (15 policies), `pipeline_phases` (21), `pipeline_templates` (19), which
cross-reference each other, plus `recruit_phase_progress`/`recruit_checklist_progress` (18 each) and
`pipeline_automation_logs` (15). Consolidate each table's **SELECT** policies into one equivalent
policy, exactly as Phase 1 did. Start with `pipeline_automations` + `pipeline_phases` +
`pipeline_templates` (the proven-slow path). SELECT-first (it's what cross-table `EXISTS` triggers —
the perf driver); decide per-table whether UPDATE/DELETE are worth folding too.

**Method (reuse Phase 1 exactly):**
1. Dump each table's SELECT quals: `SELECT policyname, qual FROM pg_policies WHERE schemaname='public'
   AND tablename='<t>' AND cmd='SELECT'`.
2. Write ONE consolidated SELECT policy = faithful OR of all original quals, shared scope tail factored
   out once. Wrap `auth.uid()` as `(SELECT auth.uid())`; leave STABLE SECURITY DEFINER helpers
   (`get_my_imo_id`, `get_effective_imo_id`, `super_admin_in_scope`, `is_imo_admin`, …) bare so the
   planner hoists them. **Transcribe every per-policy qualifier faithfully** (Phase 1's `imo_staff`
   policy required `'agent' = ANY(roles)` — dropping such a clause broadens access = a leak).
3. Migration idiom (team standard, see `20260528141931_consolidate_user_profiles_select_policies.sql`
   and `20260521213701_harden_imo_scoped_operational.sql`): `DROP POLICY IF EXISTS "<each old>" ON
   public.<t>;` then one `CREATE POLICY <t>_select_consolidated ... FOR SELECT TO authenticated USING
   (<predicate>);`. Write a matching rollback in `supabase/migrations/_rollback/`.

**MANDATORY safety gate — exact row-set equivalence BEFORE applying (this is non-negotiable):**
Run the harness below entirely in `BEGIN…ROLLBACK` (nothing commits). For every one of the ~115 live
callers it hashes their visible row-id set of table T under the OLD policies, swaps to the consolidated
policy, re-hashes, and asserts **0 mismatches**. Run on LOCAL first (mechanics), then REMOTE (the real
proof). **Do not apply the migration if any caller mismatches** — that's a transcription bug.

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
-- >>> paste the migration's DROP POLICY ... + CREATE POLICY ... here (no BEGIN/COMMIT) <<<
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

**After equivalence passes:** apply via `./scripts/migrations/run-migration.sh FILE.sql` to BOTH local
AND remote (`source .env && DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh
FILE.sql`). Then prove the win: `EXPLAIN (ANALYZE) SELECT * FROM pipeline_automations WHERE phase_id IS
NULL AND checklist_item_id IS NULL` under the authenticated super-admin (set
`request.jwt.claims` sub = `d0d3edea-af6d-4990-80b8-1765ba829896`) — target well under 1,000 ms
planning (was 5,015). Re-run `scripts/check-revocation-gate-completeness.sql` (must stay **0**) and
`RUN_DB_TESTS=1 PARITY_DB_URL=$REMOTE_DATABASE_URL npx vitest run
src/features/sunset/__tests__/wipe-export-parity.test.ts`. `npm run build` (expect no type change —
policy-only). Commit on the branch and **STOP for explicit user approval before merging to `main`**.

**Hard rules / gotchas:**
- Migrations: ALWAYS `./scripts/migrations/run-migration.sh`, NEVER raw psql; apply to BOTH DBs.
- Remote service-role key for any edge/REST probe is `REMOTE_SUPABASE_SERVICE_ROLE_KEY` — NOT
  `SUPABASE_SERVICE_ROLE_KEY` (that's the local demo key). Remote DB URL is `REMOTE_DATABASE_URL`.
- Applying a migration to REMOTE makes the RLS change **live on prod immediately** (RLS is DB-layer) —
  the equivalence harness MUST pass on remote data first. Merging to `main` only lands the file in the
  repo (no Vercel/runtime impact; policy-only).
- After ANY change, `npm run build` (NOT `validate-app.sh` — it hangs). CI runs a `gen types` drift
  check; policy-only migrations don't change `database.types.ts`, but if CI flags drift it's usually
  concurrent schema from other sessions — regenerate `npx supabase gen types typescript --project-id
  pcyaqwodnyrpkaiojnpz > src/types/database.types.ts`, prettier it, confirm additive, commit.
- The `/admin` query is already RPC-served, so use `EXPLAIN` directly (not the live page) for the
  planning proof.

Begin by dumping the SELECT quals for `pipeline_automations`, `pipeline_phases`, `pipeline_templates`
and reporting your consolidation plan before writing any migration.

---

## REFERENCE — target tables (policy counts, `pg_policies`, 2026-05-28)

| table | total policies |
|---|---|
| `pipeline_phases` | 21 |
| `pipeline_templates` | 19 |
| `recruit_checklist_progress` | 18 |
| `recruit_phase_progress` | 18 |
| `pipeline_automation_logs` | 15 |
| `pipeline_automations` | 15 |

Expect **compounding** wins: these tables' policies do `EXISTS` subqueries against each other (and
against `phase_checklist_items`), so consolidating several de-amplifies the rest — like the
`user_profiles` consolidation already de-amplified all of them. Re-measure after the first 1–2 tables;
the residual may largely resolve before you finish the list.

Knowledge-vault context (read-only orientation): `../_knowledge-vault/wiki/commission-tracker/security-multi-tenancy.md`
(the "RLS planning-time hardening" subsection summarizes Phase 1).
