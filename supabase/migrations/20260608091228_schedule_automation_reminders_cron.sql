-- Schedule the recruiting onboarding reminder automations to actually fire.
--
-- WHY: process-automation-reminders is deployed and processes the configurable
-- time-based automations (phase_stall, item_deadline_approaching, password_reminder),
-- but NO pg_cron job ever invokes it — so those automations are configurable in the
-- admin UI yet never run in production ("a button that does nothing"). This wires the
-- daily trigger. The edge function already de-dupes per day (unique_daily_automation),
-- so the first run is not a backlog blast.
--
-- HOW: mirrors the existing invoke_ai_smart_view_sync cron pattern — a SECURITY
-- DEFINER wrapper reads the project URL + service-role key from app_config and
-- net.http_post's the edge function (which authorizes on the service-role bearer).

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Idempotent re-runs: drop any prior schedule first.
SELECT cron.unschedule('process-automation-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-automation-reminders');

CREATE OR REPLACE FUNCTION public.invoke_automation_reminders()
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
  FROM app_config WHERE key = 'supabase_project_url';

  SELECT value INTO v_service_role_key
  FROM app_config WHERE key = 'supabase_service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE LOG 'automation-reminders: Missing app_config values; skipping';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/process-automation-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  RAISE LOG 'automation-reminders: Invoked edge function (request_id: %)', v_request_id;
END;
$$ LANGUAGE plpgsql;

-- Run once daily at 13:00 UTC (9am EDT / 8am EST) — a sensible morning send window.
SELECT cron.schedule(
  'process-automation-reminders',
  '0 13 * * *',
  'SELECT invoke_automation_reminders();'
);

COMMENT ON FUNCTION public.invoke_automation_reminders() IS
'Invokes the process-automation-reminders edge function (phase_stall,
item_deadline_approaching, password_reminder). Runs daily at 13:00 UTC via pg_cron.';
