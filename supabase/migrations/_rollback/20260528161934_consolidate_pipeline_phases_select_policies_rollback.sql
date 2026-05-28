-- Rollback for 20260528161934_consolidate_pipeline_phases_select_policies.sql
-- Drops the consolidated SELECT policy and restores the original cmd=SELECT
-- policies verbatim (regenerated from pg_policies at authoring time).
BEGIN;

DROP POLICY IF EXISTS pipeline_phases_select_consolidated ON public.pipeline_phases;

CREATE POLICY pipeline_phases_agency_owner_select ON public.pipeline_phases FOR SELECT TO authenticated USING ((is_agency_owner(NULL::uuid) AND (EXISTS ( SELECT 1
   FROM pipeline_templates pt
  WHERE ((pt.id = pipeline_phases.template_id) AND ((pt.imo_id = get_my_imo_id()) OR (pt.imo_id IS NULL) OR (pt.created_by = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY pipeline_phases_default_select ON public.pipeline_phases FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM pipeline_templates pt
  WHERE ((pt.id = pipeline_phases.template_id) AND (pt.name ~~* '%DEFAULT%'::text) AND (pt.is_active = true) AND ((pt.imo_id = get_my_imo_id()) OR (pt.imo_id IS NULL))))));

CREATE POLICY pipeline_phases_imo_select ON public.pipeline_phases FOR SELECT TO authenticated USING (((is_imo_admin() OR is_imo_staff_role()) AND (EXISTS ( SELECT 1
   FROM pipeline_templates pt
  WHERE ((pt.id = pipeline_phases.template_id) AND ((pt.imo_id = get_my_imo_id()) OR (pt.imo_id IS NULL)))))));

CREATE POLICY pipeline_phases_recruit_select ON public.pipeline_phases FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ('recruit'::text = ANY (up.roles)) AND (up.pipeline_template_id IS NOT NULL) AND (up.pipeline_template_id = pipeline_phases.template_id)))));

CREATE POLICY pipeline_phases_super_admin_select ON public.pipeline_phases FOR SELECT TO authenticated USING (super_admin_in_scope(( SELECT pipeline_templates.imo_id
   FROM pipeline_templates
  WHERE (pipeline_templates.id = pipeline_phases.template_id))));

CREATE POLICY pipeline_phases_upline_select ON public.pipeline_phases FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM pipeline_templates pt
  WHERE ((pt.id = pipeline_phases.template_id) AND ((pt.imo_id = get_my_imo_id()) OR (pt.imo_id IS NULL)) AND (EXISTS ( SELECT 1
           FROM user_profiles up
          WHERE (((up.recruiter_id = auth.uid()) OR (up.upline_id = auth.uid())) AND (up.pipeline_template_id = pt.id))))))));

COMMIT;

