-- Workflows Phase 2 (step 1) — schema for the async pgmq queue architecture.
-- Additive only; no behavior change yet (the engine/edge wiring lands next).

-- 1) Indexed event matching: a STORED generated column replaces the per-event
--    JSONB `config @> {trigger:{eventName}}` scan with an equality lookup.
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS trigger_event_name text
  GENERATED ALWAYS AS (config -> 'trigger' ->> 'eventName') STORED;

CREATE INDEX IF NOT EXISTS idx_workflows_event_match
  ON public.workflows (imo_id, status, trigger_event_name)
  WHERE trigger_type = 'event';

-- 2) workflow_runs: durable-queue + long-horizon columns.
--    Constant defaults (0/false) are metadata-only in PG11+ (no table rewrite).
--    scheduled_at is added NULL-able then given a default so existing rows are
--    NOT rewritten; the worker treats NULL as "due now".
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS imo_id uuid,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS resume_action_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actions_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS cancelled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dedupe_key text;

ALTER TABLE public.workflow_runs
  ALTER COLUMN scheduled_at SET DEFAULT now();

-- Backfill imo_id from the parent workflow (so existing runs are tenant-stamped).
UPDATE public.workflow_runs r
  SET imo_id = w.imo_id
  FROM public.workflows w
  WHERE r.workflow_id = w.id AND r.imo_id IS NULL;

-- Idempotency: at most one run per dedupe_key (a retried event can't double-run).
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_runs_dedupe
  ON public.workflow_runs (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Worker claim path: find due, pending runs cheaply.
CREATE INDEX IF NOT EXISTS idx_workflow_runs_due
  ON public.workflow_runs (scheduled_at)
  WHERE status = 'pending';
