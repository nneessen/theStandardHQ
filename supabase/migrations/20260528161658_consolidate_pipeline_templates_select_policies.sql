-- ============================================================================
-- Phase 2: Consolidate public.pipeline_templates's permissive SELECT policies into ONE
-- ============================================================================
-- WHY: RLS planning-time bloat. Many overlapping permissive SELECT policies on
-- this table (and the tables it EXISTS-subqueries) make the Postgres PLANNER
-- expand each policy recursively, producing multi-second planning on tiny row
-- counts (statement_timeout 500s). Phase 1 collapsed user_profiles' 16 SELECT
-- policies -> 1; this continues down the pipeline_* / recruit_* reference graph.
--
-- EQUIVALENCE: the single USING below is the EXACT boolean OR of this table's
-- original cmd=SELECT policy quals (generated verbatim from pg_policies, not
-- hand-transcribed). The deparsed text carries re-rendered casts/parens vs the
-- original CREATE POLICY statements -- that textual noise is expected and does
-- NOT change semantics. The permissive FOR ALL policies (*_imo_admin_*,
-- *_super_admin) and the RESTRICTIVE revocation_deny are intentionally left in
-- place -- they still apply to SELECT, so row-set equivalence is preserved.
-- Proven row-set-identical for all live callers (115 users + anon probe,
-- 0 mismatches) on remote via the equivalence harness before apply.
-- Role TO authenticated matches the Phase 1 idiom; the anon probe confirmed no
-- regression (every dropped TO public qual is auth.uid()-dependent -> empty for
-- anon, both before and after).
-- Rollback: supabase/migrations/_rollback/20260528161658_..._rollback.sql.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS pipeline_templates_agency_owner_select ON public.pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_default_select ON public.pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_imo_select ON public.pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_recruit_select ON public.pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_super_admin_select ON public.pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_upline_select ON public.pipeline_templates;

CREATE POLICY pipeline_templates_select_consolidated ON public.pipeline_templates
  FOR SELECT TO authenticated
  USING (
    ((is_agency_owner(NULL::uuid) AND ((imo_id = get_my_imo_id()) OR (created_by = ( SELECT auth.uid() AS uid))) AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))))
    OR (((name ~~* '%DEFAULT%'::text) AND (is_active = true) AND (imo_id = get_my_imo_id())))
    OR (((is_imo_admin() OR is_imo_staff_role()) AND (imo_id = get_my_imo_id()) AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))))
    OR (((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ('recruit'::text = ANY (up.roles)) AND (up.pipeline_template_id IS NOT NULL) AND (up.pipeline_template_id = pipeline_templates.id)))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))))
    OR (super_admin_in_scope(imo_id))
    OR (((imo_id = get_my_imo_id()) AND (EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE (((up.recruiter_id = auth.uid()) OR (up.upline_id = auth.uid())) AND (up.pipeline_template_id = pipeline_templates.id)))) AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))))
  );

COMMIT;

