-- ============================================================================
-- Call Reviews — all-agents live-call training platform
-- ============================================================================
-- Extends the existing inbound-call KPI schema (20260606135121) to power a NEW
-- all-agents Training surface (/call-reviews) on top of the SAME data layer that
-- the admin /kpi dashboard already uses. Owner decisions (Jun 9, 2026):
--   * Visibility: OPEN IMO-wide — every agent can listen to every recording in the IMO.
--   * Upload: any agent uploads & shares (uploads flow straight into the library).
--
-- This migration is purely ADDITIVE:
--   A. IMO-wide SELECT on kpi_call_recordings (read-only widening; writes stay scoped).
--   B. IMO-wide SELECT on the call-recordings storage bucket (so any IMO agent can stream).
--   C. New analytic columns on kpi_call_recordings (Deepgram diarization, hold, objections,
--      AI summary). All nullable/additive — no table rewrite, no enum CHECK constraints.
--   D. New table kpi_call_markers (timestamped annotations incl. hold ranges), with the
--      same tenant-derivation trigger + RESTRICTIVE revocation gate the sibling tables use.
--
-- PROJECT RULES honored: enums validated in TS (NOT DB CHECK); multi-tenant imo_id +
-- per-IMO RLS; every new table gets an explicit InitPlan-optimized RESTRICTIVE
-- revocation_deny so scripts/check-revocation-gate-completeness.sql stays green.
--
-- REUSED RLS HELPERS (STABLE SECURITY DEFINER, search_path=public): auth.uid(),
-- is_upline_of(uuid), is_imo_admin(), get_my_imo_id(), get_effective_imo_id(),
-- super_admin_in_scope(uuid), is_access_revoked(uuid), update_updated_at_column().
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- A. kpi_call_recordings — add an IMO-wide SELECT branch (read-only widening).
--    The existing kpi_call_recordings_rw (FOR ALL) policy keeps INSERT/UPDATE/DELETE
--    scoped to agent/upline/admin. A SEPARATE permissive FOR SELECT policy OR's with
--    it for reads only, so any authenticated user can READ recordings in their own
--    (acting) IMO without gaining write access. The RESTRICTIVE revocation_deny still
--    ANDs, so revoked users remain blocked. Helpers wrapped in (SELECT …) → hoisted
--    to a once-per-query InitPlan (per project RLS perf convention).
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS kpi_call_recordings_imo_read ON public.kpi_call_recordings;
CREATE POLICY kpi_call_recordings_imo_read ON public.kpi_call_recordings
  FOR SELECT TO authenticated
  USING (
    imo_id = (SELECT get_my_imo_id())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

-- ════════════════════════════════════════════════════════════════════════════
-- B. Storage — IMO-wide SELECT on the call-recordings bucket.
--    Recordings are stored at {agent_id}/yyyy/mm/ts_file, so foldername[1] is the
--    owning agent. To let any agent in the same IMO stream a shared recording, add a
--    helper that confirms the folder's agent shares the caller's IMO, then a new
--    permissive SELECT policy using it. Per-row (takes the row's folder agent) → NOT
--    InitPlan-hoistable, like kpi_admin_can_access_agent. The existing
--    call_recordings_storage_select (owner/upline/admin) and the RESTRICTIVE
--    revocation_deny_call_recordings gate remain in force.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.kpi_same_imo_agent(p_agent uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_agent IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.user_profiles up
       WHERE up.id = p_agent
         AND up.imo_id = public.get_my_imo_id()
     );
$$;
GRANT EXECUTE ON FUNCTION public.kpi_same_imo_agent(uuid) TO authenticated;

DROP POLICY IF EXISTS "call_recordings_storage_imo_select" ON storage.objects;
CREATE POLICY "call_recordings_storage_imo_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'call-recordings'
    -- CASE is an evaluation-order barrier: the ::uuid cast only runs when the folder
    -- is a real uuid, so a non-uuid name can never raise "invalid input syntax for
    -- type uuid" on storage.objects. Helper returns false for NULL.
    AND public.kpi_same_imo_agent(
      CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           THEN ((storage.foldername(name))[1])::uuid END
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- C. kpi_call_recordings — additive analytic columns.
--    talk_time_seconds (existing) = AGENT talk time. Deepgram diarization now also
--    yields client talk time + speaker count + a 0/1→role map (UI can flip). Hold is
--    summed from hold markers (kpi_call_markers). Objection/summary fields are filled
--    by analyze-call-transcript (Claude). All nullable — manual entry is never
--    clobbered (the analyze pass fills demographics only-if-null).
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.kpi_call_recordings
  ADD COLUMN IF NOT EXISTS transcript_provider      TEXT,         -- ENUM (TS): deepgram | whisper
  ADD COLUMN IF NOT EXISTS client_talk_seconds      INTEGER,      -- diarized client talk time (agent = talk_time_seconds)
  ADD COLUMN IF NOT EXISTS speaker_count            SMALLINT,     -- distinct diarized speakers
  ADD COLUMN IF NOT EXISTS speaker_role_map         JSONB,        -- {"0":"agent","1":"client"} — UI-flippable
  ADD COLUMN IF NOT EXISTS total_hold_seconds       INTEGER,      -- summed from 'hold' markers (human-verified)
  ADD COLUMN IF NOT EXISTS objection_count          INTEGER,      -- AI: distinct client objections raised
  ADD COLUMN IF NOT EXISTS smoke_screen_count       INTEGER,      -- AI: stalls/smoke-screens (non-genuine objections)
  ADD COLUMN IF NOT EXISTS objection_events         JSONB,        -- AI: [{start_seconds,end_seconds,quote,type,handled,resolution}]
  ADD COLUMN IF NOT EXISTS ai_summary               TEXT,         -- AI: short call summary
  ADD COLUMN IF NOT EXISTS ai_key_moments           JSONB,        -- AI: [{time_seconds,label,kind}]
  ADD COLUMN IF NOT EXISTS caller_existing_coverage TEXT;         -- AI: existing coverage / cross-sell note

-- IMO-wide library list orders by recency across ALL agents; the existing
-- (imo_id, agent_id, call_at) index can't serve an agent-agnostic scan cleanly.
CREATE INDEX IF NOT EXISTS idx_kpi_rec_imo_callat
  ON public.kpi_call_recordings (imo_id, call_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- D. kpi_call_markers — timestamped annotations on a recording.
--    Collaborative training annotations: any IMO agent can add markers to any
--    recording they can see (IMO-wide); creator or IMO admin can edit/delete.
--    A 'hold' marker uses start_seconds→end_seconds to capture a hold interval;
--    other types are single-point (end_seconds NULL). imo_id is DERIVED from the
--    parent recording by trigger (client can never forge a divergent tenant).
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.kpi_call_markers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imo_id        UUID NOT NULL REFERENCES public.imos(id),  -- denormalized (= recording.imo_id); set by trigger
  recording_id  UUID NOT NULL REFERENCES public.kpi_call_recordings(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  start_seconds NUMERIC(8,2) NOT NULL,                     -- marker position (WHEN in the call)
  end_seconds   NUMERIC(8,2),                              -- nullable; set for ranges (hold start→end)
  marker_type   TEXT NOT NULL DEFAULT 'highlight',         -- ENUM (TS): chapter|highlight|key_point|objection|hold|mistake|coaching
  label         TEXT NOT NULL,
  note          TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kpi_marker_recording      ON public.kpi_call_markers (recording_id);
CREATE INDEX idx_kpi_marker_recording_time ON public.kpi_call_markers (recording_id, start_seconds);
CREATE INDEX idx_kpi_marker_created_by     ON public.kpi_call_markers (created_by);

ALTER TABLE public.kpi_call_markers ENABLE ROW LEVEL SECURITY;

-- Derive imo_id from the parent recording (never trust the client). Mirrors
-- kpi_detection_set_denorm; the recording_id FK checks existence only, not tenancy.
CREATE OR REPLACE FUNCTION public.kpi_marker_set_denorm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imo uuid;
BEGIN
  SELECT r.imo_id INTO v_imo
  FROM public.kpi_call_recordings r
  WHERE r.id = NEW.recording_id;
  IF v_imo IS NULL THEN
    RAISE EXCEPTION 'kpi_call_markers: parent recording % not found', NEW.recording_id;
  END IF;
  NEW.imo_id := v_imo;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kpi_marker_set_denorm
  BEFORE INSERT OR UPDATE ON public.kpi_call_markers
  FOR EACH ROW EXECUTE FUNCTION public.kpi_marker_set_denorm();

CREATE TRIGGER trg_kpi_call_markers_updated_at
  BEFORE UPDATE ON public.kpi_call_markers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Read: IMO-wide (markers on shared calls are visible to the whole IMO).
CREATE POLICY kpi_call_markers_select ON public.kpi_call_markers
  FOR SELECT TO authenticated
  USING (
    imo_id = (SELECT get_my_imo_id())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

-- Insert: any agent in the IMO, attributing the marker to themselves.
CREATE POLICY kpi_call_markers_insert ON public.kpi_call_markers
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND imo_id = (SELECT get_my_imo_id())
  );

-- Update / Delete: the marker's author, an IMO admin (in scope), or super-admin.
CREATE POLICY kpi_call_markers_update ON public.kpi_call_markers
  FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  )
  WITH CHECK (
    created_by = (SELECT auth.uid())
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id()))
    OR super_admin_in_scope(imo_id)
  );

CREATE POLICY kpi_call_markers_delete ON public.kpi_call_markers
  FOR DELETE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  );

CREATE POLICY revocation_deny ON public.kpi_call_markers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT (SELECT public.is_access_revoked(auth.uid())))
  WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_call_markers TO authenticated;
GRANT ALL ON public.kpi_call_markers TO service_role;

COMMIT;
