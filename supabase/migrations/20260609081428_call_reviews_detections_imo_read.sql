-- ============================================================================
-- Call Reviews — IMO-wide read for word-track detections
-- ============================================================================
-- The open-IMO training library (20260609074223) widened SELECT on
-- kpi_call_recordings so any agent can review any call. But the per-call
-- "word tracks used" panel reads kpi_word_track_detections, whose RLS is still
-- agent/upline/admin-scoped — so a non-owner reviewing a shared call would see
-- no detections. Widen detection READS to IMO-wide too (read-only; the existing
-- FOR ALL policy keeps writes service-role/owner-scoped, and the RESTRICTIVE
-- revocation_deny still ANDs). Helpers wrapped in (SELECT …) → InitPlan-hoisted.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS kpi_word_track_detections_imo_read ON public.kpi_word_track_detections;
CREATE POLICY kpi_word_track_detections_imo_read ON public.kpi_word_track_detections
  FOR SELECT TO authenticated
  USING (
    imo_id = (SELECT get_my_imo_id())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

COMMIT;
