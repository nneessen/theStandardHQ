-- Workflows Phase 2 (step 3) — schedule the async worker.
-- invoke_workflow_worker() POSTs to the process-pending-workflows edge function
-- via pg_net, wrapping the service-role key in a SECURITY DEFINER function so it
-- never lands in cron.job_run_details. Same app_config pattern as
-- invoke_account_lifecycle_daily / the lead-heat crons. The worker itself claims
-- a batch (SKIP LOCKED), invokes process-workflow per run, and reaps stale runs.
-- pg_cron's finest cron-syntax granularity is 1 minute; the enqueue-time kick in
-- trigger-workflow-event covers sub-minute latency.

CREATE OR REPLACE FUNCTION public.invoke_workflow_worker()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
  v_req bigint;
BEGIN
  SELECT value INTO v_url FROM app_config WHERE key = 'supabase_project_url';
  SELECT value INTO v_key FROM app_config WHERE key = 'supabase_service_role_key';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE LOG 'invoke_workflow_worker: missing app_config (supabase_project_url / supabase_service_role_key)';
    RETURN;
  END IF;

  SELECT net.http_post(
    url := v_url || '/functions/v1/process-pending-workflows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  ) INTO v_req;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.invoke_workflow_worker() FROM PUBLIC, anon, authenticated;

-- Reschedule idempotently — heartbeat every minute.
SELECT cron.unschedule('workflow-worker')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'workflow-worker');

SELECT cron.schedule(
  'workflow-worker',
  '* * * * *',
  'SELECT public.invoke_workflow_worker();'
);
