-- ============================================================================
-- Revocation gate — DENY-BY-DEFAULT (DORMANT)
-- ============================================================================
-- Migration A patched get_effective_imo_id() to return a sentinel for revoked
-- users, but that only denies tables whose RLS policies REFERENCE the chokepoint.
-- A 2026-05-27 gate-completeness review proved the gap is STRUCTURAL: dozens of
-- tables match on a bare `<owner> = auth.uid()` (or an inlined imo lookup) and
-- never hit the chokepoint — e.g. user_targets, chargebacks, messages,
-- carrier_contracts, roadmap_item_progress, team_*_seats. A hand-maintained
-- allowlist of "owned" tables had already missed 8 of them. Enumerating what to
-- DENY is the wrong default for a kill-switch.
--
-- FIX — flip the default. A revocation kill-switch is a WHITELIST: deny reads to
-- a revoked user on EVERYTHING, allow only the handful of tables the user's own
-- session legitimately needs before the sunset page renders. We attach one
-- RESTRICTIVE `revocation_deny` policy to EVERY RLS-enabled public base table
-- except a tiny allowlist. A RESTRICTIVE policy is AND-ed with the permissive
-- policies, so a revoked user is denied regardless of how any permissive policy
-- (including an `imo_id IS NULL` disjunct) would have passed. New tables added
-- later are caught by scripts/check-revocation-gate-completeness.sql.
--
-- READS deny-by-default (this migration). DESTRUCTION stays an explicit allowlist
-- (the owned-tables registry drives wipe_user_business_data + the export bundle).
-- Opposite defaults on purpose: you should never have to remember to DENY a read,
-- and you should always have to remember to DELETE a row.
--
-- DORMANT: for any non-revoked user (and every super-admin) is_access_revoked()
-- returns false -> `NOT false` = true -> the restrictive policy always passes ->
-- ZERO behavior change until an IMO is revoked. Over-gating costs one cheap
-- cached EXISTS per query, only when evaluated.
--
-- Service-role (export/wipe edge functions) BYPASSES RLS entirely, so the export
-- and wipe paths keep working while the user's own JWT is denied.
--
-- ALLOWLIST (intentionally NOT gated) — what a revoked session reads BEFORE the
-- SunsetGate renders, traced from AuthContext + ImoProvider:
--   user_profiles  — auth loads the caller's profile (who am I)
--   imos           — ImoProvider reads imos.access_revoked_at to DETECT revocation
--   agencies       — embedded in ImoRepository.findWithAgencies()'s imo load
--   data_export_log, account_deletion_log — service-role-only audit (no
--                    authenticated access anyway; listed for clarity)
-- If the sunset page ever needs another table under the user's JWT, add it here
-- (and prefer a service-role edge fn instead, to keep the allowlist minimal).
--
-- RLS BLIND SPOTS (relkind scope = 'r' ordinary tables only):
--   * Materialized views (relkind 'm') cannot enforce RLS. The 8 public mv_*
--     are user-scoped (one holds client PII) BUT currently carry NO SELECT grant
--     to authenticated or anon (they may hold other, non-SELECT grants; the
--     security-relevant property is the absence of SELECT — verified via
--     has_table_privilege), so a revoked user cannot reach them through
--     PostgREST. INVARIANT: never GRANT SELECT on these to authenticated/anon —
--     front them with SECURITY DEFINER RPCs that call is_access_revoked(). If
--     that invariant changes, the kill switch leaks.
--   * Partitioned tables (relkind 'p'): none exist today; if one is added, RLS
--     attaches to the parent 'p' and this loop + the completeness tripwire must
--     extend to relkind IN ('r','p').
-- ============================================================================

BEGIN;

DO $rev$
DECLARE
  t text;
  cnt int := 0;
  -- Tables a revoked session must still read (or service-role-only audit).
  allowlist text[] := ARRAY[
    'user_profiles', 'imos', 'agencies', 'data_export_log', 'account_deletion_log'
  ];
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind = 'r'             -- ordinary base tables only
      AND c.relrowsecurity = true     -- RLS enabled (a deny policy is meaningful)
      AND c.relname <> ALL (allowlist)
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS revocation_deny ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY revocation_deny ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      || 'USING (NOT public.is_access_revoked(auth.uid())) '
      || 'WITH CHECK (NOT public.is_access_revoked(auth.uid()))',
      t
    );
    cnt := cnt + 1;
  END LOOP;
  RAISE NOTICE 'revocation_deny (deny-by-default) applied to % RLS-enabled tables; allowlist = %',
    cnt, allowlist;
END
$rev$;

COMMIT;
