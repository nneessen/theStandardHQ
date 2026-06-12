-- ============================================================================
-- kpi_call_scripts — let imo_owner SEE their own in-flight / failed scripts.
-- ============================================================================
-- The create migration gated body-NULL rows on `is_imo_admin()`, but that SQL
-- helper's role set is ['admin','imo_admin','superadmin'] — it EXCLUDES
-- 'imo_owner'. The generate-call-script edge fn AND the frontend Generate button
-- both allow imo_owner (= hasImoAdminRole). So an imo_owner who is NOT also
-- imo_admin/super could TRIGGER a generation but could not SELECT (and therefore
-- could not poll) the resulting status=processing / failed row while
-- script_body is still NULL — the detail page showed "No script yet" forever.
--
-- Fix: widen the body-NULL visibility branch to also accept imo_owner, matching
-- the generate gate. (Write policies are intentionally left as-is — there is no
-- client write path in v1; that alignment is deferred to the editing feature.)
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS kpi_call_scripts_select ON public.kpi_call_scripts;
CREATE POLICY kpi_call_scripts_select ON public.kpi_call_scripts
  FOR SELECT TO authenticated
  USING (
    (imo_id = (SELECT get_my_imo_id())
      AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id = (SELECT get_effective_imo_id()))
      AND (
        script_body IS NOT NULL
        OR (SELECT is_imo_admin())
        OR (SELECT EXISTS (
              SELECT 1 FROM public.user_profiles up
              WHERE up.id = (SELECT auth.uid())
                AND up.roles && ARRAY['imo_owner']::text[]
            ))
      ))
    OR super_admin_in_scope(imo_id)
  );

COMMIT;
