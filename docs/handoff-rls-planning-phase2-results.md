# RLS Planning-Time Hardening — Phase 2 Results & Phase 3 Handoff

Dated 2026-05-28. Status: **Phase 2 authorized scope complete, applied to local + remote, committed on branch `perf/phase2-rls-pipeline-select-consolidation` — NOT merged to `main`** (awaiting user approval after code review). Continues the Phase 1 `user_profiles` SELECT consolidation documented in `security-multi-tenancy` (RLS planning-time hardening, 2026-05-28).

## Goal

Remove the residual ~5,015 ms RLS *planning* time (Postgres planner, not execution) that survived Phase 1. Root cause is the same: tables with many overlapping permissive SELECT policies make the planner expand each policy recursively, and these `pipeline_*` tables also `EXISTS`-subquery each other and `user_profiles`, so the bloat compounds.

## What was done

Consolidated each table's multiple permissive `cmd=SELECT` policies into ONE `<table>_select_consolidated` policy whose `USING` is the faithful boolean `OR` of all originals:

| table | SELECT policies | migration |
|---|---|---|
| `pipeline_templates` | 6 → 1 | `20260528161658_consolidate_pipeline_templates_select_policies.sql` |
| `pipeline_phases` | 6 → 1 | `20260528161934_consolidate_pipeline_phases_select_policies.sql` |
| `pipeline_automations` | 4 → 1 | `20260528162126_consolidate_pipeline_automations_select_policies.sql` |

Method (reused from Phase 1, hardened):

- Each consolidated `USING` was **machine-generated verbatim from `pg_policies.qual`** via `string_agg('(' || qual || ')', ' OR ')` — zero hand-transcription, so silently dropping/narrowing a qualifier is structurally impossible.
- The permissive `FOR ALL` policies (`*_imo_admin_*`, `*_super_admin`) and the RESTRICTIVE `revocation_deny` were **left in place** — they still apply to SELECT, so row-set equivalence is preserved.
- Consolidated policy created `TO authenticated` (Phase 1 idiom). Some originals were `TO public`; every such qual is `auth.uid()`-dependent (empty for anon), verified safe by an anon probe. The `pipeline_phases` `pt.imo_id IS NULL` branches look anon-reachable but are gated by the inner RLS-filtered `pipeline_templates` EXISTS (now `TO authenticated` only) — documented inline in that migration.
- Matching rollbacks under `supabase/migrations/_rollback/` restore the originals with their exact roles and quals.

## Safety gate (mandatory equivalence harness)

For each table, ran a `BEGIN…ROLLBACK` harness on **remote** (the real proof) + local: for each of the 115 live users **plus an anon probe**, hash the visible row-id set under OLD policies, apply the consolidation dynamically, re-hash, compare. **Result: 116 callers, 0 mismatches** for all three tables. Nothing was committed by the harness; the migration was applied separately only after 0 mismatches.

## Results — planning time (remote, `EXPLAIN ANALYZE`)

- `pipeline_templates` direct select: heavily bloated → **13.7 ms**
- `pipeline_phases` direct select: → **134.7 ms**
- `pipeline_automations` proof query (`phase_id IS NULL AND checklist_item_id IS NULL`): **5,505 → 4,180 ms** (super-admin); **6,465 ms** as a normal agent

The `pipeline_templates` / `pipeline_phases` pages — the user-visible fires — are fixed.

## Key finding — `pipeline_automations` residual is NOT fixable by SELECT consolidation (Phase 3)

`pipeline_automations` is a **leaf consumer** (nothing else `EXISTS`-subqueries it), so collapsing its SELECT policies does not reduce the total subplans the planner must build — every qual is still planned, just inside one OR. Its cost is **structural**: its policies nest `automations → pipeline_phases (134 ms) → pipeline_templates → user_profiles` roughly 8× across the permissive set, and Postgres plans every permissive policy regardless of which one matches at runtime. Folding the `FOR ALL` policies would be neutral-to-harmful (confirmed in review).

**Phase 3 lever (separate, higher-risk):** a `SECURITY DEFINER` visibility helper (e.g. `can_see_automation(phase_id, checklist_item_id, imo_id)`) so the policy is a flat function call and RLS does not expand the nested chain. This exceeds the "faithful OR consolidation" method of this plan and must be scoped + equivalence-proven on its own.

## Code review outcome

High-effort multi-angle review (security-auditor + database-expert agents). **Verdict: sound — zero correctness or security bugs.** Faithfulness, completeness, and role-grant safety all PASS; the `imo_id`-column concern was refuted (column exists; migrations applied cleanly). Noted (non-blocking): the harness only exercises disjuncts that have ≥1 live representative among the 115 users, but the soundness rests on the verbatim text-OR, not the 0-mismatch count alone. One clarifying comment was added to the `pipeline_phases` migration about anon-safety.

## Verification gates (all green)

- `scripts/check-revocation-gate-completeness.sql` = **0** on remote.
- `wipe-export-parity` vitest: **11/11** against remote.
- `npm run build`: clean. No `database.types.ts` change (policy-only).

## Remaining work / next steps

1. **User decision: merge `perf/phase2-rls-pipeline-select-consolidation` to `main`.** (Not pushed — only `main` deploys via Vercel; a policy-only migration has no runtime impact, the RLS change is already live on the DB.)
2. Optionally continue down the original Phase 2 list (`recruit_checklist_progress`, `recruit_phase_progress`, `pipeline_automation_logs`) using the same SELECT-consolidation method + harness.
3. **Phase 3:** the `SECURITY DEFINER` visibility-helper refactor for `pipeline_automations` if its planning time must drop below ~1,000 ms.

Source plan: `plans/active/continue-20260528-phase2-rls-policy-consolidation.md`.
