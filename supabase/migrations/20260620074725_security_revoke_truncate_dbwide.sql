-- ============================================================================
-- DB-wide grant hardening — Tier 1 (see docs/security/db-wide-grant-hardening-audit.md).
--
-- FINDING: 202 of 211 public tables grant anon+authenticated FULL privileges incl. TRUNCATE.
-- TRUNCATE empties a whole table and BYPASSES row-level security entirely → cross-tenant wipe
-- vector. REFERENCES/TRIGGER are schema-level privileges the app roles never use. None of the three
-- are reachable through PostgREST (the only path anon/authenticated have to the DB).
--
-- SCOPE: revoke ONLY TRUNCATE/REFERENCES/TRIGGER. We deliberately KEEP INSERT/UPDATE/DELETE/SELECT —
-- the app writes/reads directly via PostgREST as `authenticated`, scoped by RLS (203 tables grant
-- authenticated INSERT); revoking CRUD would break it. anon CRUD review is Tier 2 (out of scope).
--
-- Generalizes the inbound-CRM fix (20260620062216) across the whole schema. Safe: nothing the app
-- uses changes. Apply during low traffic — `REVOKE ON ALL TABLES` briefly locks each table.
-- ============================================================================

SET lock_timeout = '5s';

-- (1) Existing tables: drop the RLS-immune / app-unused privileges from the two weak roles.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- (2) Future tables: the default ACL grants anon/authenticated full privileges (incl. TRUNCATE) on
-- every new public table. This migration runs as `postgres`, so the no-FOR-ROLE form fixes the
-- postgres-owned default ACL — which covers all APP-created tables (app migrations run as postgres).
-- KNOWN RESIDUAL (prod): prod also carries a `supabase_admin`-owned default ACL granting the same,
-- and `postgres` CANNOT alter it (verified on prod + local: permission denied, SQLSTATE 42501). So
-- future tables created BY `supabase_admin` (platform/extension internals — never app tables) keep the
-- grant. Accepted: it governs no app data, and ALL existing such tables are already cleaned by (1).
-- (CRUD defaults are intentionally left in place; tightening anon CRUD is Tier 2.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

-- (3) Drop the world-open leftover test table (no RLS + anon can SELECT *and* INSERT). It exists only
-- on LOCAL (verified ABSENT on prod → a no-op there); locally it had 0 FK/view deps and 0 code refs.
-- `rate_limits` (the other RLS-less table) is intentionally left — it grants no role any privilege.
DROP TABLE IF EXISTS public.test_workflows_real;
