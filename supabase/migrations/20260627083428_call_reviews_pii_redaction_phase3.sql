-- ============================================================================
-- Call Reviews — PII redaction, Phase 3: review/approve guard
-- ============================================================================
-- Phase 3 re-shares a recording IMO-wide (redaction_status='approved') and
-- destroys the raw original. A single mistake re-exposes spoken client SSN /
-- banking data, so the approval path is enforced at the DB layer by a trigger —
-- NOT only in the edge function. Assume any owner/admin token can PATCH PostgREST
-- directly and bypass the edge fn; the trigger is the guarantee.
--
-- This migration:
--   A. adds the review/version columns.
--   B. creates kpi_call_recordings_redaction_guard, a BEFORE INSERT OR UPDATE
--      trigger enforcing:
--        • INSERT: redaction_status may NOT be 'approved' (a never-redacted row
--          could otherwise be self-shared via the FOR ALL _rw policy, whose
--          WITH CHECK constrains only imo_id/ownership, never redaction_status —
--          a BEFORE UPDATE trigger never fires on INSERT, so this branch closes
--          the Phase-0 hole on the insert path).
--        • UPDATE worker-binding: only the service-role audio-worker (auth.uid()
--          IS NULL) may DECLARE muting complete (audio_redaction_status→'done'),
--          bump muted_spans_version, or set redacted_storage_path. A human/admin
--          PATCH cannot forge "muting is current" to sneak an unmuted file past
--          approval.
--        • UPDATE span re-arm: any change to redaction_spans bumps spans_version
--          and forces audio_redaction_status='pending' (clock-free "muting is
--          current" proof). User-initiated span edits require admin; service-role
--          (transcribe/backfill) edits pass. Spans cannot be edited once approved.
--        • UPDATE →approved gate: only from needs_review, by an authenticated IMO
--          admin / in-scope super-admin, with detection run, audio muted & current
--          (muted_spans_version = spans_version). Every other transition (incl.
--          LEAVING approved) only ever un-shares and is allowed.
--
-- 'rejected' is a new redaction_status value (TS-enforced; no CHECK per project
-- rule "no CHECK constraints on enums"). pii_reviewed_by is a plain UUID (matches
-- the existing archived_by convention; no auth.users FK to avoid coupling user
-- deletion to recordings).
--
-- Mirrors the helper semantics the RLS policies already use (is_imo_admin,
-- super_admin_in_scope, get_my_imo_id) so trigger and policy can't disagree.
-- ============================================================================

BEGIN;

-- ── A. Review / version columns ─────────────────────────────────────────────
ALTER TABLE public.kpi_call_recordings
  ADD COLUMN IF NOT EXISTS pii_reviewed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pii_reviewed_by     UUID,
  ADD COLUMN IF NOT EXISTS raw_audio_purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS spans_version       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS muted_spans_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.kpi_call_recordings.spans_version IS
  'Bumped by the redaction guard trigger whenever redaction_spans changes. The mute is "current" iff muted_spans_version = spans_version.';
COMMENT ON COLUMN public.kpi_call_recordings.muted_spans_version IS
  'The spans_version the audio-worker actually muted (echoed back with audio_redaction_status=done). Only the service-role worker may set it.';

-- ── B. Approval guard trigger ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kpi_call_recordings_redaction_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- ── INSERT: never accept a pre-approved row ───────────────────────────────
  -- Legit uploads insert with the default 'pending' (no src code sets the
  -- column). A BEFORE UPDATE trigger can't fire here, so guard it explicitly.
  IF TG_OP = 'INSERT' THEN
    IF NEW.redaction_status = 'approved' THEN
      RAISE EXCEPTION
        'redaction_status cannot be approved on insert; recordings must pass review';
    END IF;
    RETURN NEW;
  END IF;

  -- ── UPDATE ────────────────────────────────────────────────────────────────
  -- Acting-IMO-aware admin test, shared by every authority check below so the
  -- trigger and the RLS policies can never disagree about "who is an admin".
  v_is_admin :=
        public.super_admin_in_scope(NEW.imo_id)
    OR (public.is_imo_admin() AND NEW.imo_id = public.get_my_imo_id());

  -- Worker-binding: the muted-is-current watermark may only be advanced by the
  -- service-role worker (auth.uid() IS NULL). A user/admin PATCH cannot forge it.
  -- Guard the TRANSITION, not the state, so an ordinary edit on an already-muted
  -- ('done') row (e.g. scrubbing caller_name pre-approval) is NOT blocked.
  IF auth.uid() IS NOT NULL THEN
    IF NEW.audio_redaction_status = 'done'
       AND OLD.audio_redaction_status IS DISTINCT FROM 'done' THEN
      RAISE EXCEPTION
        'audio_redaction_status=done may only be set by the redaction worker';
    END IF;
    IF NEW.muted_spans_version IS DISTINCT FROM OLD.muted_spans_version THEN
      RAISE EXCEPTION
        'muted_spans_version may only be set by the redaction worker';
    END IF;
    IF NEW.redacted_storage_path IS DISTINCT FROM OLD.redacted_storage_path THEN
      RAISE EXCEPTION
        'redacted_storage_path may only be set by the redaction worker';
    END IF;
  END IF;

  -- Span re-arm: any change to the mute spans invalidates the muted copy. Bump
  -- the version and force a re-mute. Survives a direct PostgREST PATCH that skips
  -- the edit edge fn. (transcribe/backfill write spans via service-role → pass.)
  IF NEW.redaction_spans IS DISTINCT FROM OLD.redaction_spans THEN
    IF OLD.redaction_status = 'approved' THEN
      RAISE EXCEPTION
        'cannot edit redaction_spans on an approved recording; re-open first';
    END IF;
    IF auth.uid() IS NOT NULL AND NOT v_is_admin THEN
      RAISE EXCEPTION 'not authorized to edit redaction spans';
    END IF;
    NEW.spans_version       := OLD.spans_version + 1;
    NEW.audio_redaction_status := 'pending';
  END IF;

  -- Status transition guard. Only →approved shares PII IMO-wide, so only it is
  -- gated; every other transition (incl. leaving approved) only un-shares.
  IF NEW.redaction_status IS DISTINCT FROM OLD.redaction_status
     AND NEW.redaction_status = 'approved' THEN
    IF OLD.redaction_status <> 'needs_review' THEN
      RAISE EXCEPTION
        'redaction_status can only become approved from needs_review (was %)',
        OLD.redaction_status;
    END IF;
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'approval requires an authenticated admin';
    END IF;
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'not authorized to approve this recording';
    END IF;
    IF NEW.redaction_detector IS NULL THEN
      RAISE EXCEPTION 'cannot approve before PII detection has run';
    END IF;
    IF NEW.audio_redaction_status <> 'done'
       OR NEW.redacted_storage_path IS NULL THEN
      RAISE EXCEPTION 'cannot approve before audio redaction is done';
    END IF;
    IF NEW.muted_spans_version <> NEW.spans_version THEN
      RAISE EXCEPTION
        'spans changed since last mute; re-mute before approving';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.kpi_call_recordings_redaction_guard() IS
  'Call Reviews PII Phase 3: the DB-layer guarantee for redaction approval. Blocks pre-approved inserts, binds the muted-current watermark to the service-role worker, re-arms muting on any span change, and permits redaction_status->approved only from needs_review by an authenticated in-scope IMO admin with detection run + audio muted & current.';

DROP TRIGGER IF EXISTS kpi_call_recordings_redaction_guard ON public.kpi_call_recordings;
CREATE TRIGGER kpi_call_recordings_redaction_guard
  BEFORE INSERT OR UPDATE ON public.kpi_call_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.kpi_call_recordings_redaction_guard();

COMMIT;
