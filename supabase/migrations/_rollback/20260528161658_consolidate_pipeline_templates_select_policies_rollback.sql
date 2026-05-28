-- Rollback for 20260528161658_consolidate_pipeline_templates_select_policies.sql
-- Drops the consolidated SELECT policy and restores the original cmd=SELECT
-- policies verbatim (regenerated from pg_policies at authoring time).
BEGIN;

DROP POLICY IF EXISTS pipeline_templates_select_consolidated ON public.pipeline_templates;

CREATE POLICY pipeline_templates_agency_owner_select ON public.pipeline_templates FOR SELECT TO authenticated USING ((is_agency_owner(NULL::uuid) AND ((imo_id = get_my_imo_id()) OR (created_by = ( SELECT auth.uid() AS uid))) AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))));

CREATE POLICY pipeline_templates_default_select ON public.pipeline_templates FOR SELECT TO public USING (((name ~~* '%DEFAULT%'::text) AND (is_active = true) AND (imo_id = get_my_imo_id())));

CREATE POLICY pipeline_templates_imo_select ON public.pipeline_templates FOR SELECT TO authenticated USING (((is_imo_admin() OR is_imo_staff_role()) AND (imo_id = get_my_imo_id()) AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))));

CREATE POLICY pipeline_templates_recruit_select ON public.pipeline_templates FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ('recruit'::text = ANY (up.roles)) AND (up.pipeline_template_id IS NOT NULL) AND (up.pipeline_template_id = pipeline_templates.id)))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))));

CREATE POLICY pipeline_templates_super_admin_select ON public.pipeline_templates FOR SELECT TO authenticated USING (super_admin_in_scope(imo_id));

CREATE POLICY pipeline_templates_upline_select ON public.pipeline_templates FOR SELECT TO public USING (((imo_id = get_my_imo_id()) AND (EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE (((up.recruiter_id = auth.uid()) OR (up.upline_id = auth.uid())) AND (up.pipeline_template_id = pipeline_templates.id)))) AND ((get_effective_imo_id() IS NULL) OR (imo_id = get_effective_imo_id()))));

COMMIT;

