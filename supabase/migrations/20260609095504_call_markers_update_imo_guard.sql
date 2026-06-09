-- ============================================================================
-- kpi_call_markers — close cross-IMO re-tenant gap on UPDATE
-- ============================================================================
-- The original UPDATE policy (20260609074223) WITH CHECK author branch only
-- required `created_by = auth.uid()` with NO imo_id guard. Because the BEFORE
-- trigger re-derives NEW.imo_id from NEW.recording_id, a user could PATCH their
-- own marker's recording_id to a recording in ANOTHER IMO: USING passes (they
-- own the row), the trigger sets imo_id to the other IMO, and WITH CHECK still
-- passed — moving the marker (and its visibility) into a foreign IMO.
--
-- Fix: require `imo_id = get_my_imo_id()` on the author branch too, so the post-
-- trigger row must stay in the caller's own IMO. Matches the INSERT policy.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS kpi_call_markers_update ON public.kpi_call_markers;
CREATE POLICY kpi_call_markers_update ON public.kpi_call_markers
  FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id())
        AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id())))
    OR super_admin_in_scope(imo_id)
  )
  WITH CHECK (
    (created_by = (SELECT auth.uid()) AND imo_id = (SELECT get_my_imo_id()))
    OR ((SELECT is_imo_admin()) AND imo_id = (SELECT get_my_imo_id()))
    OR super_admin_in_scope(imo_id)
  );

COMMIT;
