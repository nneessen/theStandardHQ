-- ============================================================================
-- Revocation-gate completeness check (platform sunset) — DENY-BY-DEFAULT model.
-- ============================================================================
-- The gate (migration 20260526200139) attaches the RESTRICTIVE `revocation_deny`
-- policy to EVERY RLS-enabled public base table except a small allowlist. The
-- loop runs at migration time, so a table CREATED LATER would not be gated until
-- the migration is re-applied. This check is the tripwire: it lists every
-- RLS-enabled public base table that is NOT on the allowlist and does NOT carry
-- the revocation_deny policy.
--
-- EXPECTED RESULT: 0 rows. Any row is an UNGATED table reachable by a revoked
-- user — re-run the gate migration (it is idempotent) or, if the table truly
-- belongs in the allowlist, add it there (in BOTH the migration and below) with
-- a rationale.
--
-- Run on LOCAL and (after deploy) REMOTE:
--   ./scripts/migrations/run-sql.sh -f scripts/check-revocation-gate-completeness.sql
-- ============================================================================
WITH allow(t) AS (VALUES
  -- MUST mirror the allowlist in 20260526200139_revocation_gate_owned_tables.sql.
  -- Read by a revoked session before the sunset page renders, or service-role-only.
  ('user_profiles'), ('imos'), ('agencies'), ('data_export_log'), ('account_deletion_log')
),
rls_tables AS (
  SELECT c.relname AS tablename
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.relkind = 'r' AND c.relrowsecurity = true
),
gated AS (
  -- require the policy to actually reference is_access_revoked, so a neutered
  -- `revocation_deny` (e.g. recreated with USING(true)) does NOT count as gated
  SELECT DISTINCT p.tablename
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.policyname = 'revocation_deny'
    AND COALESCE(p.qual, '') LIKE '%is_access_revoked%'
)
SELECT r.tablename AS ungated_table_must_gate_or_allowlist
FROM rls_tables r
WHERE r.tablename NOT IN (SELECT t FROM allow)
  AND r.tablename NOT IN (SELECT tablename FROM gated)
ORDER BY 1;
