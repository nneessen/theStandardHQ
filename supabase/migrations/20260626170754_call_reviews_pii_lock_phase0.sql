-- ============================================================================
-- Call Reviews — PII redaction, Phase 0: LOCK NOW
-- ============================================================================
-- The /call-reviews training library is open IMO-wide: any agent can read any
-- recording's transcript AND mint a signed URL to the raw audio. Client calls
-- contain spoken SSNs / bank / card numbers. Until per-recording PII redaction
-- ships (Phases 1-3), restrict every recording to owner / upline / IMO-admin and
-- expose it IMO-wide ONLY once it has been redacted and approved.
--
-- Mechanism: a new redaction_status flag (default 'pending'). Gate every IMO-wide
-- SELECT path on redaction_status = 'approved'. With the column defaulting to
-- 'pending', this is BOTH the immediate lock (no recording is approved yet, so
-- peers see nothing) AND the per-recording re-open switch (set 'approved' to share).
--
-- Owner / upline / IMO-admin reads are UNAFFECTED — they flow through the separate
-- FOR ALL policies (kpi_call_recordings_rw, the detections FOR ALL policy, the
-- owner storage SELECT), not the IMO-wide policies changed here. The RESTRICTIVE
-- revocation_deny policies still AND on top. Helpers stay wrapped in (SELECT …)
-- so they InitPlan-hoist (per project RLS perf convention); the per-row EXISTS
-- gates are intentionally not hoistable (they read the row's recording_id).
-- ============================================================================

BEGIN;

-- ── A. Schema: redaction lifecycle flag ─────────────────────────────────────
-- ENUM enforced in TypeScript (project rule: no CHECK constraints on enums):
--   pending | detecting | needs_review | approved | failed
-- Existing rows backfill to 'pending' via the default → all become peer-locked.
ALTER TABLE public.kpi_call_recordings
  ADD COLUMN IF NOT EXISTS redaction_status TEXT NOT NULL DEFAULT 'pending';

-- ── B. kpi_call_recordings — gate the IMO-wide SELECT on approval ────────────
-- Peers see only approved recordings. Owner/upline/admin still read every row
-- through kpi_call_recordings_rw (FOR ALL).
DROP POLICY IF EXISTS kpi_call_recordings_imo_read ON public.kpi_call_recordings;
CREATE POLICY kpi_call_recordings_imo_read ON public.kpi_call_recordings
  FOR SELECT TO authenticated
  USING (
    imo_id = (SELECT get_my_imo_id())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
    AND redaction_status = 'approved'
  );

-- ── C. Storage — peers lose ALL raw-audio access ────────────────────────────
-- The raw object always contains the un-muted PII, so peers must never sign a
-- URL to it — even for an approved recording (they'll stream the REDACTED file
-- from a separate bucket added in Phase 2). Drop the IMO-wide storage SELECT
-- outright; owner/upline/admin keep access via call_recordings_storage_select.
DROP POLICY IF EXISTS "call_recordings_storage_imo_select" ON storage.objects;

-- ── D. kpi_word_track_detections — gate IMO-wide read on parent approval ─────
-- detected_phrase is VERBATIM agent speech and can echo a read-back SSN. Hide
-- detections for any recording not yet approved. Owner/upline/admin still read
-- via the table's FOR ALL policy, so review is unaffected.
DROP POLICY IF EXISTS kpi_word_track_detections_imo_read ON public.kpi_word_track_detections;
CREATE POLICY kpi_word_track_detections_imo_read ON public.kpi_word_track_detections
  FOR SELECT TO authenticated
  USING (
    imo_id = (SELECT get_my_imo_id())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
    AND EXISTS (
      SELECT 1 FROM public.kpi_call_recordings r
      WHERE r.id = recording_id
        AND r.redaction_status = 'approved'
    )
  );

-- ── E. kpi_call_markers — gate IMO-wide read on parent approval ──────────────
-- Markers are human-typed coaching notes (lowest PII risk) but belong to a
-- recording; hiding the recording should hide its annotations. The author still
-- sees their own markers (created_by) so the owner/admin who annotated a not-yet-
-- approved recording during review keeps visibility; peers can't have authored a
-- marker on a recording they could never see, so this leaks nothing.
DROP POLICY IF EXISTS kpi_call_markers_select ON public.kpi_call_markers;
CREATE POLICY kpi_call_markers_select ON public.kpi_call_markers
  FOR SELECT TO authenticated
  USING (
    imo_id = (SELECT get_my_imo_id())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
    AND (
      created_by = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.kpi_call_recordings r
        WHERE r.id = recording_id
          AND r.redaction_status = 'approved'
      )
    )
  );

COMMIT;
