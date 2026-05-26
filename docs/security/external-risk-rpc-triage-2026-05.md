# External-risk RPC triage (2026-05-25)

Follow-on to the Epic Life isolation sweep. Triages the 61 functions classified
`external-risk` in `docs/archive/rpc-removal-2026-02/rpc-trace-2026-02-14.tsv`
(0 internal refs in the Feb-14 trace, but granted to `anon`/`authenticated`).

## Step 0 preflight — fresh truth (run against REMOTE, 2026-05-25)

The Feb-14 trace was confirmed stale. Re-derived against live remote DB + current repo:

- **Security mode:** 60 of 61 are `SECURITY DEFINER`. The only `SECURITY INVOKER`
  (RLS-bounded, low risk) is `email_subject_hash`.
- **2 no longer exist on remote** (already dropped, stale trace):
  `check_first_seller_naming` (superseded by `_unified`),
  `process_lemon_subscription_event` (LemonSqueezy → Stripe migration).
- **3 already revoked to `service_role` only** (prior cron triage `20260524083310`
  and sibling): `get_agency_users_for_sms`, `get_password_reminder_users`,
  `get_pending_first_sale_logs`. → already resolved.
- **Function/view dependencies:** ZERO of the 61 are referenced by any other
  function body or view definition across the whole DB.
- **RLS-policy dependencies:** only **`is_same_agency`** is referenced — by 2
  policies on `agent_state_licenses` and `agent_writing_numbers`. Every other
  function (including `is_same_imo`) has **zero** RLS-policy references.
- **`is_same_imo` is a genuine orphan:** 0 runtime callers, 0 fn/view deps, 0 RLS
  refs. The handoff flagged this exact surprise. (Investigated below.)

Because there are no fn/view deps and only one RLS dependency, the **runtime caller
count (fresh repo grep) is the master signal** for the remaining functions.

## Master preflight table

Legend: rt = runtime callers in `src/` + `supabase/functions/` (literal `.rpc` refs);
sd = SECURITY DEFINER; scope = body references a scoping primitive
(`get_effective_imo_id`/`row_in_acting_scope`/`get_my_imo_id`/`auth.uid()`/`super_admin_in_scope`).

| Function | Bucket | rt | sd | scope | RLS | Lean |
|---|---|---|---|---|---|---|
| get_public_invitation_by_token | A | 2 | ✓ | – | – | KEEP anon, verify token-only |
| get_public_recruiter_info | A | 1 | ✓ | – | – | KEEP anon, verify |
| get_public_recruiting_theme | A | 2 | ✓ | – | – | KEEP anon, verify |
| submit_recruit_registration | A | 1 | ✓ | – | – | KEEP anon (hardened Mar-2026) |
| create_lead_from_instagram | A | 1 | ✓ | ✓ | – | KEEP, webhook payload validation |
| record_email_click | A | 0 | ✓ | – | – | KEEP anon (tracking), verify token |
| record_email_open | A | 0 | ✓ | – | – | KEEP anon (tracking), verify token |
| email_subject_hash | A | 0 | **INVOKER** | – | – | low risk; revoke anon |
| process_lemon_subscription_event | A | — | — | — | — | already DROPPED on remote |
| get_agency_performance_report | B | 2 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_agency_production_by_agent | B | 2 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_agency_recruiting_summary | B | 2 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_agency_weekly_production | B | 1 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_agent_daily_stats | B | 1 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_downline_expense_summary | B | 1 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_imo_expense_by_category | B | 1 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_lead_vendor_heat_metrics | B | 1 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_lead_vendor_policy_timeline | B | 1 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_recruiting_by_recruiter | B | 1 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_team_leaders_for_leaderboard | B | 1 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_imo_workflow_templates | B | 1 | ✓ | ✓ | – | KEEP, verify tenant gate |
| get_all_expense_categories | B | 0 | ✓ | ✓ | – | 0 callers → REVOKE/verify |
| get_user_carrier_performance | B | 0 | ✓ | ✓ | – | 0 callers → REVOKE/verify |
| get_user_daily_production | B | 0 | ✓ | ✓ | – | 0 callers → REVOKE/verify |
| get_user_product_performance | B | 0 | ✓ | ✓ | – | 0 callers → REVOKE/verify |
| get_message_stats | B | 0 | ✓ | – | – | 0 callers, NO scope → REVOKE |
| get_agency_users_for_sms | B | 1 | ✓ | – | – | already service_role-only |
| is_same_agency | C | 0 | ✓ | ✓ | **2** | KEEP (live RLS primitive) |
| is_same_imo | C | 0 | ✓ | ✓ | 0 | ORPHAN → REVOKE (drop candidate) |
| is_direct_downline_of_owner | C | 3 | ✓ | – | – | KEEP (used in code), verify |
| user_has_analytics_section | C | 2 | ✓ | – | – | KEEP (used), verify |
| has_subscription_bypass | C | 0 | ✓ | ✓ | 0 | 0 callers → REVOKE/verify |
| is_underwriting_wizard_enabled | C | 0 | ✓ | – | 0 | 0 callers → REVOKE/verify |
| get_my_notification_preferences | D | 1 | ✓ | ✓ | – | KEEP, verify auth.uid() |
| update_my_notification_preferences | D | 1 | ✓ | ✓ | – | KEEP, verify auth.uid() |
| create_notification | D | 7 | ✓ | – | – | KEEP (heavily used), verify |
| mark_thread_read | D | 0 | ✓ | – | – | 0 callers → REVOKE/verify |
| cascade_agency_assignment | E | 1 | ✓ | – | – | KEEP, verify role+IMO (mutates shared) |
| save_workflow_as_org_template | E | 1 | ✓ | ✓ | – | KEEP, verify |
| create_org_workflow_template | E | 1 | ✓ | ✓ | – | KEEP, verify |
| update_daily_leaderboard_title | E | 1 | ✓ | – | – | KEEP, verify role |
| approve_acceptance_rule | E | 0 | ✓ | ✓ | – | 0 callers → REVOKE/verify |
| reject_acceptance_rule | E | 0 | ✓ | ✓ | – | 0 callers → REVOKE/verify |
| set_default_decision_tree | E | 0 | ✓ | – | – | 0 callers → REVOKE |
| get_active_decision_tree | E | 0 | ✓ | – | – | 0 callers → REVOKE |
| set_leaderboard_title | E | 0 | ✓ | ✓ | – | 0 callers → REVOKE |
| increment_template_usage | E | 0 | ✓ | – | – | 0 callers → REVOKE |
| generate_age_rules_from_products | E | 0 | ✓ | – | – | 0 callers → REVOKE |
| validate_template_content_for_platform | E | 0 | ✓ | – | – | 0 callers → REVOKE |
| check_and_update_milestones | F | 1 | ✓ | – | – | REVOKE→service_role (verify edge caller) |
| check_workflow_email_rate_limit | F | 1 | ✓ | – | – | REVOKE→service_role (verify) |
| get_due_alert_rules | F | 1 | ✓ | – | – | REVOKE→service_role (verify) |
| check_first_seller_naming_unified | F | 1 | ✓ | – | – | REVOKE→service_role (verify) |
| cleanup_expired_invitations | F | 0 | ✓ | – | – | REVOKE→service_role |
| expire_instagram_scheduled_messages | F | 0 | ✓ | – | – | REVOKE→service_role |
| get_workflow_email_usage | F | 0 | ✓ | – | – | REVOKE→service_role |
| ensure_system_labels | F | 0 | ✓ | – | – | REVOKE→service_role |
| get_password_reminder_users | F | 1 | ✓ | – | – | already service_role-only |
| get_pending_first_sale_logs | F | 1 | ✓ | – | – | already service_role-only |
| check_first_seller_naming | F | — | — | — | — | already DROPPED on remote |

## Decisions & evidence

All 61 accounted for. Summary: **5 already resolved · 25 REVOKE · 1 GATE · 30 KEEP-verified.**

### Already resolved before this task (5)
- **DROPPED on remote** (stale trace): `check_first_seller_naming` (superseded by `_unified`),
  `process_lemon_subscription_event` (LemonSqueezy→Stripe).
- **Already `service_role`-only** (prior cron triage `20260524083310`): `get_agency_users_for_sms`,
  `get_password_reminder_users`, `get_pending_first_sale_logs`.

### REVOKE anon/authenticated → service_role (25) — migration `20260525200819`
0 runtime callers (or edge-only/service_role caller), 0 RLS/fn/view deps. Reversible.
- Bucket B (no UI caller): `get_message_stats`, `get_templates_for_platform`,
  `get_user_carrier_performance`, `get_user_daily_production`, `get_user_product_performance`,
  `get_all_expense_categories`
- Bucket C (orphan/self-boolean): `is_same_imo` (true orphan — 0 everywhere),
  `has_subscription_bypass`, `is_underwriting_wizard_enabled`
- Bucket D: `mark_thread_read`
- Bucket E: `approve_acceptance_rule`, `reject_acceptance_rule`, `set_default_decision_tree`,
  `get_active_decision_tree`, `set_leaderboard_title`, `increment_template_usage`,
  `generate_age_rules_from_products`, `validate_template_content_for_platform`
- Bucket F (cron/edge): `cleanup_expired_invitations`, `expire_instagram_scheduled_messages`,
  `get_workflow_email_usage`, `ensure_system_labels`, `check_and_update_milestones` (slack edge),
  `check_workflow_email_rate_limit` (process-workflow edge), `get_due_alert_rules` (evaluate-alerts edge)

### GATE — add missing authorization (1) — migration `20260525200820`
- **`cascade_agency_assignment`** — SECURITY DEFINER, granted `authenticated`, reassigned an owner +
  their entire downline's `imo_id`/`agency_id` with **NO caller check** → any authenticated user could
  yank an arbitrary subtree into any IMO (cross-tenant WRITE bypass, RLS-invisible). **The one genuine
  high-severity finding.** Added gate: caller must be super-admin, or an IMO admin whose acting scope
  (`row_in_acting_scope`) covers BOTH the target IMO and the owner's current IMO. Body reproduced verbatim.

### KEEP — verified adequately scoped (30)
- **Bucket A, public-by-design, keep anon (8):** `get_public_invitation_by_token`, `get_public_recruiter_info`,
  `get_public_recruiting_theme`, `submit_recruit_registration` (hardened Mar-2026), `create_lead_from_instagram`,
  `record_email_click`, `record_email_open`, `email_subject_hash` (SECURITY INVOKER → RLS-bounded).
  Relevant control is token/payload validation; these are public by design and not re-audited line-by-line this round.
- **Bucket B getters, verified tenant-gated (12):** the 12 with UI callers all gate correctly —
  `get_agency_performance_report`/`_production_by_agent`/`_recruiting_summary`/`_weekly_production`/`get_recruiting_by_recruiter`
  use `is_owner OR (is_imo_admin() AND get_my_imo_id()=agency_imo) OR is_super_admin()`;
  `get_downline_expense_summary`/`get_imo_expense_by_category`/`get_imo_workflow_templates`/`get_lead_vendor_heat_metrics`/`get_team_leaders_for_leaderboard`
  scope by `get_my_imo_id()`/`auth.uid()` with no spoofable id arg;
  `get_agent_daily_stats`/`get_lead_vendor_policy_timeline` use `get_effective_imo_id()`/`get_my_imo_id()` which
  pin a non-super-admin to their own IMO (the trusted arg is ignored). **No trust-the-arg bypass found** → no migration needed.
- **Bucket C, has callers (3):** `is_same_agency` (backs 2 live RLS policies — must keep grant),
  `is_direct_downline_of_owner`, `user_has_analytics_section`.
- **Bucket D, self-scoped (3):** `create_notification` (see minor finding), `get_my_notification_preferences`,
  `update_my_notification_preferences` (intentionally personal-config per `20260523071259`).
- **Bucket E, gated mutations w/ callers (3):** `save_workflow_as_org_template`, `create_org_workflow_template`
  (both `IF NOT is_imo_admin() THEN RAISE`), `update_daily_leaderboard_title` (first-seller check; see minor finding).
- **Bucket F, frontend caller (1):** `check_first_seller_naming_unified` (PolicyDashboard; Feb-12 outage culprit —
  body intentionally untouched).

### Minor findings — KEEP, future hardening recommended (not high-severity, deferred)
- `update_daily_leaderboard_title(p_log_id,p_title,p_user_id)`: checks `p_user_id` == log's first_seller but
  not `auth.uid() = p_user_id` → leaderboard-title spoof if attacker knows log_id + first_seller_id. Low severity.
- `create_notification(p_user_id,…)`: any authenticated user can create a notification for any user (injection,
  no data leak). Permissive by design for the workflow engine; recommend `row_in_acting_scope(target)` later.
- `check_first_seller_naming_unified(p_user_id)`: no `auth.uid()` check → minor info disclosure of another
  user's unnamed first-sale logs. NOT modified (slow-query outage history).

## Verification log

- **Grant flip (has_function_privilege, remote):** sampled `get_message_stats`, `get_templates_for_platform`,
  `set_default_decision_tree`, `check_and_update_milestones`, `is_same_imo` → `authenticated`=FALSE,
  `service_role`=TRUE. `cascade_agency_assignment` and `is_same_agency` correctly retain `authenticated`.
- **Edge callers intact:** `check_and_update_milestones` etc. retain `service_role` EXECUTE → slack /
  process-workflow / evaluate-alerts edge functions (all service_role) unaffected.
- **cascade gate, behavioral (mutation-free, BEGIN..ROLLBACK + non-existent UUIDs), remote:**
  - Normal FFG user → cross-IMO target: blocked (`Unauthorized: IMO admin role required`).
  - Normal FFG user → own-IMO target: blocked (`Unauthorized: IMO admin role required`).
  - Super-admin → reaches normal execution (`Owner not found`, no mutation) — gate correctly skipped.
  - (No FFG IMO-admin exists to exercise the `row_in_acting_scope` branch directly; that helper is the
    canonical gate already shipped/verified in Tier B `20260524081931`.)
  - Re-runnable via `scripts/verify-cascade-gate.sql`.
- **Full grant sweep:** all 25 REVOKE targets verified `authenticated`=FALSE / `service_role`=TRUE
  (0 rows still executable by `authenticated`).
- **Local DB:** Docker not running this session → migrations applied to REMOTE only; files in
  `supabase/migrations/` will apply to local on next `supabase start`/`db reset`. **ACTION: re-run both
  migrations against local when the stack is next up** (or `supabase db reset`).

## Watch-list / rollback hints for future sessions
- **cascade positive path:** an `imo_admin` cascading a same-IMO downline owner into a new agency passes
  (admin IMO = target IMO = owner.imo_id, all `row_in_acting_scope` true). Edge case: an owner with
  `imo_id IS NULL` (user onboarded into an agency *before* IMO assignment) → `row_in_acting_scope(NULL)`
  is false → denied. If `createAgencyWithCascade` is ever called in that ordering, this gate regresses;
  resolve the owner's IMO first or special-case NULL.
- **Highest-watch REVOKEs:** `is_underwriting_wizard_enabled`, `get_active_decision_tree`,
  `set_default_decision_tree` were rt=0 but recently touched (May-19 hardening) and tied to live features.
  If the UW wizard reports "disabled" or the decision-tree UI breaks after deploy, re-grant `authenticated`
  on the offending function (reversible) and add a runtime caller before re-revoking.
