-- Workflows: make the async queue honor each workflow's `priority` setting.
--
-- BUG: the "Priority" slider in Workflow Settings saved to workflows.priority
-- (1-100, default 50) but the engine ignored it — dequeue_workflow_runs ordered
-- the pending queue ONLY by scheduled_at, created_at. Higher-priority workflows
-- were therefore not claimed before lower-priority ones, so the setting was inert.
--
-- FIX: order the dequeue batch by the workflow's priority (DESC) first, then by
-- the existing schedule/age tiebreakers. LEFT JOIN so a missing workflow row
-- still dequeues (treated as the default priority 50). Only the workflow_runs
-- rows are locked (FOR UPDATE OF r) so the schedule join never blocks the queue.
--
-- (max_runs_per_day is enforced in the process-workflow worker, not here.)

CREATE OR REPLACE FUNCTION public.dequeue_workflow_runs(p_batch integer DEFAULT 20)
 RETURNS TABLE(run_id uuid, workflow_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH due AS (
    SELECT r.id
    FROM workflow_runs r
    LEFT JOIN workflows w ON w.id = r.workflow_id
    WHERE r.status = 'pending'
      AND (r.scheduled_at IS NULL OR r.scheduled_at <= now())
    ORDER BY COALESCE(w.priority, 50) DESC, r.scheduled_at NULLS FIRST, r.created_at
    FOR UPDATE OF r SKIP LOCKED
    LIMIT GREATEST(1, LEAST(p_batch, 200))
  )
  UPDATE workflow_runs r
  SET status = 'running', started_at = now(), attempts = r.attempts + 1
  FROM due
  WHERE r.id = due.id
  RETURNING r.id, r.workflow_id;
$function$;
