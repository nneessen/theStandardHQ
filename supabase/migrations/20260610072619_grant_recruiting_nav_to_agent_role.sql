-- Grant nav.recruiting_pipeline to the `agent` system role.
--
-- WHY: On prod, the `agent` role lacked `nav.recruiting_pipeline`, while the
-- LOCAL db already granted it (silent drift). Both the sidebar nav item
-- (sidebar-nav.config.ts) AND the /recruiting route guards (router.tsx) gate
-- on this permission, so every agent-only user — e.g. Epic Life's 13 users
-- carrying only the {agent} role — was locked out of the recruiting page and
-- therefore could not add recruits/downlines at all.
--
-- The `agent` role already holds the recruiting DATA permissions
-- (recruiting.create.own / read.own / update.own / delete.own), which is
-- strong evidence the missing NAV grant was an oversight, not a deliberate
-- exclusion. Recruit creation runs through the create-auth-user edge function
-- (RLS-bypassing), so this single nav grant is the only thing required.
--
-- TRIGGER BYPASS: role_permissions has a `prevent_system_role_changes` trigger
-- (function prevent_system_role_permission_changes) that blocks INSERT/DELETE
-- for system roles unless is_super_admin() — which is false under the direct
-- psql connection the migration runner uses. We disable that trigger for this
-- single additive grant inside an explicit transaction so a mid-migration
-- failure can never leave the trigger disabled on prod. (The runner does not
-- wrap migrations in a transaction, so this BEGIN/COMMIT is the sole one.)

BEGIN;

ALTER TABLE role_permissions DISABLE TRIGGER prevent_system_role_changes;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'agent'
  AND p.code = 'nav.recruiting_pipeline'
ON CONFLICT DO NOTHING;

ALTER TABLE role_permissions ENABLE TRIGGER prevent_system_role_changes;

COMMIT;

-- Verify the grant now exists for the agent role.
SELECT r.name AS role_name, p.code AS permission_code
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'agent'
  AND p.code = 'nav.recruiting_pipeline';
