# RPC Removal Safety Trace (Post-Fix)

Date: 2026-02-14

## What Was Fixed In Code

- Replaced stale admin RPC names with canonical names + legacy fallback in `src/services/users/UserRepository.ts`.
- Replaced direct `get_imo_clients_with_stats` call with canonical path + legacy fallback in `src/services/clients/client/ClientRepository.ts`.
- Removed dependency on missing `increment` RPC in `supabase/functions/gmail-sync-inbox/index.ts` by doing explicit counter updates.

## Updated Classification Summary

- Typed public RPCs: 328
- keep (runtime/script callsite and/or SQL dependency): 185
- external-risk (no internal refs but granted to anon/authenticated): 61
- candidate-high (no runtime refs, no SQL deps, no anon/auth grants): 82

## Remaining RPC Names Called But Missing From Typed Registry

- exec_sql (scripts only)
- get_table_row_count (scripts only)

## High-Confidence Removal Set For Staged Drops

After excluding canonical admin functions that are now called via fallback wrapper, removal set = 77.

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
- show_trgm
- table_rating_units
- test_rls_for_user
- units_to_table_rating
- update_override_earned_amount
- update_training_streak
- update_user_metadata
