# Continuation: Triage the 61 "external-risk" RPC functions

**Created:** 2026-05-25 19:40
**Origin:** Follow-on from the Epic Life isolation sweep (`continue-20260523_192650-epic-life-isolation-audit.md`, shipped 2026-05-24). The sweep proved the RLS layer was clean and that real leaks lived in ungated `SECURITY DEFINER` getters. This task closes the last unaddressed bucket from that same class.
**Status:** NOT STARTED
**Priority:** NEXT-UP security task, not backlog cleanup. Epic Life is live on prod, and this is the exact bug class (ungated `SECURITY DEFINER` + grant) that the May sweep just fought. The 61 are the last unaudited slice of that surface.

---

## The single discriminating signal: SECURITY DEFINER vs INVOKER

The "external-risk = bypass class" framing **only applies to `SECURITY DEFINER` functions.** A `SECURITY INVOKER` function (the default) runs as the *caller* and is naturally constrained by RLS on every table it touches — its grant is far lower risk. The Feb-14 trace does NOT carry this column, so do not assume all 61 are equally dangerous.

> **Rule of thumb:** `SECURITY DEFINER` + `authenticated` grant + no internal IMO/actor check = the bypass pattern (fix or revoke). `SECURITY INVOKER` = RLS-bounded, lower priority (usually verify-only).

Pull `prosecdef` first (Step 0d) and sort the 61 by it before doing anything else — it will immediately down-rank a chunk of Buckets E and F.

---

## Goal

Triage the **61 functions classified `external-risk`** in the RPC audit (`docs/archive/rpc-removal-2026-02/rpc-trace-2026-02-14.tsv`). "External-risk" = **0 internal refs in the Feb-14 trace, but granted to `anon` and/or `authenticated`** — i.e. callable from outside the repo with no proven internal authorization. This is the exact getter-bypass class the Epic sweep fixed: a `SECURITY DEFINER` function granted to `authenticated` with no internal `imo_id`/actor check is a cross-tenant read/write bypass that **RLS audits do not catch** (RLS green ≠ safe).

For each function, decide and apply ONE of three outcomes:
1. **KEEP grant + add internal authz check** — legitimately public or per-user, but currently trusts the caller. Add `get_effective_imo_id()` / `row_in_acting_scope()` / `auth.uid()` scoping, or token-only scoping for anon RPCs.
2. **REVOKE from anon/authenticated, GRANT to `service_role` only** — a backend/cron/edge-function helper that was over-granted. (Same move as migration `20260524083310` cron triage.)
3. **DROP** — genuinely dead AND ungranted-elsewhere. Only after a fresh preflight proves zero live callers.

---

## ⚠️ READ FIRST — the trace is STALE, do not trust it blind

The trace is dated **2026-02-14**. The DB and codebase have drifted ~3 months. **The `runtime_calls=0` column is wrong for an unknown number of these.** Verified on 2026-05-25: of 7 spot-checked "0 runtime_calls" functions, **3 are now live in code**:
- `submit_recruit_registration` → referenced (public recruit registration, hardened March 2026)
- `get_public_invitation_by_token` → 2 files
- `get_agency_performance_report` → 2 files

**Therefore: a fresh preflight is MANDATORY before any DROP or REVOKE.** Treat the buckets below as a starting hypothesis, not gospel. Re-derive runtime refs against current `src/` + `supabase/functions/`, and re-derive `sql_refs`/`trigger_refs` against the LIVE database (a boolean helper with 0 sql_refs in Feb may now be wired into an RLS policy → revoking it breaks reads silently).

---

## Step 0 — Fresh preflight (do this before touching anything)

For each candidate function, gather current truth:

```bash
# (a) runtime callers in repo (code may invoke via .rpc("name"))
grep -rn "\"<fn>\"\|'<fn>'" src/ supabase/functions/

# (b) LIVE sql/trigger/view dependencies — the trace missed these for helpers
./scripts/migrations/run-sql.sh "
  SELECT DISTINCT p2.proname AS referenced_by
  FROM pg_proc p1
  JOIN pg_depend d ON d.refobjid = p1.oid
  JOIN pg_proc p2 ON p2.oid = d.objid
  WHERE p1.proname = '<fn>';"

# (c) is it referenced in any RLS policy or view definition?
./scripts/migrations/run-sql.sh "
  SELECT polrelid::regclass, polname FROM pg_policy
  WHERE pg_get_expr(polqual, polrelid) ILIKE '%<fn>%'
     OR pg_get_expr(polwithcheck, polrelid) ILIKE '%<fn>%';"

# (d) confirm current grants + security mode + does the body already scope by imo?
./scripts/migrations/run-sql.sh "
  SELECT proname, prosecdef AS security_definer,
         array_to_string(proacl,', ') AS grants
  FROM pg_proc WHERE proname = '<fn>';"
./scripts/migrations/run-sql.sh "SELECT pg_get_functiondef('<fn>'::regproc);"
```

Step 0(d) also returns `prosecdef` — branch on it per the rule above: INVOKER functions are RLS-bounded, so for those the only question is whether the grant level is appropriate, not whether the body scopes by IMO.

A function is only DROP-eligible if (a)=0 AND (b)=0 AND (c)=0. If it has grants but no callers and no deps, prefer **REVOKE** over DROP (less risky, reversible, still closes the surface). If (d) shows the body already filters by `get_effective_imo_id()`/`auth.uid()`, it's lower priority — just confirm the grant scope is appropriate.

---

## The 61, pre-bucketed by hypothesis (verify each via Step 0)

### Bucket A — Public-by-design (anon-callable). KEEP grant; verify scope is token/input ONLY, never trusts caller IMO. (9)
`get_public_invitation_by_token` (LIVE), `get_public_recruiter_info`, `get_public_recruiting_theme`, `submit_recruit_registration` (LIVE, hardened Mar-2026), `create_lead_from_instagram`, `process_lemon_subscription_event`, `record_email_click`, `record_email_open`, `email_subject_hash`
→ Risk here is *input/token validation*, not IMO scoping. Confirm e.g. `get_public_invitation_by_token` returns only the row matching the token and leaks no neighbor data. Webhook RPCs (`process_lemon_subscription_event`, `create_lead_from_instagram`) should validate their payload signature/source.

### Bucket B — HIGH RISK tenant-scoped getters. Granted `authenticated`, return IMO/agency/agent data. MUST scope internally. (19)
`get_agency_performance_report` (LIVE), `get_agency_production_by_agent`, `get_agency_recruiting_summary`, `get_agency_weekly_production`, `get_agency_users_for_sms`, `get_user_carrier_performance`, `get_user_daily_production`, `get_user_product_performance`, `get_agent_daily_stats`, `get_downline_expense_summary`, `get_imo_expense_by_category`, `get_all_expense_categories`, `get_lead_vendor_heat_metrics`, `get_lead_vendor_policy_timeline`, `get_recruiting_by_recruiter`, `get_team_leaders_for_leaderboard`, `get_message_stats`, `get_imo_workflow_templates`, `get_templates_for_platform`
→ **This is the core of the task.** For each: does the body filter by `get_effective_imo_id()` (or `row_in_acting_scope()` / `assert_in_acting_scope()`)? If it takes an `imo_id`/`agency_id`/`agent_id` arg and trusts it without verifying the caller belongs to that scope → cross-tenant read bypass. Pattern to copy is exactly the leaderboard fix (`get_ip_leaderboard_with_periods`) and the Tier B getter wrappers from `20260524081931`.

### Bucket C — RLS predicate helpers (boolean). DANGER: likely SQL deps the Feb trace missed. (6)
`is_same_agency`, `is_same_imo`, `is_direct_downline_of_owner`, `has_subscription_bypass`, `user_has_analytics_section`, `is_underwriting_wizard_enabled`
→ **Do NOT revoke/drop without Step 0(c).** These read like RLS-policy building blocks. If wired into a policy, removing the grant or function breaks reads silently. Most likely outcome: **KEEP as-is** (they're `keep`-tier in reality, mis-binned by the static trace).
→ **`is_same_imo` / `is_same_agency` showing 0 refs would be genuinely surprising** — they look like core RLS primitives. If Step 0(c) returns empty for them, that is itself a finding: either the trace missed the dependency (likely) or they're orphans from a refactor (different fix). Pause and investigate before acting on those two.

### Bucket D — Self-scoped (auth.uid). Lower risk; confirm scoping. (4)
`get_my_notification_preferences`, `update_my_notification_preferences`, `create_notification`, `mark_thread_read`
→ Confirm they scope to `auth.uid()` and can't write/read another user's row via an id arg.

### Bucket E — Mutations granted to `authenticated`. Need actor/role checks. (12)
`approve_acceptance_rule`, `reject_acceptance_rule`, `set_default_decision_tree`, `get_active_decision_tree`, `set_leaderboard_title`, `update_daily_leaderboard_title`, `save_workflow_as_org_template`, `create_org_workflow_template`, `increment_template_usage`, `generate_age_rules_from_products`, `validate_template_content_for_platform`, `cascade_agency_assignment`
→ Any authenticated user can call these. Do they verify the caller is admin/owner of the affected IMO/agency? `approve/reject_acceptance_rule` and `cascade_agency_assignment` especially — these mutate shared config. Add role + IMO checks or revoke to service_role if they're backend-only.

### Bucket F — Batch/cron/backend helpers. Likely REVOKE to service_role only. (11)
`check_and_update_milestones`, `cleanup_expired_invitations`, `expire_instagram_scheduled_messages`, `check_workflow_email_rate_limit`, `get_workflow_email_usage`, `get_due_alert_rules`, `get_password_reminder_users`, `get_pending_first_sale_logs`, `check_first_seller_naming`, `check_first_seller_naming_unified`, `ensure_system_labels`
→ These smell like edge-function/cron internals. `get_password_reminder_users` returning a user list to `authenticated` is a real leak if so. Mirror the `20260524083310` triage: `REVOKE EXECUTE ... FROM authenticated; GRANT EXECUTE ... TO service_role;` after confirming only edge functions call them.
→ NOTE: `check_first_seller_naming_unified` was the Feb-12 DB-outage culprit (39s/call). Don't reintroduce it to hot paths; just fix its grant.

---

## Suggested execution order
1. **Bucket C first** (cheap, mostly "confirm KEEP") — clears 6 and de-risks the count.
2. **Bucket B** (highest security value) — the tenant getters. One migration, batch the `get_effective_imo_id()` guards.
3. **Bucket F** (clear pattern, copy the cron-triage migration).
4. **Bucket E** (per-function judgment on role checks).
5. **Buckets A & D last** (verify-only for most; minimal code change).

Batch the fixes into a few migrations by bucket, not 61 tiny ones. Follow the all-Fs/FFG fact: a normal user's `get_effective_imo_id()` already excludes FFG sentinel data; don't add `OR imo_id IS NULL` escapes (those were just dropped in `20260524083844`).

---

## Migration & deploy rules (NON-NEGOTIABLE — from CLAUDE.md + memory)
- Use the runner, NEVER raw psql: `./scripts/migrations/run-migration.sh supabase/migrations/<ts>_<name>.sql`
- Timestamp: `date +%Y%m%d%H%M%S`. Wrap each migration in `BEGIN;`/`COMMIT;` (runner's `psql -f` is not transactional → partial-apply on mid-file error).
- Apply to **BOTH** local and remote:
  ```bash
  ./scripts/migrations/run-migration.sh supabase/migrations/FILE.sql
  source .env && DATABASE_URL=$REMOTE_DATABASE_URL ./scripts/migrations/run-migration.sh supabase/migrations/FILE.sql
  ```
  Verify the "Target DB" banner each time. Claude runs migrations; the user never does.
- `LANGUAGE sql` bodies validate at CREATE → reproducing prod-shaped functions can fail on the schema-stale local DB. Validate function migrations via `BEGIN…ROLLBACK` dry-run against REMOTE first.
- If anything touches types/enums/policies: regenerate `src/types/database.types.ts`, fix type errors, `npm run build` (NOT validate-app.sh — it hangs).

## Verification (typecheck green is NOT verification — memory: `feedback_typecheck_is_not_verification`)
- Behavioral test with a **real Epic super-admin JWT** AND a **real FFG/normal-user JWT** (the sweep's method): cross-IMO calls must raise/return empty; own-scope calls must still work; catalog parity unchanged for FFG (14 carriers / 65 products / 910 comp rows baseline).
- For each REVOKEd function, confirm the legitimate caller (edge function / cron) still works after the grant change.
- An RLS audit query proves tables are protected; it does NOT prove these getters are scoped. Test the function call paths directly.

---

## Done criteria
- Every one of the 61 has a recorded decision (KEEP+check / REVOKE / DROP) with the Step-0 evidence that justified it.
- All applied to local + remote + pushed to `main` (production deploys from `main` ONLY).
- Behavioral verification passed with both JWTs.
- Write a findings doc `docs/security/external-risk-rpc-triage-2026-05.md`, then **sync the vault**: copy to `raw-sources/commission-tracker/`, fold into `wiki/commission-tracker/security-multi-tenancy.md` + `data-layer-rpc-migration.md` (this closes that wiki's "61 external-risk functions left with no remediation path" open question), append `log.md`, bump `index.md`, run `wiki-lint.sh -p commission-tracker` to 0.

## Key references
- Trace data: `docs/archive/rpc-removal-2026-02/rpc-trace-2026-02-14.tsv` (filter `risk_tier == external-risk`)
- Pattern migrations to copy: `20260524081931` (Tier B getter wrappers via `row_in_acting_scope`), `20260524083310` (cron grant triage), `20260522183721` (`get_effective_imo_id` / `super_admin_in_scope`)
- Helpers available: `get_effective_imo_id()`, `super_admin_in_scope(uuid)`, `row_in_acting_scope(...)`, `assert_in_acting_scope(...)`, `is_super_admin()`, `get_my_imo_id()`
- Memory: `project_super_admin_is_column_not_role`, `actingimoid-must-scope-reads`, `project_epic_life_imo_setup` (FFG = all-Fs sentinel), `feedback_typecheck_is_not_verification`
