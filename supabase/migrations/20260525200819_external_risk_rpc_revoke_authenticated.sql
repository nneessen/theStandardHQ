-- ============================================================================
-- External-risk RPC triage (2026-05-25): revoke anon/authenticated EXECUTE
-- ============================================================================
--
-- Follow-on to the Epic Life isolation sweep. These 25 SECURITY DEFINER functions
-- were classified `external-risk` in the Feb-14 RPC trace (granted anon/authenticated
-- but 0 proven internal callers). Fresh preflight (2026-05-25, against remote)
-- re-verified each:
--   * ZERO runtime callers in src/ + supabase/functions/ (literal AND bare-name
--     grep, excluding the generated database.types.ts and the trace file), OR
--     only an edge-function caller that uses SUPABASE_SERVICE_ROLE_KEY.
--   * ZERO references in any RLS policy (pg_policy), any other function body, or
--     any view definition across the whole DB.
-- A SECURITY DEFINER function granted to `authenticated` is callable by any logged-in
-- user via PostgREST regardless of whether the app uses it; several here take a
-- trusted `imo_id`/`user_id`/`agency_id` arg with no tenant gate (get_message_stats,
-- get_templates_for_platform, set_default_decision_tree, get_active_decision_tree,
-- get_agent stats reports) — a latent cross-tenant read/write surface.
--
-- Revoking from anon/authenticated removes that surface with zero functional risk;
-- service_role retains EXECUTE so edge functions / cron / future internal callers
-- (and SECURITY DEFINER wrappers, which run as the owner) keep working. Fully
-- reversible — re-GRANT to authenticated if a function is later wired to the UI.
-- Mirrors the cron-triage migration 20260524083310.
--
-- Edge-function callers verified service_role:
--   check_and_update_milestones   -> slack-policy-notification
--   check_workflow_email_rate_limit -> process-workflow
--   get_due_alert_rules           -> evaluate-alerts
--
-- is_same_imo: genuine orphan (0 callers, 0 RLS, 0 deps) — flagged in handoff.
--   (Sibling is_same_agency is LEFT ALONE: it backs 2 live RLS policies on
--    agent_state_licenses / agent_writing_numbers and must keep its grant.)
-- ============================================================================

BEGIN;

-- Bucket B — tenant-scoped report getters with no UI caller
REVOKE EXECUTE ON FUNCTION public.get_message_stats(p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_message_stats(p_user_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_templates_for_platform(p_imo_id uuid, p_user_id uuid, p_platform text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_templates_for_platform(p_imo_id uuid, p_user_id uuid, p_platform text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_carrier_performance() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_carrier_performance() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_daily_production(p_start_date date, p_end_date date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_daily_production(p_start_date date, p_end_date date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_product_performance() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_product_performance() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_all_expense_categories() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_all_expense_categories() TO service_role;

-- Bucket C — orphan / self-boolean helpers with no caller, RLS dep, or fn dep
REVOKE EXECUTE ON FUNCTION public.is_same_imo(target_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_same_imo(target_user_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.has_subscription_bypass() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.has_subscription_bypass() TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_underwriting_wizard_enabled(p_agency_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_underwriting_wizard_enabled(p_agency_id uuid) TO service_role;

-- Bucket D — self-scoped, no caller
REVOKE EXECUTE ON FUNCTION public.mark_thread_read(p_thread_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_thread_read(p_thread_id uuid) TO service_role;

-- Bucket E — mutations / getters with no UI caller (several take a trusted imo_id)
REVOKE EXECUTE ON FUNCTION public.approve_acceptance_rule(p_rule_id uuid, p_notes text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.approve_acceptance_rule(p_rule_id uuid, p_notes text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reject_acceptance_rule(p_rule_id uuid, p_notes text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reject_acceptance_rule(p_rule_id uuid, p_notes text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_default_decision_tree(p_tree_id uuid, p_imo_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_default_decision_tree(p_tree_id uuid, p_imo_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_active_decision_tree(p_imo_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_active_decision_tree(p_imo_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_leaderboard_title(p_log_id uuid, p_title text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_leaderboard_title(p_log_id uuid, p_title text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_template_usage(p_template_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.increment_template_usage(p_template_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_age_rules_from_products(p_carrier_id uuid, p_imo_id uuid, p_user_id uuid, p_product_ids uuid[], p_strategy text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.generate_age_rules_from_products(p_carrier_id uuid, p_imo_id uuid, p_user_id uuid, p_product_ids uuid[], p_strategy text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.validate_template_content_for_platform(p_content text, p_platform text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.validate_template_content_for_platform(p_content text, p_platform text) TO service_role;

-- Bucket F — cron/backend helpers (no caller, or edge-function service_role caller)
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_invitations() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_expired_invitations() TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_instagram_scheduled_messages() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_instagram_scheduled_messages() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_workflow_email_usage(p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_workflow_email_usage(p_user_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_system_labels(p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ensure_system_labels(p_user_id uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_and_update_milestones(p_log_id uuid, p_policy_count integer, p_total_ap numeric) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_and_update_milestones(p_log_id uuid, p_policy_count integer, p_total_ap numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_workflow_email_rate_limit(p_user_id uuid, p_workflow_id uuid, p_recipient_email text, p_recipient_count integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_workflow_email_rate_limit(p_user_id uuid, p_workflow_id uuid, p_recipient_email text, p_recipient_count integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_due_alert_rules(p_worker_id text, p_batch_size integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_due_alert_rules(p_worker_id text, p_batch_size integer) TO service_role;

COMMIT;
