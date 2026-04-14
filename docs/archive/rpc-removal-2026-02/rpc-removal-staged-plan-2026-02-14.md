# RPC Removal Staged Plan (Draft)

Date: 2026-02-14

> **STATUS: PARTIAL — ARCHIVED 2026-04-14.** Only Batch 00 (12 functions) was
> executed on 2026-02-27 via migration `20260227155357_drop_dead_functions.sql`
> (commit `4c190118`). Batches 01–07 (65 functions) were never processed. If
> resuming, re-run the preflight SQL below — this plan is 2+ months stale and
> the DB has drifted. See `STATUS.md` in this folder for details.

No DB drops were executed. This is the execution plan only.

## Guardrails

1. Run one batch at a time (max 10 functions), deploy, monitor 24-48h, then continue.
2. Before each batch, run preflight dependency checks against the live DB.
3. For each dropped batch, keep an immediate rollback migration ready.
4. Do not drop any function in the SQL-dependent (55) or external-risk (61) sets yet.

## Preflight SQL (Run Before Each Batch)

```sql
-- 1) Verify function still exists and inspect overload signatures
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY['<fn1>', '<fn2>']);

-- 2) Check dependency graph (views/functions/triggers/etc)
SELECT
  p.proname AS function_name,
  d.classid::regclass AS dependent_catalog,
  d.objid::regclass AS dependent_object,
  d.deptype
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_depend d ON d.refobjid = p.oid
WHERE n.nspname = 'public'
  AND p.proname = ANY (ARRAY['<fn1>', '<fn2>'])
ORDER BY p.proname;
```

## Drop SQL Template (Per Batch)

```sql
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY['<fn1>', '<fn2>', '<fn3>'])
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s);', r.nspname, r.proname, r.args);
  END LOOP;
END $$;
```

## Batch Sequence (77 Functions)

### Batch 00

- admin_delete_domain
- admin_get_user_by_id
- admin_update_user
- assign_user_role
- award_training_xp
- calculate_client_age
- calculate_earned_amount
- calculate_months_paid
- calculate_next_run_time
- calculate_premium

### Batch 01

- calculate_quiz_score
- calculate_unearned_amount
- can_manage_workflows
- can_request_agency
- can_run_uw_wizard
- can_view_agent_details
- check_email_exists
- check_email_quota
- check_module_completion
- check_training_badges

### Batch 02

- check_user_template_limit
- claim_instagram_jobs
- cleanup_expired_evaluation_logs
- cleanup_instagram_jobs
- cleanup_old_audit_logs
- cleanup_old_reports
- create_alert_notification_safe
- create_workflow_run
- expire_old_invitations
- get_agency_slack_credentials

### Batch 03

- get_agent_contract_summary
- get_approaching_deadline_items
- get_carrier_acceptance
- get_commissions_for_threshold_check
- get_current_user_profile_id
- get_due_scheduled_reports
- get_imo_contract_stats
- get_license_expirations_for_check
- get_pending_agency_request_count
- get_pending_join_request_count

### Batch 04

- get_pipeline_template_for_user
- get_policies_paginated
- get_policy_count
- get_policy_counts_for_check
- get_product_commission_rate
- get_product_rate
- get_role_permissions_with_inheritance
- get_schedule_delivery_history
- get_stale_phase_recruits
- get_sync_webhook_secret

### Batch 05

- get_user_addons
- get_user_commission_profile
- get_user_profile
- hard_delete_user
- health_class_rank
- increment_email_quota
- increment_uw_wizard_usage
- is_caller_admin
- is_contact_favorited
- is_training_module_manager

### Batch 06

- is_user_approved
- lookup_user_by_email
- mark_policy_cancelled
- mark_policy_lapsed
- process_pending_workflow_runs
- process_workflow_trigger
- rank_to_health_class
- recalculate_lead_purchase_roi
- refresh_all_report_materialized_views
- show_limit

### Batch 07

- show_trgm
- table_rating_units
- test_rls_for_user
- units_to_table_rating
- update_override_earned_amount
- update_training_streak
- update_user_metadata

## Manual Holdback

- Consider holding extension-owned functions (e.g. `show_limit`, `show_trgm`) unless DB ownership confirms they are custom.
