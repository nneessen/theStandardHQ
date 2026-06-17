-- Workflows Phase 2 — fixes from the recall code review of the queue layer.
--   1) enqueue_workflow_event: malformed context.depth (non-numeric) threw during
--      the DECLARE cast and aborted (event lost). Parse it safely. Also isolate
--      each per-workflow insert in its own sub-block so one bad workflow does not
--      abort the whole fan-out (and the event log).
--   2) requeue_stale_workflow_runs: surfaced only the requeue count; dead-lettered
--      runs were invisible. Capture both; log the dead-letter count.
--   3) Re-seed trigger_event_types.available_variables to the corrected catalog
--      (dropped portal_link and the phase_* tags, which the engine never fills).

-- 1) enqueue_workflow_event ----------------------------------------------------
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
  v_depth_text text := p_context ->> 'depth';
  v_depth      integer := 0;
  v_max_depth  integer := 5;
  v_event_id   uuid;
  v_wf         record;
  v_run_id     uuid;
  v_dedupe     text;
  v_count      integer := 0;
  v_ctx        jsonb;
BEGIN
  -- Safe parse: malformed depth must not abort the function.
  IF v_depth_text ~ '^\d+$' THEN
    v_depth := v_depth_text::integer;
  END IF;

  -- Loop guard: stop runaway workflow -> event -> workflow recursion.
  IF v_depth >= v_max_depth THEN
    RAISE LOG 'enqueue_workflow_event: depth % >= max for %, dropping', v_depth, p_event_name;
    RETURN 0;
  END IF;

  -- Durable event log (one row per emitted event).
  INSERT INTO workflow_events (event_name, context, fired_at, imo_id, workflows_triggered)
  VALUES (p_event_name, p_context, now(), p_imo_id, 0)
  RETURNING id INTO v_event_id;

  -- Match active event-workflows. NULL p_imo_id (system emit) matches all;
  -- otherwise only that IMO. Uses idx_workflows_event_match.
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
               'eventName',   p_event_name,
               'workflowId',  v_wf.id,
               'triggeredAt', now(),
               'depth',       v_depth + 1
             );

    -- Isolate each insert: a single failing workflow must not lose the rest.
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'enqueue_workflow_event: failed to enqueue run for workflow %: %', v_wf.id, SQLERRM;
    END;
  END LOOP;

  UPDATE workflow_events SET workflows_triggered = v_count WHERE id = v_event_id;
  RETURN v_count;
END;
$$;

-- 2) requeue_stale_workflow_runs ----------------------------------------------
CREATE OR REPLACE FUNCTION public.requeue_stale_workflow_runs(
  p_ttl          interval DEFAULT interval '5 minutes',
  p_max_attempts integer  DEFAULT 5
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_failed   integer;
  v_requeued integer;
BEGIN
  UPDATE workflow_runs
  SET status = 'failed',
      error_message = COALESCE(error_message, 'Exceeded max processing attempts'),
      completed_at = now()
  WHERE status = 'running'
    AND started_at < now() - p_ttl
    AND attempts >= p_max_attempts;
  GET DIAGNOSTICS v_failed = ROW_COUNT;

  UPDATE workflow_runs
  SET status = 'pending', scheduled_at = now()
  WHERE status = 'running'
    AND started_at < now() - p_ttl
    AND attempts < p_max_attempts;
  GET DIAGNOSTICS v_requeued = ROW_COUNT;

  IF v_failed > 0 THEN
    RAISE LOG 'requeue_stale_workflow_runs: dead-lettered % run(s) past max attempts', v_failed;
  END IF;

  RETURN v_requeued;
END;
$$;

-- 3) Re-seed available_variables to the corrected catalog ----------------------
DO $$
DECLARE
  common  text[] := ARRAY[
    'user_name','user_first_name','user_last_name','user_email','company_name',
    'current_date','date_today','date_tomorrow','date_current_month',
    'date_current_year','app_url','workflow_name'];
  recruit text[] := ARRAY[
    'recruit_name','recruit_first_name','recruit_last_name','recruit_email',
    'recruit_phone','recruit_status','recruit_city','recruit_state',
    'recruit_contract_level'];
  agent   text[] := ARRAY['recruit_name','recruit_first_name','recruit_email'];
BEGIN
  UPDATE trigger_event_types
    SET available_variables = to_jsonb(recruit || common)
    WHERE event_name IN ('recruit.created','recruit.phase_changed',
                         'recruit.graduated_to_agent','recruit.dropped_out');

  UPDATE trigger_event_types
    SET available_variables = to_jsonb(agent || common)
    WHERE event_name IN ('policy.created','policy.cancelled','policy.renewed',
                         'commission.earned','commission.paid',
                         'commission.chargeback','lead.pack_purchased');
END $$;
