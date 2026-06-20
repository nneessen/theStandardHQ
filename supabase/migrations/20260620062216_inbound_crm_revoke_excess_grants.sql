-- ============================================================================
-- Inbound-CRM security hardening: revoke excess direct table grants.
--
-- FINDING (verified by scripts/crm-security-edge-tests.sh): anon + authenticated held FULL grants
-- (INSERT/UPDATE/DELETE/TRUNCATE/SELECT/REFERENCES/TRIGGER) on the three inbound-CRM tables.
-- TRUNCATE in particular BYPASSES row-level security entirely, so the grant let any role wipe call
-- data, dialer credentials, and agent mappings across every tenant. Not reachable through the REST
-- API today (PostgREST doesn't expose TRUNCATE and enforces RLS on CRUD), but RLS was the SOLE
-- barrier — a defense-in-depth gap identical to the app_config hardening (PR #25).
--
-- SAFE because every write goes through SECURITY DEFINER RPCs (crm_upsert_call /
-- crm_set_call_disposition / crm_set_client_intake / crm_patch_billable / crm_lookup_aor), which run
-- as the function owner and do not need direct grants; the dialer edge functions use service_role.
-- Reads stay RLS-gated, so we KEEP `SELECT` for `authenticated`:
--   inbound_calls                 -> inbound_calls_select_own (agent reads own calls; the rail/feed)
--   imo_call_platform_credentials -> super-admin-only read
--   imo_agent_external_ids        -> super-admin-only read
-- `anon` never legitimately reads any of these (no anon RLS policy), so it loses SELECT too.
-- Frontend touches these tables read-only (verified: 3 .select() sites, zero direct writes).
--
-- This revokes the SQL-standard privileges only. The Supabase project-baseline MAINTAIN grant
-- (VACUUM/ANALYZE/REINDEX/… — top-level utility commands, unreachable via PostgREST) is intentionally
-- LEFT on anon/authenticated: it is present on ~205/211 public tables and carries no row-data or
-- cross-tenant exposure. Do NOT add `REVOKE ... MAINTAIN`: the keyword does not exist before
-- PostgreSQL 17 and would abort this migration on PG 15/16.
-- ============================================================================

-- Fail fast rather than queue behind a live INSERT: each REVOKE briefly takes ACCESS EXCLUSIVE on the
-- (hot) inbound_calls screen-pop table. Apply during low call volume.
SET lock_timeout = '3s';

-- inbound_calls: keep authenticated SELECT (Recent Calls feed + intake modal); drop the rest.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.inbound_calls FROM anon, authenticated, PUBLIC;
REVOKE SELECT ON public.inbound_calls FROM anon, PUBLIC;

-- imo_call_platform_credentials (holds the bcrypt client_secret_hash): keep authenticated SELECT
-- (super-admin RLS); drop the rest, especially TRUNCATE.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.imo_call_platform_credentials FROM anon, authenticated, PUBLIC;
REVOKE SELECT ON public.imo_call_platform_credentials FROM anon, PUBLIC;

-- imo_agent_external_ids: keep authenticated SELECT (super-admin RLS); drop the rest.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.imo_agent_external_ids FROM anon, authenticated, PUBLIC;
REVOKE SELECT ON public.imo_agent_external_ids FROM anon, PUBLIC;
