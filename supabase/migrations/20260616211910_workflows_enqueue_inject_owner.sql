-- Workflows engine fix (P2 prerequisite): inject the workflow OWNER into every
-- event-triggered run's context.
--
-- Bug: enqueue_workflow_event never put the workflow's owner (created_by) or name
-- into the run context. process-workflow's executeSendEmail/executeSendSms require
-- context.triggeredBy (the owner) to load the sender profile, so EVERY event →
-- email/SMS/notification action threw "No workflow owner ID in context" — meaning
-- event-triggered email automations have NEVER worked (the existing 11 events too).
-- This redefinition (base body from 20260616103953) adds created_by + name to the
-- match query and injects 'triggeredBy' + 'workflowName' into the run context.

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
    SELECT id, actions, imo_id, created_by, name
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

    -- Inject the run-scoped context: the emitted event payload PLUS the workflow's
    -- owner (triggeredBy) + name + the loop-guard depth. triggeredBy is what the
    -- engine uses to resolve the sender profile for email/SMS/notification actions.
    v_ctx := COALESCE(p_context, '{}'::jsonb) || jsonb_build_object(
               'eventName',    p_event_name,
               'workflowId',   v_wf.id,
               'workflowName', v_wf.name,
               'triggeredBy',  v_wf.created_by,
               'triggeredAt',  now(),
               'depth',        v_depth + 1
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

REVOKE EXECUTE ON FUNCTION public.enqueue_workflow_event(text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_workflow_event(text, uuid, jsonb, text) TO service_role;
