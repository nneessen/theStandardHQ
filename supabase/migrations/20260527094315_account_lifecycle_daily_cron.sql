-- ============================================================================
-- Migration G — daily account-lifecycle cron (DORMANT)
-- ============================================================================
-- Schedules account-lifecycle-cron once a day via pg_cron + pg_net, using the
-- same SECURITY DEFINER wrapper pattern as invoke_lead_heat_scoring()
-- (20260404193707) so the service_role key is never embedded in the cron command
-- text / cron.job_run_details.
--
-- The edge function drains pending export bundles, sends day-3/day-6 reminder
-- emails, auto-purges day-7 stragglers, and GCs 30-day recovery archives. While
-- no IMO is revoked, every one of those queries returns the empty set, so the
-- daily run is a cheap no-op — the cron ships DORMANT just like the rest of the
-- mechanism.
--
-- Requires app_config rows `supabase_project_url` + `supabase_service_role_key`
-- (already present; shared with the lead-heat + smart-view crons). If missing,
-- the wrapper logs and returns without firing.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.invoke_account_lifecycle_daily()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url      TEXT;
  v_service_role_key  TEXT;
  v_request_id        BIGINT;
BEGIN
  SELECT value INTO v_supabase_url
  FROM app_config
  WHERE key = 'supabase_project_url';

  SELECT value INTO v_service_role_key
  FROM app_config
  WHERE key = 'supabase_service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE LOG 'account-lifecycle-daily: Missing app_config values';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/account-lifecycle-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.invoke_account_lifecycle_daily() IS
'Invokes the account-lifecycle-cron edge function once daily via pg_cron. Wraps
the service_role key lookup in a SECURITY DEFINER function to keep it out of
cron.job_run_details. Part of the platform-sunset flow; no-op while no IMO is revoked.';

-- Reschedule idempotently. 09:15 UTC daily — off-peak, and offset from the
-- lead-heat (Mon 11:00) / smart-view crons so they don't pile onto pg_net.
SELECT cron.unschedule('account-lifecycle-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'account-lifecycle-daily');

SELECT cron.schedule(
  'account-lifecycle-daily',
  '15 9 * * *',
  'SELECT public.invoke_account_lifecycle_daily();'
);

COMMIT;
