-- Schedule the AI Hot Leads Smart View sync to run daily at 7am EDT (11:00 UTC).
-- Syncs the top 100 AI-scored leads into a Close CRM Smart View per user.

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Unschedule if exists (idempotent re-runs)
SELECT cron.unschedule('sync-ai-hot-leads-view')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-ai-hot-leads-view');

-- Wrapper function that reads config from app_config
CREATE OR REPLACE FUNCTION invoke_ai_smart_view_sync()
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
    RAISE LOG 'ai-smart-view-sync: Missing app_config values';
    RETURN;
  END IF;

  -- Only invoke if at least one user has scored leads
  IF NOT EXISTS (
    SELECT 1 FROM lead_heat_scores LIMIT 1
  ) THEN
    RAISE LOG 'ai-smart-view-sync: No scored leads, skipping';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/close-ai-smart-view',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{"action": "sync_hot_leads_view"}'::jsonb
  ) INTO v_request_id;

  RAISE LOG 'ai-smart-view-sync: Invoked edge function (request_id: %)', v_request_id;
END;
$$ LANGUAGE plpgsql;

-- 7:00 AM EDT = 11:00 UTC (April-November DST)
-- 7:00 AM EST = 12:00 UTC (November-April standard)
-- Using 11:00 UTC for current EDT period
SELECT cron.schedule(
  'sync-ai-hot-leads-view',
  '0 11 * * *',
  'SELECT invoke_ai_smart_view_sync();'
);

COMMENT ON FUNCTION invoke_ai_smart_view_sync() IS
'Invokes the close-ai-smart-view edge function to sync top 100 AI-scored leads
into a Close CRM Smart View for each user. Runs daily at 7am EDT via pg_cron.';
