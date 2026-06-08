-- Add imo_id to the workflow_events append-only log for tenant-aware auditing.
--
-- WHY: workflow_events records every emitted workflow event but had no imo_id, so the
-- log commingled tenants. (Active workflow MATCHING is already IMO-scoped in
-- trigger-workflow-event by the caller's IMO — this closes the observability gap and
-- lets new events be stamped going forward.)
--
-- Backfill is best-effort: resolve the user reference carried in context
-- (userId / agentId / recruitId / recruiterId) to that user's IMO. Text comparison
-- avoids casting non-uuid context values; rows whose context has no resolvable user
-- reference stay NULL. No FK — historical rows may reference since-deleted IMOs.

ALTER TABLE public.workflow_events ADD COLUMN IF NOT EXISTS imo_id uuid;

CREATE INDEX IF NOT EXISTS idx_workflow_events_imo_id ON public.workflow_events (imo_id);

UPDATE public.workflow_events we
   SET imo_id = up.imo_id
  FROM public.user_profiles up
 WHERE we.imo_id IS NULL
   AND up.id::text = COALESCE(
         we.context ->> 'userId',
         we.context ->> 'agentId',
         we.context ->> 'recruitId',
         we.context ->> 'recruiterId'
       );
