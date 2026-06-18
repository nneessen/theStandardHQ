-- 20260618125425_lock_down_app_config_anon_read.sql
--
-- FORWARD-PORT of 6a9e5e98 (branch fix/security-rls-audit-criticals, 2026-06-05),
-- re-timestamped onto current main. The original branch was 200+ commits behind
-- main and never merged; its companion guard migration
-- (20260605080009_guard_user_profiles_privileged_columns) DID reach main, but
-- this app_config lockdown did NOT. Verified absent: no REVOKE of app_config
-- grants exists anywhere in supabase/migrations on main.
--
-- CRITICAL: app_config stores the service-role key, which bypasses ALL RLS.
--
-- Proven on prod (SET ROLE anon): an anonymous caller can
--   SELECT value FROM app_config WHERE key = 'supabase_service_role_key';
-- because the table has a PERMISSIVE policy "Postgres can read config"
-- (role public, USING (true)) AND anon/authenticated hold a SELECT grant. Any
-- visitor with the public anon key (shipped in the frontend bundle) then gets
-- full read/write over every tenant.
--
-- The June-1 fix (20260601063530_drop_app_config_public_read_policy) only DROPPED
-- the policy; it was observed to REGRESS. This migration adds the durable defense:
-- strip the API-role grants so that even if a baseline/consolidation migration
-- recreates the policy, anon/authenticated still cannot read the table.
--
-- The row is NOT deleted. 6 SECURITY DEFINER postgres-owned functions read the key
-- to net.http_post to edge functions (invoke_account_lifecycle_daily,
-- invoke_ai_smart_view_sync, invoke_lead_heat_scoring,
-- invoke_slack_auto_complete_first_sale, invoke_slack_ip_leaderboard,
-- notify_slack_on_policy_insert); they run as postgres and bypass RLS/grants, so
-- they are unaffected. The "Service role can manage config" policy stays.
--
-- OWNER ACTIONS (cannot be done in SQL here):
--   1. ROTATE the service-role key in the Supabase dashboard (assume compromised)
--      and UPDATE app_config.value for 'supabase_service_role_key' in lockstep, or
--      the 6 functions above will 401.
--   2. Find and fix whatever migration recreates "Postgres can read config" so the
--      policy does not regress a third time.
--   3. Long-term: move the key to Supabase Vault so it never lives in public.*.

DROP POLICY IF EXISTS "Postgres can read config" ON public.app_config;

REVOKE ALL ON public.app_config FROM anon;
REVOKE ALL ON public.app_config FROM authenticated;
