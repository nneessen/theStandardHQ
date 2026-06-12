-- Lock pipeline CREATION/management to the super admin only.
--
-- WHY: Owner directive — only the super admin (epiclife.neessen@gmail.com) may
-- create/edit/delete recruiting pipelines. Today IMO admins, IMO staff, and
-- agency owners can also INSERT/UPDATE/DELETE pipeline_templates. A pipeline
-- cannot exist without a pipeline_templates row, so locking writes on this root
-- table is the effective "create" gate. The child tables that hold a pipeline's
-- structure (pipeline_phases / phase_checklist_items / pipeline_automations) are
-- locked in the follow-up migration 20260611170330 — they could NOT be locked
-- here because phase_checklist_items has NO super_admin write policy yet, so
-- 170330 adds that path first before dropping the staff/admin policies.
--
-- KEEP: pipeline_templates_super_admin_insert/update/delete (super admin writes),
--       pipeline_templates_select_consolidated (agents still READ DEFAULT
--       templates), revocation_deny (RESTRICTIVE kill-switch). Idempotent.

-- INSERT (the create gate)
DROP POLICY IF EXISTS pipeline_templates_imo_admin_insert    ON pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_imo_staff_insert    ON pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_agency_owner_insert ON pipeline_templates;

-- UPDATE
DROP POLICY IF EXISTS pipeline_templates_imo_admin_update     ON pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_agency_owner_update  ON pipeline_templates;
DROP POLICY IF EXISTS "Staff can update DEFAULT templates in IMO" ON pipeline_templates;

-- DELETE
DROP POLICY IF EXISTS pipeline_templates_imo_admin_delete    ON pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_imo_staff_delete    ON pipeline_templates;
DROP POLICY IF EXISTS pipeline_templates_agency_owner_delete ON pipeline_templates;
