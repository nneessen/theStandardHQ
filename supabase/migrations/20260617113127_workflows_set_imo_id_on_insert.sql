-- Workflows: guarantee every workflow row gets an imo_id (tenant) on insert.
--
-- BUG (prod-blocking): workflowService.createWorkflow never set imo_id and the
-- workflows.imo_id column has no DEFAULT and no trigger, so every workflow was
-- created tenant-less (imo_id = NULL). The process-workflow edge function's
-- tenant-ownership guard requires `workflow.imo_id == caller's
-- user_profiles.imo_id`, so it rejected EVERY run with 403 "workflow belongs to
-- another IMO". (Surfaced once the async-queue security hardening shipped.)
--
-- FIX: a BEFORE INSERT trigger that, when imo_id is NULL, fills it from the
-- creator's profile (the SAME source the guard reads — user_profiles.imo_id of
-- created_by / auth.uid()), so the two always match. Covers every insert path,
-- not just the wizard. Plus a one-time backfill of existing tenant-less rows.

CREATE OR REPLACE FUNCTION public.set_workflow_imo_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.imo_id IS NULL THEN
    SELECT imo_id INTO NEW.imo_id
    FROM public.user_profiles
    WHERE id = COALESCE(NEW.created_by, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_workflow_imo_id ON public.workflows;
CREATE TRIGGER trg_set_workflow_imo_id
  BEFORE INSERT ON public.workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workflow_imo_id();

-- Backfill existing tenant-less workflows from their creator's profile.
UPDATE public.workflows w
SET imo_id = up.imo_id
FROM public.user_profiles up
WHERE w.imo_id IS NULL
  AND up.id = w.created_by
  AND up.imo_id IS NOT NULL;
