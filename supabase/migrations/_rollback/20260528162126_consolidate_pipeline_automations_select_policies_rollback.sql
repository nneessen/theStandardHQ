-- Rollback for 20260528162126_consolidate_pipeline_automations_select_policies.sql
-- Drops the consolidated SELECT policy and restores the original cmd=SELECT
-- policies verbatim (regenerated from pg_policies at authoring time).
BEGIN;

DROP POLICY IF EXISTS pipeline_automations_select_consolidated ON public.pipeline_automations;

CREATE POLICY "Staff can view automations in DEFAULT templates" ON public.pipeline_automations FOR SELECT TO public USING (((phase_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((user_profiles up
     JOIN pipeline_phases pp ON ((pp.id = pipeline_automations.phase_id)))
     JOIN pipeline_templates pt ON ((pt.id = pp.template_id)))
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ((up.roles @> ARRAY['trainer'::text]) OR (up.roles @> ARRAY['contracting_manager'::text])) AND ((pt.imo_id = up.imo_id) OR (pt.imo_id IS NULL)) AND (pt.name ~~* '%DEFAULT%'::text)))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))));

CREATE POLICY "Staff can view item automations in DEFAULT templates" ON public.pipeline_automations FOR SELECT TO public USING (((checklist_item_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (((user_profiles up
     JOIN phase_checklist_items pci ON ((pci.id = pipeline_automations.checklist_item_id)))
     JOIN pipeline_phases pp ON ((pp.id = pci.phase_id)))
     JOIN pipeline_templates pt ON ((pt.id = pp.template_id)))
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ((up.roles @> ARRAY['trainer'::text]) OR (up.roles @> ARRAY['contracting_manager'::text])) AND ((pt.imo_id = up.imo_id) OR (pt.imo_id IS NULL)) AND (pt.name ~~* '%DEFAULT%'::text)))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))));

CREATE POLICY imo_staff_view_automations ON public.pipeline_automations FOR SELECT TO authenticated USING ((is_imo_staff_role() AND (((phase_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (pipeline_phases pp
     JOIN pipeline_templates pt ON ((pp.template_id = pt.id)))
  WHERE ((pp.id = pipeline_automations.phase_id) AND (pt.imo_id = get_my_imo_id()))))) OR ((checklist_item_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((phase_checklist_items pci
     JOIN pipeline_phases pp ON ((pci.phase_id = pp.id)))
     JOIN pipeline_templates pt ON ((pp.template_id = pt.id)))
  WHERE ((pci.id = pipeline_automations.checklist_item_id) AND (pt.imo_id = get_my_imo_id())))))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))));

CREATE POLICY pipeline_automations_agency_owner_select ON public.pipeline_automations FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.id = ( SELECT auth.uid() AS uid)) AND ('agency_owner'::text = ANY (up.roles))))) AND (((phase_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (pipeline_phases pp
     JOIN pipeline_templates pt ON ((pp.template_id = pt.id)))
  WHERE ((pp.id = pipeline_automations.phase_id) AND (pt.imo_id = get_my_imo_id()))))) OR ((checklist_item_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ((phase_checklist_items pci
     JOIN pipeline_phases pp ON ((pci.phase_id = pp.id)))
     JOIN pipeline_templates pt ON ((pp.template_id = pt.id)))
  WHERE ((pci.id = pipeline_automations.checklist_item_id) AND (pt.imo_id = get_my_imo_id())))))) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id()))));

COMMIT;

