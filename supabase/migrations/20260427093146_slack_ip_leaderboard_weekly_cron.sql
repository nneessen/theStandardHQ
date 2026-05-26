-- Schedule the weekly IP + Submits leaderboard Slack post via pg_cron.
--
-- Mirrors `scripts/invoke-slack-ip-leaderboard.js` but runs server-side so it
-- doesn't depend on a developer's machine being awake.
--
-- Schedule: Sunday 23:00 UTC = 6pm EST (winter) / 7pm EDT (summer).
-- pg_cron has no DST awareness; UTC is the source of truth.
--
-- IMO: Founders Financial Group (ffffffff-ffff-ffff-ffff-ffffffffffff) —
-- matches the manual script. If a second IMO ever needs this report, refactor
-- the wrapper to loop over `imos`.
--
-- Pattern lifted from `invoke_lead_heat_scoring` (20260404193707) so the
-- service-role key stays out of cron.job_run_details.

CREATE OR REPLACE FUNCTION invoke_slack_ip_leaderboard()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT value INTO v_supabase_url
  FROM app_config
  WHERE key = 'supabase_project_url';

  SELECT value INTO v_service_role_key
  FROM app_config
  WHERE key = 'supabase_service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE LOG 'slack-ip-leaderboard: Missing app_config values';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/slack-ip-leaderboard',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'imoId', 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    )
  ) INTO v_request_id;
END;
$$ LANGUAGE plpgsql;

SELECT cron.unschedule('slack-ip-leaderboard-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'slack-ip-leaderboard-weekly');

SELECT cron.schedule(
  'slack-ip-leaderboard-weekly',
  '0 23 * * 0',
  'SELECT invoke_slack_ip_leaderboard();'
);

COMMENT ON FUNCTION invoke_slack_ip_leaderboard() IS
'Invokes slack-ip-leaderboard edge function for Founders Financial Group.
Scheduled weekly (Sun 23:00 UTC = 6pm EST / 7pm EDT) via pg_cron.
SECURITY DEFINER wrapper keeps the service-role key out of cron.job_run_details.';
