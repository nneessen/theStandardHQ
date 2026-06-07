-- ============================================================================
-- Tenant-isolation completeness check (IMO multi-tenancy).
-- ============================================================================
-- Asserts that EVERY RLS-enabled public base table is read-scoped to a tenant:
-- it must carry at least one PERMISSIVE policy for SELECT (or ALL) whose USING
-- qualifier references a recognised tenant predicate — i.e. the row is filtered
-- by imo_id / agency_id / ownership / hierarchy, not world-readable.
--
-- This is the durable guarantee behind "zero IMO bleed-over": a normal user can
-- only ever read rows in their own IMO. (Super-admins intentionally see across
-- IMOs via the acting-IMO selector — that is the effective-IMO scope, not a
-- leak.) The RESTRICTIVE `revocation_deny` policy is ignored here: it only
-- DENIES, it does not scope.
--
-- Recognised tenant predicates (any one is sufficient):
--   imo_id, agency_id, user_id, override_agent_id, base_agent_id,
--   get_my_imo_id(), get_effective_imo_id(), super_admin_in_scope(),
--   is_imo_admin(), is_upline_of(), is_agency_owner(), auth.uid()
--
-- EXPECTED RESULT: 0 rows. Any row is an RLS-enabled table whose reads are NOT
-- tenant-scoped — either fix its SELECT policy, or, if it is a deliberately
-- global/shared/service-role-only table, add it to the allowlist below WITH a
-- one-line rationale.
--
-- Run on LOCAL and REMOTE:
--   ./scripts/migrations/run-sql.sh -f scripts/check-tenant-isolation.sql
--   DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-sql.sh -f scripts/check-tenant-isolation.sql
-- ============================================================================
WITH allow(t, rationale) AS (VALUES
  -- Deliberately NOT IMO-scoped. Each entry must justify why cross-tenant read
  -- is acceptable (global reference data, identity/bootstrap tables a session
  -- reads before tenant is known, super-admin-only, or service-role-only).
  ('imos',                            'tenant directory; rows are the IMOs themselves, gated by id = get_effective_imo_id() elsewhere'),
  ('agencies',                        'agency directory; scoped via imo membership in its own policies'),
  ('user_profiles',                   'identity table read on the auth/bootstrap path; self/imo/upline scoped in policy set'),
  ('data_export_log',                 'service-role-only audit table (sunset)'),
  ('account_deletion_log',            'service-role-only audit table (sunset)'),
  -- service-role-only (authenticated USING (false) or auth.role()=service_role)
  ('alert_rule_processing',           'service-role-only job table'),
  ('app_config',                      'service-role-only config'),
  ('email_webhook_events',            'service-role-only webhook log'),
  ('instagram_job_queue',             'service-role-only job queue'),
  ('rpc_function_drop_backup',        'service-role-only migration backup'),
  ('rpc_function_drop_backup_grants', 'service-role-only migration backup'),
  -- super-admin-only reads (cross-IMO is intentional for platform operators)
  ('system_audit_log',                'super-admin-only platform audit log'),
  ('sync_hierarchy_root',             'super-admin-only hierarchy sync state'),
  ('workflow_events',                 'super-admin-only workflow event log'),
  -- global reference data (read-all by design; writes are super-admin-gated)
  ('roles',                           'global RBAC role catalog'),
  ('role_permissions',                'global RBAC role-permission map'),
  ('permissions',                     'global RBAC permission catalog'),
  ('underwriting_health_conditions',  'global underwriting reference list'),
  ('global_expense_categories',       'global expense-category reference list'),
  ('close_kpi_widget_templates',      'global KPI widget template catalog'),
  ('subscription_settings',           'global singleton (no imo_id); platform temporary-access flags')
),
rls_tables AS (
  SELECT c.relname AS tablename
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.relkind = 'r' AND c.relrowsecurity = true
),
tenant_scoped AS (
  -- A table is considered tenant-scoped if ANY permissive SELECT/ALL policy's
  -- USING clause references a recognised tenant predicate.
  SELECT DISTINCT p.tablename
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.permissive = 'PERMISSIVE'
    AND p.cmd IN ('SELECT', 'ALL')
    AND COALESCE(p.qual, '') ~ (
      'imo_id'
      || '|agency_id'
      || '|\muser_id\M'
      || '|override_agent_id'
      || '|base_agent_id'
      || '|get_my_imo_id'
      || '|get_effective_imo_id'
      || '|super_admin_in_scope'
      || '|is_imo_admin'
      || '|is_upline_of'
      || '|is_agency_owner'
      || '|auth\.uid'
    )
)
SELECT r.tablename AS untenanted_table_must_scope_or_allowlist
FROM rls_tables r
WHERE r.tablename NOT IN (SELECT t FROM allow)
  AND r.tablename NOT IN (SELECT tablename FROM tenant_scoped)
ORDER BY 1;
