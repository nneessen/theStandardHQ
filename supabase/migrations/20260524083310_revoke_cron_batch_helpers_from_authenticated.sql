-- ============================================================================
-- Cron/batch helper triage: revoke authenticated/anon EXECUTE
-- ============================================================================
--
-- Epic Life isolation audit part 3 (2026-05-24). These SECURITY DEFINER helpers
-- exist solely for scheduled/edge processing (alert evaluation, lapse/license/
-- threshold checks, first-sale logs, password reminders). They accept rule ids +
-- arbitrary user-id arrays / imo filters and return cross-tenant rows with NO
-- per-target tenant gate. They have:
--   * NO frontend caller (verified: zero references in src/, excluding generated
--     database.types.ts), and
--   * NO RLS-policy dependency (verified against pg_policies — unlike
--     get_downline_ids / get_user_upline_and_recruiter_ids, which are referenced
--     by user_profiles policies and must NOT be revoked).
-- Their only callers are service_role edge functions:
--   evaluate-alerts            -> lapse/license/threshold/policy-count/valid-users
--   slack-policy-notification  -> get_pending_first_sale_logs
--   process-automation-reminders -> get_password_reminder_users
-- (all instantiate the client with SUPABASE_SERVICE_ROLE_KEY).
--
-- Revoking from authenticated/anon removes the direct cross-tenant read surface
-- with zero functional risk; service_role retains EXECUTE.
-- ============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_policies_for_lapse_check(uuid, uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_policies_for_lapse_check(uuid, uuid[], integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_license_expirations_for_check(uuid, uuid[], integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_license_expirations_for_check(uuid, uuid[], integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_commissions_for_threshold_check(uuid, uuid[], date, date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_commissions_for_threshold_check(uuid, uuid[], date, date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_policy_counts_for_check(uuid, uuid[], date, date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_policy_counts_for_check(uuid, uuid[], date, date) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_pending_first_sale_logs(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_pending_first_sale_logs(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_password_reminder_users(integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_password_reminder_users(integer, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_valid_users_for_rule(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_valid_users_for_rule(uuid, uuid[]) TO service_role;

COMMIT;
