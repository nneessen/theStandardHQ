-- Workflows — per-recipient send idempotency ledger.
--
-- The reaper (requeue_stale_workflow_runs) re-queues a run that stays 'running'
-- past its TTL. Without idempotency a reaped long all_agents send re-runs the
-- whole per-recipient loop from the top and DOUBLE-SENDS. This ledger records one
-- claim row per (run, action, channel, recipient); executeSendEmail / executeSendSms
-- claim BEFORE sending and skip any recipient already claimed by a prior attempt,
-- so a reaped retry resends to NO ONE already delivered. Successful sends keep
-- their claim; failed sends release it (so they remain retriable).
--
-- Chosen over "route through email_queue" because email_queue cannot carry the
-- workflow path's per-owner Gmail-vs-Mailgun provider selection, custom from /
-- replyTo, or a dedupe key — routing through it would regress those. This is the
-- surgical fix; a full email_queue fan-out remains a possible future scale effort.

CREATE TABLE IF NOT EXISTS public.workflow_send_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  action_order  integer NOT NULL,
  channel       text NOT NULL,        -- 'email' | 'sms'
  recipient     text NOT NULL,        -- email address or E.164 phone
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_send_log_claim_uniq UNIQUE (run_id, action_order, channel, recipient)
);

COMMENT ON TABLE public.workflow_send_log IS
  'Per-recipient idempotency ledger: one claim row per (run, action, channel, recipient) so a reaper-requeued run never double-sends.';

-- Server-only: the engine writes this with the service-role key. No anon/auth.
ALTER TABLE public.workflow_send_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workflow_send_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.workflow_send_log TO service_role;

-- Atomic claim: insert the claim row, returning TRUE only if THIS call created it
-- (nobody had claimed this recipient for this run+action+channel yet). A reaped
-- retry — or a concurrent second worker racing the original — gets FALSE and skips.
CREATE OR REPLACE FUNCTION public.claim_workflow_send(
  p_run_id       uuid,
  p_action_order integer,
  p_channel      text,
  p_recipient    text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  INSERT INTO workflow_send_log (run_id, action_order, channel, recipient)
  VALUES (p_run_id, p_action_order, p_channel, p_recipient)
  ON CONFLICT (run_id, action_order, channel, recipient) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_workflow_send(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_workflow_send(uuid, integer, text, text) TO service_role;

-- Defense-in-depth: raise the reaper visibility timeout from 5min to 15min so a
-- still-running large send is far less likely to be concurrently re-queued. The
-- ledger already makes re-queues SAFE; this just avoids redundant re-run churn.
CREATE OR REPLACE FUNCTION public.requeue_stale_workflow_runs(
  p_ttl          interval DEFAULT interval '15 minutes',
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

REVOKE EXECUTE ON FUNCTION public.requeue_stale_workflow_runs(interval, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_stale_workflow_runs(interval, integer) TO service_role;
