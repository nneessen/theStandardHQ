-- Drop the permissive public-read policy on app_config.
--
-- SECURITY (CRITICAL): "Postgres can read config" was FOR SELECT TO public USING (true),
-- and the anon role holds a SELECT grant on app_config. Combined, any unauthenticated
-- request with the public anon key could read app_config — which stores
-- supabase_service_role_key (a full-RLS-bypass credential). Verified externally
-- exploitable via `SET ROLE anon; SELECT ... FROM app_config`.
--
-- Safe to drop: the only readers of this key are SECURITY DEFINER functions owned by
-- postgres (invoke_account_lifecycle_daily, invoke_ai_smart_view_sync,
-- invoke_slack_auto_complete_first_sale, invoke_slack_ip_leaderboard,
-- notify_slack_on_policy_insert) which bypass RLS and never needed this policy.
-- The "Service role can manage config" policy remains for service_role access.
--
-- NOTE: the exposed key must still be ROTATED separately (treat as compromised);
-- this migration only stops future reads.

DROP POLICY IF EXISTS "Postgres can read config" ON public.app_config;
