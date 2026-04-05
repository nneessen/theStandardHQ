-- Migration E: Refactor lead-heat cron to use a SECURITY DEFINER wrapper function
--
-- Problem: The existing cron job uses inline SQL that embeds the service_role_key
-- lookup directly in the SQL command text. This key is visible in cron.job_run_details.
-- The smart view cron (20260403172200) already uses a wrapper function pattern.
--
-- Fix: Create invoke_lead_heat_scoring() wrapper, reschedule cron to use it.

CREATE OR REPLACE FUNCTION invoke_lead_heat_scoring()
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
    RAISE LOG 'lead-heat-scoring: Missing app_config values';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/close-lead-heat-score',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'action', 'score_all_users'
    )
  ) INTO v_request_id;
END;
$$ LANGUAGE plpgsql;

-- Unschedule the old inline-SQL cron job and reschedule with wrapper
SELECT cron.unschedule('lead-heat-scoring')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lead-heat-scoring');

SELECT cron.schedule(
  'lead-heat-scoring',
  '*/30 * * * *',
  'SELECT invoke_lead_heat_scoring();'
);

COMMENT ON FUNCTION invoke_lead_heat_scoring() IS
'Invokes the close-lead-heat-score edge function to score all users with active
Close CRM connections. Runs every 30 minutes via pg_cron. Wraps the service_role
key lookup in a SECURITY DEFINER function to avoid exposing it in cron.job_run_details.';
