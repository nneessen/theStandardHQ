-- ============================================================================
-- Platform-sunset M-D — close the "no tell" leak in an anon SECURITY DEFINER RPC
-- ============================================================================
-- `get_imos_with_system_automations(text)` is a SECURITY DEFINER function that
-- returns `DISTINCT imo_id, name` for EVERY IMO with a matching active automation
-- (no `is_listed` / `access_revoked_at` filter). It carried explicit EXECUTE to
-- `anon` and `authenticated`, so a revoked (or pure-anon) caller could enumerate
-- other still-active tenants via PostgREST RPC — exactly the signal the sunset
-- flow must deny ("FFG must not be able to tell the platform continues for
-- others"). The 2026-05-28 re-review flagged this as the 8th public surface
-- Part 4 (20260527114910) missed.
--
-- FIX = REVOKE, not a body change. The function's ONLY caller is the
-- `process-automation-reminders` edge function, which runs as **service_role**
-- (createSupabaseAdminClient) and legitimately needs cross-IMO (incl. unlisted)
-- results — so adding an `is_listed`/revoked predicate would break it. Revoking
-- anon/authenticated closes the public surface while leaving the cron untouched,
-- and restores the function's original intent (migration 20260113_005 granted
-- service_role only; the anon/authenticated grants crept in later).
--
-- No `CREATE OR REPLACE` -> the function body/version is unchanged.
-- ============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_imos_with_system_automations(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_imos_with_system_automations(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_imos_with_system_automations(text) FROM authenticated;
-- service_role (and the postgres owner) retain EXECUTE; the cron is unaffected.

COMMIT;
