-- ============================================================================
-- Phase 2: Consolidate public.pipeline_automations's permissive SELECT policies into ONE
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
-- Rollback: supabase/migrations/_rollback/20260528162126_..._rollback.sql.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Staff can view automations in DEFAULT templates" ON public.pipeline_automations;
DROP POLICY IF EXISTS "Staff can view item automations in DEFAULT templates" ON public.pipeline_automations;
DROP POLICY IF EXISTS imo_staff_view_automations ON public.pipeline_automations;
DROP POLICY IF EXISTS pipeline_automations_agency_owner_select ON public.pipeline_automations;

CREATE POLICY pipeline_automations_select_consolidated ON public.pipeline_automations
  FOR SELECT TO authenticated
  USING (
    (((phase_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((user_profiles up
     JOIN pipeline_phases pp ON ((pp.id = pipeline_automations.phase_id)))
     JOIN pipeline_templates pt ON ((pt.id = pp.template_id)))
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ((up.roles @> ARRAY['trainer'::text]) OR (up.roles @> ARRAY['contracting_manager'::text])) AND ((pt.imo_id = up.imo_id) OR (pt.imo_id IS NULL)) AND (pt.name ~~* '%DEFAULT%'::text)))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))))
    OR (((checklist_item_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (((user_profiles up
     JOIN phase_checklist_items pci ON ((pci.id = pipeline_automations.checklist_item_id)))
     JOIN pipeline_phases pp ON ((pp.id = pci.phase_id)))
     JOIN pipeline_templates pt ON ((pt.id = pp.template_id)))
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ((up.roles @> ARRAY['trainer'::text]) OR (up.roles @> ARRAY['contracting_manager'::text])) AND ((pt.imo_id = up.imo_id) OR (pt.imo_id IS NULL)) AND (pt.name ~~* '%DEFAULT%'::text)))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))))
    OR ((is_imo_staff_role() AND (((phase_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (pipeline_phases pp
     JOIN pipeline_templates pt ON ((pp.template_id = pt.id)))
  WHERE ((pp.id = pipeline_automations.phase_id) AND (pt.imo_id = get_my_imo_id()))))) OR ((checklist_item_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((phase_checklist_items pci
     JOIN pipeline_phases pp ON ((pci.phase_id = pp.id)))
     JOIN pipeline_templates pt ON ((pp.template_id = pt.id)))
  WHERE ((pci.id = pipeline_automations.checklist_item_id) AND (pt.imo_id = get_my_imo_id())))))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))))
    OR (((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ('agency_owner'::text = ANY (up.roles))))) AND (((phase_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (pipeline_phases pp
     JOIN pipeline_templates pt ON ((pp.template_id = pt.id)))
  WHERE ((pp.id = pipeline_automations.phase_id) AND (pt.imo_id = get_my_imo_id()))))) OR ((checklist_item_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((phase_checklist_items pci
     JOIN pipeline_phases pp ON ((pci.phase_id = pp.id)))
     JOIN pipeline_templates pt ON ((pp.template_id = pt.id)))
  WHERE ((pci.id = pipeline_automations.checklist_item_id) AND (pt.imo_id = get_my_imo_id())))))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))))
  );

COMMIT;

