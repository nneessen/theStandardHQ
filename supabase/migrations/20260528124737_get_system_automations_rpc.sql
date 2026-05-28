-- ============================================================================
-- get_system_automations() — SECURITY DEFINER read RPC for system automations
-- ============================================================================
-- WHY: pipeline_automations carries ~14 permissive RLS policies, each doing
-- EXISTS subqueries against user_profiles (which itself has a ~15-branch RLS
-- mega-policy). A plain PostgREST `SELECT * FROM pipeline_automations WHERE
-- phase_id IS NULL AND checklist_item_id IS NULL` makes the planner expand all
-- of that recursively into 5700+ InitPlans → ~26s PLANNING time (execution is
-- <0.5s) → blows past statement_timeout → HTTP 500 on the admin automations page.
--
-- This definer RPC runs the query as the function owner (RLS bypassed), so the
-- planner only plans one simple statement. Access is enforced INLINE, faithfully
-- mirroring the only two policies that ever expose system automations
-- (phase_id IS NULL AND checklist_item_id IS NULL):
--   * pipeline_automations_super_admin  : super_admin_in_scope(imo_id)
--   * pipeline_automations_imo_admin_system :
--       is_imo_admin() AND imo_id = get_my_imo_id()
--       AND (get_effective_imo_id() IS NULL OR imo_id IS NULL
--            OR imo_id = get_effective_imo_id())
-- No access change: same rows the caller would see via RLS. Revocation-safe — a
-- revoked non-super-admin gets get_my_imo_id() = sentinel → 0 rows.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_system_automations()
  RETURNS SETOF public.pipeline_automations
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $fn$
  SELECT pa.*
  FROM public.pipeline_automations pa
  WHERE pa.phase_id IS NULL
    AND pa.checklist_item_id IS NULL
    AND (
      public.super_admin_in_scope(pa.imo_id)
      OR (
        public.is_imo_admin()
        AND pa.imo_id = public.get_my_imo_id()
        AND (
          public.get_effective_imo_id() IS NULL
          OR pa.imo_id IS NULL
          OR pa.imo_id = public.get_effective_imo_id()
        )
      )
    )
  ORDER BY pa.created_at ASC;
$fn$;

REVOKE ALL ON FUNCTION public.get_system_automations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_system_automations() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_system_automations() TO authenticated;

COMMENT ON FUNCTION public.get_system_automations() IS
  'Returns system-level pipeline_automations (phase_id/checklist_item_id NULL) for the caller, mirroring the super_admin + imo_admin_system RLS policies inline. SECURITY DEFINER to avoid the multi-policy RLS planning explosion on pipeline_automations (was causing ~26s planning → statement_timeout 500s). Revocation-safe via the sentinel.';

COMMIT;
