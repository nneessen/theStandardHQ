-- Fix compute_next_scheduled_run to match the ACTUAL wizard config shape.
--
-- WHY: 20260628174755 wrote compute_next_scheduled_run against an assumed config
-- shape (frequency / selectedDays / timezone). But the schedule wizard
-- (WorkflowTriggerSetup.tsx) writes ONLY `{ time, dayOfWeek }` — no `frequency`,
-- no `timezone`. So every UI-created schedule:
--   (a) COALESCEd frequency to 'daily' and IGNORED dayOfWeek → fired EVERY day
--       instead of e.g. only Mondays (and 'weekday' fired on weekends too), and
--   (b) had no timezone → defaulted to UTC → fired at HH:MM UTC, not local time.
-- This rewrite is driven by `dayOfWeek` (daily | weekday | monday..sunday — the
-- exact <option> values the wizard emits), matches weekdays by NUMERIC dow (no
-- lc_time/locale dependency), and defaults the timezone to America/New_York
-- (Eastern) when the config omits one. An optional `timezone` in config still wins
-- (the seeded reminder sets it explicitly). Unknown dayOfWeek → NULL (fail closed:
-- the row never enqueues) rather than silently firing daily.

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
  v_dow        text;       -- daily | weekday | monday..sunday
  v_tz         text;
  v_time       time;
  v_target_dow integer;    -- 0=Sun .. 6=Sat for a single-day schedule, else NULL
  v_local_now  timestamp;  -- wall-clock in the schedule's timezone
  v_cand       timestamp;  -- candidate local fire datetime
  v_offset     integer;
BEGIN
  IF v_sched IS NULL OR jsonb_typeof(v_sched) <> 'object' THEN
    RETURN NULL;
  END IF;

  -- Wizard writes dayOfWeek; tolerate a legacy `frequency` alias for the same words.
  v_dow := lower(COALESCE(NULLIF(v_sched ->> 'dayOfWeek', ''),
                          NULLIF(v_sched ->> 'frequency', ''),
                          'daily'));
  -- No timezone in the wizard config → default to Eastern (NOT UTC). Explicit wins.
  v_tz  := COALESCE(NULLIF(v_sched ->> 'timezone', ''), 'America/New_York');

  BEGIN
    v_time := (COALESCE(NULLIF(v_sched ->> 'time', ''), '09:00'))::time;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  BEGIN
    v_local_now := p_after AT TIME ZONE v_tz;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  v_target_dow := CASE v_dow
    WHEN 'sunday'    THEN 0
    WHEN 'monday'    THEN 1
    WHEN 'tuesday'   THEN 2
    WHEN 'wednesday' THEN 3
    WHEN 'thursday'  THEN 4
    WHEN 'friday'    THEN 5
    WHEN 'saturday'  THEN 6
    ELSE NULL
  END;

  IF v_dow = 'daily' THEN
    v_cand := v_local_now::date + v_time;
    IF v_cand <= v_local_now THEN
      v_cand := (v_local_now::date + 1) + v_time;
    END IF;

  ELSIF v_dow IN ('weekday', 'weekdays') THEN
    -- Next Mon–Fri occurrence of v_time (numeric dow: 0=Sun, 6=Sat).
    v_cand := v_local_now::date + v_time;
    IF v_cand <= v_local_now THEN
      v_cand := (v_local_now::date + 1) + v_time;
    END IF;
    WHILE extract(dow from v_cand) IN (0, 6) LOOP
      v_cand := (v_cand::date + 1) + v_time;
    END LOOP;

  ELSIF v_target_dow IS NOT NULL THEN
    -- Weekly on a single named day. Soonest offset 0..7 whose dow matches and whose
    -- fire time is still in the future.
    v_cand := NULL;
    FOR v_offset IN 0..7 LOOP
      IF extract(dow from (v_local_now::date + v_offset))::int = v_target_dow
         AND ((v_local_now::date + v_offset) + v_time) > v_local_now THEN
        v_cand := (v_local_now::date + v_offset) + v_time;
        EXIT;
      END IF;
    END LOOP;
    IF v_cand IS NULL THEN
      RETURN NULL;
    END IF;

  ELSE
    -- Unknown dayOfWeek → fail closed (never enqueue) rather than fire daily.
    RETURN NULL;
  END IF;

  RETURN v_cand AT TIME ZONE v_tz;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.compute_next_scheduled_run(jsonb, timestamptz) FROM PUBLIC, anon, authenticated;

-- Recompute next_run_at for any active schedules using the corrected logic.
UPDATE public.workflows
SET next_run_at = public.compute_next_scheduled_run(config, now())
WHERE trigger_type = 'schedule' AND status = 'active';
