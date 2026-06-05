-- 20260605080010_lock_down_app_config_anon_read.sql
--
-- CRITICAL: app_config exposes the service-role key to ANONYMOUS callers.
--
-- Proven on prod (SET ROLE anon): an anonymous caller can
--   SELECT value FROM app_config WHERE key = 'supabase_service_role_key';
-- because the table has a PERMISSIVE policy "Postgres can read config"
-- (role public, USING (true)) AND anon/authenticated hold a SELECT grant. The
-- service-role key bypasses ALL RLS, so any visitor with the public anon key
-- (shipped in the frontend bundle) gets full read/write over every tenant.
--
-- This is the June-1 incident (20260601063530_drop_app_config_public_read_policy)
-- REGRESSED — the policy is live again. The service-role key was never rotated.
--
-- FIX (this migration): remove the public-read policy and strip all direct table
-- privileges from the API roles. The row is NOT deleted: 6 SECURITY DEFINER
-- postgres-owned functions (invoke_account_lifecycle_daily, invoke_ai_smart_view_sync,
-- invoke_lead_heat_scoring, invoke_slack_auto_complete_first_sale,
-- invoke_slack_ip_leaderboard, notify_slack_on_policy_insert) read the key to
-- net.http_post to edge functions; they run as postgres and bypass RLS/grants, so
-- they are unaffected. The "Service role can manage config" policy stays.
--
-- The REVOKE is the durable line of defense: even if some baseline/consolidation
-- migration recreates the "Postgres can read config" policy again, no anon/
-- authenticated SELECT grant means no API read.
--
-- OWNER ACTIONS (cannot be done in SQL here):
--   1. ROTATE the service-role key in the Supabase dashboard (assume compromised)
--      and UPDATE app_config.value for 'supabase_service_role_key' to the new key
--      in lockstep, or the 6 functions above will 401.
--   2. Find and fix whatever migration recreates "Postgres can read config" so the
--      policy does not regress a third time.
--   3. Long-term: move the key to Supabase Vault so it never lives in public.*.

DROP POLICY IF EXISTS "Postgres can read config" ON public.app_config;

REVOKE ALL ON public.app_config FROM anon;
REVOKE ALL ON public.app_config FROM authenticated;
