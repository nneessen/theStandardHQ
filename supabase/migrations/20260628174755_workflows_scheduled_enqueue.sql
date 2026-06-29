-- Workflows Phase 3 — wire up the `schedule` trigger.
--
-- WHY: the async-queue engine (20260616*) only EXECUTES runs that already exist as
-- workflow_runs rows (status='pending'). Event workflows get enqueued by
-- enqueue_workflow_event(); SCHEDULE workflows had NO enqueue path at all — nothing
-- ever inserted a run for trigger_type='schedule', so a scheduled workflow created
-- in the wizard never fired. This migration adds the missing enqueue half:
--   1. workflows.next_run_at — precomputed next fire instant (UTC).
--   2. compute_next_scheduled_run() — recurrence math from config.trigger.schedule.
--   3. set_workflow_next_run trigger — keeps next_run_at fresh on create/edit/activate.
--   4. enqueue_due_scheduled_workflows() — inserts one pending run per due workflow,
--      mirroring enqueue_workflow_event's run-row shape, then advances next_run_at.
--   5. workflows-scheduler cron (*/5) — pure-SQL; the existing workflow-worker cron
--      then drains the rows it enqueues within a minute.
-- The run-row is enqueued exactly like an event run so process-workflow handles it
-- unchanged; context carries workflowId (rate-limit scoping) + triggeredBy
-- (= created_by, used to resolve the owner profile / IMO for all_agents fan-out).

-- 1) Precomputed next fire instant (UTC). Nullable; only meaningful for schedules.
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz;

-- Efficient scan for the due query.
CREATE INDEX IF NOT EXISTS idx_workflows_due_schedule
  ON public.workflows (next_run_at)
  WHERE trigger_type = 'schedule' AND status = 'active';

-- 2) Recurrence math. Returns the next fire instant (UTC) strictly AFTER p_after,
--    or NULL when the schedule config is missing/unsupported (row never enqueues).
--    Reads config -> trigger -> schedule: { frequency, time 'HH:MM', timezone,
--    selectedDays[], dayOfWeek, intervalHours, dayOfMonth }.
CREATE OR REPLACE FUNCTION public.compute_next_scheduled_run(
  p_config jsonb,
  p_after  timestamptz
) RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_sched      jsonb := p_config -> 'trigger' -> 'schedule';
  v_freq       text;
  v_tz         text;
  v_time       time;
  v_interval_h integer;
  v_dom        integer;
  v_days       text[];
  v_local_now  timestamp;          -- wall-clock in the schedule's timezone
  v_cand       timestamp;          -- candidate local fire datetime
  v_offset     integer;
  v_dname      text;
BEGIN
  IF v_sched IS NULL OR jsonb_typeof(v_sched) <> 'object' THEN
    RETURN NULL;
  END IF;

  v_freq := lower(COALESCE(v_sched ->> 'frequency', 'daily'));
  v_tz   := COALESCE(NULLIF(v_sched ->> 'timezone', ''), 'UTC');

  -- Parse HH:MM (default 09:00). Bad value -> NULL (don't enqueue garbage).
  BEGIN
    v_time := (COALESCE(NULLIF(v_sched ->> 'time', ''), '09:00'))::time;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  -- Current wall-clock in the target tz. Invalid tz -> NULL.
  BEGIN
    v_local_now := p_after AT TIME ZONE v_tz;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  IF v_freq = 'hourly' THEN
    v_interval_h := GREATEST(1, COALESCE((v_sched ->> 'intervalHours')::integer, 1));
    v_cand := date_trunc('hour', v_local_now) + (v_interval_h || ' hours')::interval;
    WHILE v_cand <= v_local_now LOOP
      v_cand := v_cand + (v_interval_h || ' hours')::interval;
    END LOOP;

  ELSIF v_freq = 'daily' THEN
    v_cand := v_local_now::date + v_time;
    IF v_cand <= v_local_now THEN
      v_cand := (v_local_now::date + 1) + v_time;
    END IF;

  ELSIF v_freq = 'weekdays' THEN
    -- Next Mon–Fri occurrence of v_time.
    v_cand := v_local_now::date + v_time;
    IF v_cand <= v_local_now THEN
      v_cand := (v_local_now::date + 1) + v_time;
    END IF;
    WHILE extract(dow from v_cand) IN (0, 6) LOOP   -- 0=Sun, 6=Sat
      v_cand := (v_cand::date + 1) + v_time;
    END LOOP;

  ELSIF v_freq = 'weekly' THEN
    -- selectedDays (preferred) or a single dayOfWeek. Lowercase day names.
    IF v_sched ? 'selectedDays' AND jsonb_typeof(v_sched -> 'selectedDays') = 'array' THEN
      SELECT array_agg(lower(value)) INTO v_days
      FROM jsonb_array_elements_text(v_sched -> 'selectedDays');
    ELSIF NULLIF(v_sched ->> 'dayOfWeek', '') IS NOT NULL
          AND lower(v_sched ->> 'dayOfWeek') <> 'daily' THEN
      v_days := ARRAY[lower(v_sched ->> 'dayOfWeek')];
    END IF;

    IF v_days IS NULL OR array_length(v_days, 1) IS NULL THEN
      RETURN NULL;  -- weekly with no day selected -> never fires
    END IF;

    -- Soonest day (offset 0..7) whose name matches and whose fire time is future.
    FOR v_offset IN 0..7 LOOP
      v_cand  := (v_local_now::date + v_offset) + v_time;
      v_dname := lower(trim(to_char(v_local_now::date + v_offset, 'FMDay')));
      IF v_dname = ANY (v_days) AND v_cand > v_local_now THEN
        EXIT;
      END IF;
      v_cand := NULL;
    END LOOP;
    IF v_cand IS NULL THEN
      RETURN NULL;
    END IF;

  ELSIF v_freq = 'monthly' THEN
    v_dom  := GREATEST(1, LEAST(28, COALESCE((v_sched ->> 'dayOfMonth')::integer, 1)));
    v_cand := (date_trunc('month', v_local_now)::date + (v_dom - 1)) + v_time;
    IF v_cand <= v_local_now THEN
      v_cand := ((date_trunc('month', v_local_now) + interval '1 month')::date + (v_dom - 1)) + v_time;
    END IF;

  ELSE
    RETURN NULL;  -- unknown frequency
  END IF;

  -- Convert the local wall-clock candidate back to an absolute instant (UTC).
  RETURN v_cand AT TIME ZONE v_tz;
END;
$$;

-- 3) Keep next_run_at fresh. Recompute ONLY when the schedule itself changes
--    (config or status) or on INSERT — NEVER on the scheduler's own next_run_at
--    advancement (else schedules reset every 5 min and never fire).
CREATE OR REPLACE FUNCTION public.set_workflow_next_run()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.trigger_type = 'schedule' AND NEW.status = 'active' THEN
    IF TG_OP = 'INSERT'
       OR NEW.config IS DISTINCT FROM OLD.config
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.next_run_at := public.compute_next_scheduled_run(NEW.config, now());
    END IF;
  ELSIF NEW.trigger_type <> 'schedule' OR NEW.status <> 'active' THEN
    -- Paused/archived or converted away from schedule: clear so it can't enqueue.
    NEW.next_run_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_workflow_next_run ON public.workflows;
CREATE TRIGGER set_workflow_next_run
  BEFORE INSERT OR UPDATE ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_next_run();

-- 4) Enqueue all due scheduled workflows. SECURITY DEFINER; server-only.
--    SKIP LOCKED so overlapping scheduler ticks never double-process a row;
--    dedupe_key (partial unique index) is belt-and-suspenders against a duplicate
--    run for the same slot. next_run_at advancement past the fired slot is the
--    primary idempotency guard.
CREATE OR REPLACE FUNCTION public.enqueue_due_scheduled_workflows()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wf      record;
  v_run_id  uuid;
  v_ctx     jsonb;
  v_dedupe  text;
  v_count   integer := 0;
BEGIN
  FOR v_wf IN
    SELECT id, actions, imo_id, created_by, config, next_run_at
    FROM workflows
    WHERE trigger_type = 'schedule'
      AND status = 'active'
      AND next_run_at IS NOT NULL
      AND next_run_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    -- One run per workflow per fire-slot (minute granularity).
    v_dedupe := 'schedule:' || v_wf.id::text || ':'
                || to_char(v_wf.next_run_at, 'YYYYMMDD"T"HH24MI');

    v_ctx := jsonb_build_object(
      'workflowId',  v_wf.id,
      'triggeredBy', v_wf.created_by,   -- owner; resolves profile/IMO for all_agents
      'imo_id',      v_wf.imo_id,
      'triggeredAt', now(),
      'scheduled',   true,
      'depth',       0
    );

    INSERT INTO workflow_runs (
      workflow_id, imo_id, status, trigger_source, context,
      actions_snapshot, dedupe_key, scheduled_at
    ) VALUES (
      v_wf.id, v_wf.imo_id, 'pending', 'schedule', v_ctx,
      v_wf.actions, v_dedupe, v_wf.next_run_at
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_run_id;

    IF v_run_id IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;

    -- Advance past the just-fired slot. This UPDATE changes only next_run_at, so the
    -- set_workflow_next_run guard (config/status unchanged) is false and leaves this
    -- value intact.
    UPDATE workflows
    SET next_run_at = public.compute_next_scheduled_run(v_wf.config, now())
    WHERE id = v_wf.id;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_next_scheduled_run(jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_due_scheduled_workflows()              FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enqueue_due_scheduled_workflows()              TO service_role;

-- 5) Backfill existing active schedule workflows so they start firing.
UPDATE public.workflows
SET next_run_at = public.compute_next_scheduled_run(config, now())
WHERE trigger_type = 'schedule' AND status = 'active';

-- 6) Schedule the pure-SQL enqueuer every 5 minutes (idempotent reschedule).
SELECT cron.unschedule('workflows-scheduler')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'workflows-scheduler');

SELECT cron.schedule(
  'workflows-scheduler',
  '*/5 * * * *',
  'SELECT public.enqueue_due_scheduled_workflows();'
);
