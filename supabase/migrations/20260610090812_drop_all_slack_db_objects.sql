-- Remove ALL Slack DB objects (per owner request: "all of Slack can be removed,
-- and other edge functions and RPC functions which are never going to be used").
--
-- Scope was verified against prod before writing this migration:
--   * 6 Slack tables + daily_sales_logs (the Slack daily-leaderboard log; its
--     columns are 100% Slack: slack_integration_id, channel_id, title,
--     first_seller_id, leaderboard_message_ts, ... and it is fully orphaned).
--   * 19 functions: Slack-named RPCs, the 4 Slack updated_at trigger fns, and
--     the orphaned Slack-leaderboard / first-sale-naming functions (confirmed
--     to have NO remaining caller outside generated database.types.ts).
--   * The policies INSERT trigger (notify_slack_on_policy_insert) — verified
--     Slack-only and non-blocking (always RETURN NEW), so dropping it cannot
--     affect policy creation.
--   * 2 pg_cron jobs.
--
-- KEPT (NOT Slack / shared): the get_*_leaderboard_data family (in-app
-- leaderboard), and wipe_user_business_data — which is fully defensive
-- (`IF to_regclass(...) IS NULL THEN skip`) and therefore tolerates the dropped
-- tables gracefully, so it does NOT need to be redefined.
--
-- Dependency check done: the only inbound FK to a dropped table from a non-
-- dropped table was daily_sales_logs -> slack_integrations; daily_sales_logs is
-- itself dropped, and it is dropped first below. No views depend on these tables.
--
-- NOTE: edge functions were deleted in code; they must also be undeployed from
-- prod via `supabase functions delete <name>`. database.types.ts will list these
-- dropped objects until regenerated from prod (stale type defs are harmless to
-- the build — they are unused).

BEGIN;

-- 1) Unschedule the Slack pg_cron jobs (guarded: local may not have pg_cron,
--    and unscheduling a non-existent job raises — so only act if present).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('slack-auto-complete-first-sale', 'slack-ip-leaderboard-weekly');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Slack cron unschedule skipped: %', SQLERRM;
END $$;

-- 2) Drop the Slack policies-insert trigger (before its function).
DROP TRIGGER IF EXISTS trigger_notify_slack_on_policy_insert ON public.policies;

-- 3) Drop tables. daily_sales_logs first (it FKs slack_integrations); the Slack
--    tables' own updated_at triggers drop with them. CASCADE here only clears
--    intra-Slack FK constraints (verified: no external dependents remain).
DROP TABLE IF EXISTS public.daily_sales_logs CASCADE;
DROP TABLE IF EXISTS public.slack_messages CASCADE;
DROP TABLE IF EXISTS public.slack_webhooks CASCADE;
DROP TABLE IF EXISTS public.slack_channel_configs CASCADE;
DROP TABLE IF EXISTS public.user_slack_preferences CASCADE;
DROP TABLE IF EXISTS public.agency_slack_credentials CASCADE;
DROP TABLE IF EXISTS public.slack_integrations CASCADE;

-- 4) Drop all Slack / orphaned-Slack-purpose functions (every overload by name).
DO $$
DECLARE
  fn   text;
  stmt text;
  names text[] := ARRAY[
    -- Slack-named RPCs
    'get_agency_slack_credentials',
    'get_slack_integrations_for_agency_hierarchy',
    'get_slack_leaderboard_with_periods',
    'invoke_slack_auto_complete_first_sale',
    'invoke_slack_ip_leaderboard',
    'notify_slack_on_policy_insert',
    -- Slack table updated_at trigger fns (triggers already gone with the tables)
    'update_slack_channel_configs_updated_at',
    'update_slack_integrations_updated_at',
    'update_slack_webhooks_updated_at',
    'update_user_slack_preferences_updated_at',
    -- Orphaned Slack-leaderboard / first-sale-naming fns (no remaining callers)
    'get_ip_leaderboard_with_periods',
    'get_daily_production_by_agent',
    'check_first_seller_naming_unified',
    'get_pending_first_sale_logs',
    'set_leaderboard_title',
    'set_leaderboard_title_batch',
    'update_daily_leaderboard_title',
    'check_and_update_milestones',
    'get_my_daily_sales_logs'
  ];
BEGIN
  FOREACH fn IN ARRAY names LOOP
    FOR stmt IN
      SELECT 'DROP FUNCTION IF EXISTS public.' || quote_ident(p.proname)
             || '(' || pg_get_function_identity_arguments(p.oid) || ');'
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE stmt;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

-- Verification: zero Slack tables / functions / cron jobs should remain.
SELECT 'tables_left' AS check, count(*) AS n FROM information_schema.tables
  WHERE table_schema='public' AND table_name ILIKE '%slack%';
SELECT 'daily_sales_logs_left' AS check, count(*) AS n FROM information_schema.tables
  WHERE table_schema='public' AND table_name='daily_sales_logs';
SELECT 'slack_fns_left' AS check, count(*) AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname ILIKE '%slack%';
