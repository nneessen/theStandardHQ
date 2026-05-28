-- ============================================================================
-- Phase 2: Consolidate public.pipeline_phases's permissive SELECT policies into ONE
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
-- Rollback: supabase/migrations/_rollback/20260528161934_..._rollback.sql.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS pipeline_phases_agency_owner_select ON public.pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_default_select ON public.pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_imo_select ON public.pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_recruit_select ON public.pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_super_admin_select ON public.pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_upline_select ON public.pipeline_phases;

CREATE POLICY pipeline_phases_select_consolidated ON public.pipeline_phases
  FOR SELECT TO authenticated
  USING (
    ((is_agency_owner(NULL::uuid) AND (EXISTS ( SELECT 1
   FROM pipeline_templates pt
  WHERE ((pt.id = pipeline_phases.template_id) AND ((pt.imo_id = get_my_imo_id()) OR (pt.imo_id IS NULL) OR (pt.created_by = ( SELECT auth.uid() AS uid))))))))
    OR ((EXISTS ( SELECT 1
   FROM pipeline_templates pt
  WHERE ((pt.id = pipeline_phases.template_id) AND (pt.name ~~* '%DEFAULT%'::text) AND (pt.is_active = true) AND ((pt.imo_id = get_my_imo_id()) OR (pt.imo_id IS NULL))))))
    OR (((is_imo_admin() OR is_imo_staff_role()) AND (EXISTS ( SELECT 1
   FROM pipeline_templates pt
  WHERE ((pt.id = pipeline_phases.template_id) AND ((pt.imo_id = get_my_imo_id()) OR (pt.imo_id IS NULL)))))))
    OR ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ('recruit'::text = ANY (up.roles)) AND (up.pipeline_template_id IS NOT NULL) AND (up.pipeline_template_id = pipeline_phases.template_id)))))
    OR (super_admin_in_scope(( SELECT pipeline_templates.imo_id
   FROM pipeline_templates
  WHERE (pipeline_templates.id = pipeline_phases.template_id))))
    OR ((EXISTS ( SELECT 1
   FROM pipeline_templates pt
  WHERE ((pt.id = pipeline_phases.template_id) AND ((pt.imo_id = get_my_imo_id()) OR (pt.imo_id IS NULL)) AND (EXISTS ( SELECT 1
           FROM user_profiles up
          WHERE (((up.recruiter_id = auth.uid()) OR (up.upline_id = auth.uid())) AND (up.pipeline_template_id = pt.id))))))))
  );

COMMIT;

