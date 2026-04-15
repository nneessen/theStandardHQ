-- supabase/migrations/20260414204354_presentation_markers.sql
-- Presentation Markers: Timestamped chapters/highlights on presentation recordings
-- so listeners can skip to specific parts of long audio files.

-- ============================================================================
-- 1. presentation_markers table
-- ============================================================================
CREATE TABLE IF NOT EXISTS presentation_markers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES presentation_submissions(id) ON DELETE CASCADE,
  timestamp_seconds INTEGER NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  marker_type TEXT NOT NULL DEFAULT 'chapter',
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_presentation_markers_submission_id
  ON presentation_markers(submission_id);
CREATE INDEX IF NOT EXISTS idx_presentation_markers_submission_time
  ON presentation_markers(submission_id, timestamp_seconds);
CREATE INDEX IF NOT EXISTS idx_presentation_markers_created_by
  ON presentation_markers(created_by);

-- ============================================================================
-- 3. RLS — visibility mirrors the parent submission, anyone who can see the
--    submission can add markers; only the marker author or staff can edit/delete.
-- ============================================================================
ALTER TABLE presentation_markers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View markers if can view submission" ON presentation_markers;
CREATE POLICY "View markers if can view submission"
ON presentation_markers FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM presentation_submissions ps
    WHERE ps.id = submission_id
      AND (
        ps.user_id = auth.uid()
        OR (
          ps.imo_id = (SELECT imo_id FROM user_profiles WHERE id = auth.uid())
          AND is_training_hub_staff(auth.uid())
        )
      )
  )
);

DROP POLICY IF EXISTS "Insert markers if can view submission" ON presentation_markers;
CREATE POLICY "Insert markers if can view submission"
ON presentation_markers FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM presentation_submissions ps
    WHERE ps.id = submission_id
      AND (
        ps.user_id = auth.uid()
        OR (
          ps.imo_id = (SELECT imo_id FROM user_profiles WHERE id = auth.uid())
          AND is_training_hub_staff(auth.uid())
        )
      )
  )
);

DROP POLICY IF EXISTS "Update own markers or staff" ON presentation_markers;
CREATE POLICY "Update own markers or staff"
ON presentation_markers FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR is_training_hub_staff(auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  OR is_training_hub_staff(auth.uid())
);

DROP POLICY IF EXISTS "Delete own markers or staff" ON presentation_markers;
CREATE POLICY "Delete own markers or staff"
ON presentation_markers FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR is_training_hub_staff(auth.uid())
);

-- ============================================================================
-- 4. updated_at trigger
-- ============================================================================
CREATE OR REPLACE TRIGGER set_presentation_markers_updated_at
  BEFORE UPDATE ON presentation_markers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Grants
-- ============================================================================
GRANT ALL ON presentation_markers TO authenticated;
