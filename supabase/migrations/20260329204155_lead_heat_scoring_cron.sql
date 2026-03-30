-- Lead Heat Index: scheduled scoring cron job
-- Runs every 30 minutes for all users with active Close CRM connections.
-- Calls the close-lead-heat-score edge function with action "score_all_users".

-- Unschedule if exists (idempotent)
SELECT cron.unschedule('lead-heat-scoring')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lead-heat-scoring');

-- Schedule lead heat scoring every 30 minutes
SELECT cron.schedule(
  'lead-heat-scoring',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := (SELECT value FROM app_config WHERE key = 'supabase_project_url') || '/functions/v1/close-lead-heat-score',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM app_config WHERE key = 'supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'action', 'score_all_users'
    )
  );
  $$
);
