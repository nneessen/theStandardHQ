-- Workflows Phase 2 (step 2) — durable async queue (SKIP LOCKED on workflow_runs).
--
-- NOTE on pgmq: the pgmq extension IS installed, but on Supabase the `pgmq`
-- schema is owned by supabase_admin and the migration role (`postgres`, not a
-- superuser) lacks CREATE on it, so queues cannot be created from a migration.
-- We therefore use the functional-equivalent pattern: the workflow_runs row IS
-- the queue entry (status='pending' = queued, 'running' = claimed). dequeue uses
-- SELECT ... FOR UPDATE SKIP LOCKED so many concurrent workers never double-claim.
-- This is fully migration-managed and needs no special privileges.
--
-- Decouples emission from execution: enqueue_workflow_event matches active
-- event-workflows (indexed), inserts one pending run per match with the authored
-- actions SNAPSHOTTED and a dedupe key for idempotency. No synchronous fan-out.

-- Retry/poison-pill capping for the worker + reaper.
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

-- 1) enqueue_workflow_event — insert-only match + enqueue.
CREATE OR REPLACE FUNCTION public.enqueue_workflow_event(
  p_event_name text,
  p_imo_id     uuid,
  p_context    jsonb DEFAULT '{}'::jsonb,
  p_dedupe_key text  DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_depth     integer := COALESCE((p_context ->> 'depth')::integer, 0);
  v_max_depth integer := 5;
  v_event_id  uuid;
  v_wf        record;
  v_run_id    uuid;
  v_dedupe    text;
  v_count     integer := 0;
  v_ctx       jsonb;
BEGIN
  -- Loop guard: stop runaway workflow -> event -> workflow recursion.
  IF v_depth >= v_max_depth THEN
    RAISE LOG 'enqueue_workflow_event: depth % >= max for %, dropping', v_depth, p_event_name;
    RETURN 0;
  END IF;

  -- Durable event log (one row per emitted event).
  INSERT INTO workflow_events (event_name, context, fired_at, imo_id, workflows_triggered)
  VALUES (p_event_name, p_context, now(), p_imo_id, 0)
  RETURNING id INTO v_event_id;

  -- Match active event-workflows. Tenant scope: NULL p_imo_id (system emit)
  -- matches all; otherwise only that IMO. Uses idx_workflows_event_match.
  FOR v_wf IN
    SELECT id, actions, imo_id
    FROM workflows
    WHERE status = 'active'
      AND trigger_type = 'event'
      AND trigger_event_name = p_event_name
      AND (p_imo_id IS NULL OR imo_id = p_imo_id)
  LOOP
    v_dedupe := CASE
                  WHEN p_dedupe_key IS NULL THEN NULL
                  ELSE v_wf.id::text || ':' || p_dedupe_key
                END;

    v_ctx := COALESCE(p_context, '{}'::jsonb) || jsonb_build_object(
               'eventName',  p_event_name,
               'workflowId', v_wf.id,
               'triggeredAt', now(),
               'depth',      v_depth + 1
             );

    INSERT INTO workflow_runs (
      workflow_id, imo_id, status, trigger_source, context,
      actions_snapshot, dedupe_key, scheduled_at
    ) VALUES (
      v_wf.id, v_wf.imo_id, 'pending', 'event:' || p_event_name, v_ctx,
      v_wf.actions, v_dedupe, now()
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_run_id;

    -- v_run_id is NULL when the dedupe key already produced a run (skip).
    IF v_run_id IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  UPDATE workflow_events SET workflows_triggered = v_count WHERE id = v_event_id;
  RETURN v_count;
END;
$$;

-- 2) dequeue_workflow_runs — atomically claim a batch of DUE pending runs.
--    FOR UPDATE SKIP LOCKED makes concurrent workers safe (no double-claim).
CREATE OR REPLACE FUNCTION public.dequeue_workflow_runs(p_batch integer DEFAULT 20)
RETURNS TABLE(run_id uuid, workflow_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT id
    FROM workflow_runs
    WHERE status = 'pending'
      AND (scheduled_at IS NULL OR scheduled_at <= now())
    ORDER BY scheduled_at NULLS FIRST, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_batch, 200))
  )
  UPDATE workflow_runs r
  SET status = 'running', started_at = now(), attempts = r.attempts + 1
  FROM due
  WHERE r.id = due.id
  RETURNING r.id, r.workflow_id;
$$;

-- 3) requeue_stale_workflow_runs — visibility-timeout reaper. Runs stuck in
--    'running' past the TTL (worker died / timed out) are re-queued, or
--    dead-lettered once they exhaust max attempts.
CREATE OR REPLACE FUNCTION public.requeue_stale_workflow_runs(
  p_ttl          interval DEFAULT interval '5 minutes',
  p_max_attempts integer  DEFAULT 5
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requeued integer;
BEGIN
  UPDATE workflow_runs
  SET status = 'failed',
      error_message = COALESCE(error_message, 'Exceeded max processing attempts'),
      completed_at = now()
  WHERE status = 'running'
    AND started_at < now() - p_ttl
    AND attempts >= p_max_attempts;

  UPDATE workflow_runs
  SET status = 'pending', scheduled_at = now()
  WHERE status = 'running'
    AND started_at < now() - p_ttl
    AND attempts < p_max_attempts;
  GET DIAGNOSTICS v_requeued = ROW_COUNT;

  RETURN v_requeued;
END;
$$;

-- 4) Server-only execution — the edge functions call these with the service-role
--    key; no anon/authenticated/PUBLIC access.
REVOKE EXECUTE ON FUNCTION public.enqueue_workflow_event(text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dequeue_workflow_runs(integer)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.requeue_stale_workflow_runs(interval, integer)  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_workflow_event(text, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.dequeue_workflow_runs(integer)                  TO service_role;
GRANT EXECUTE ON FUNCTION public.requeue_stale_workflow_runs(interval, integer)  TO service_role;
