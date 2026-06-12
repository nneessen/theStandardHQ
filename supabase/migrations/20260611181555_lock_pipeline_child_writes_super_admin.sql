-- Extend the super-admin-only pipeline lock from the root template (20260611170329)
-- to the CHILD tables that hold a pipeline's actual structure: pipeline_phases,
-- phase_checklist_items, pipeline_automations.
--
-- WHY: the owner directive is "only the super admin may create OR MANAGE
-- pipelines." 170329 locked CREATION (the root pipeline_templates row), but the
-- staff / imo_admin / agency_owner write policies on these child tables still let
-- a non-super-admin EDIT the phases, checklist items, and automations of any
-- existing DEFAULT pipeline via a direct PostgREST/JWT call. The route + nav
-- superAdminOnly gating is a UI control, not a data-layer boundary, so the
-- "manage" half of the directive was unenforced.
--
-- phase_checklist_items has NO super_admin write policy today (its only writes are
-- the trainer/contracting_manager "DEFAULT" policies), so we ADD one FIRST — else
-- dropping the staff policies would lock the super admin out of checklist edits.
-- pipeline_phases and pipeline_automations already have super_admin write policies
-- (kept). Enrollment writes go to recruit_phase_progress / recruit_checklist_progress
-- (NOT these template tables), so agent enrollment is unaffected. Idempotent.

-- 1) phase_checklist_items: add the missing super-admin write path BEFORE dropping
--    the staff policies. Mirrors the super_admin_in_scope(<template imo>) pattern
--    used by pipeline_phases' super_admin policies, resolved through phase->template.
DROP POLICY IF EXISTS phase_checklist_items_super_admin_all ON phase_checklist_items;
CREATE POLICY phase_checklist_items_super_admin_all
  ON phase_checklist_items
  FOR ALL
  USING (
    super_admin_in_scope((
      SELECT pt.imo_id
        FROM pipeline_templates pt
        JOIN pipeline_phases pp ON pp.template_id = pt.id
       WHERE pp.id = phase_checklist_items.phase_id
    ))
  )
  WITH CHECK (
    super_admin_in_scope((
      SELECT pt.imo_id
        FROM pipeline_templates pt
        JOIN pipeline_phases pp ON pp.template_id = pt.id
       WHERE pp.id = phase_checklist_items.phase_id
    ))
  );

-- 2) Drop every non-super-admin write policy on the child tables.
--    (SELECT policies + the super_admin_* writes + revocation_deny are retained.)

-- pipeline_phases
DROP POLICY IF EXISTS "Staff can delete phases from DEFAULT templates" ON pipeline_phases;
DROP POLICY IF EXISTS "Staff can insert phases into DEFAULT templates" ON pipeline_phases;
DROP POLICY IF EXISTS "Staff can update phases in DEFAULT templates"   ON pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_agency_owner_delete ON pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_agency_owner_insert ON pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_agency_owner_update ON pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_imo_admin_delete ON pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_imo_admin_insert ON pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_imo_admin_update ON pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_imo_staff_delete ON pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_imo_staff_insert ON pipeline_phases;
DROP POLICY IF EXISTS pipeline_phases_imo_staff_update ON pipeline_phases;

-- phase_checklist_items
DROP POLICY IF EXISTS "Staff can delete items from DEFAULT templates" ON phase_checklist_items;
DROP POLICY IF EXISTS "Staff can insert items into DEFAULT templates" ON phase_checklist_items;
DROP POLICY IF EXISTS "Staff can update items in DEFAULT templates"   ON phase_checklist_items;

-- pipeline_automations
DROP POLICY IF EXISTS pipeline_automations_imo_admin_item   ON pipeline_automations;
DROP POLICY IF EXISTS pipeline_automations_imo_admin_phase  ON pipeline_automations;
DROP POLICY IF EXISTS pipeline_automations_imo_admin_system ON pipeline_automations;
DROP POLICY IF EXISTS "Staff can delete automations from DEFAULT templates"      ON pipeline_automations;
DROP POLICY IF EXISTS "Staff can delete item automations from DEFAULT templates" ON pipeline_automations;
DROP POLICY IF EXISTS "Staff can insert automations into DEFAULT templates"      ON pipeline_automations;
DROP POLICY IF EXISTS "Staff can insert item automations into DEFAULT templates" ON pipeline_automations;
DROP POLICY IF EXISTS "Staff can update automations in DEFAULT templates"        ON pipeline_automations;
DROP POLICY IF EXISTS "Staff can update item automations in DEFAULT templates"   ON pipeline_automations;
