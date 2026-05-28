-- ============================================================================
-- Platform-sunset gate backfill — close the deny-by-default gap for tables
-- added to the catalog AFTER the original gate migration ran.
-- ============================================================================
-- The deny-by-default gate (20260526200139, InitPlan-wrapped by 20260528083601)
-- attaches a RESTRICTIVE `revocation_deny` policy to every RLS-enabled public
-- base table except a 5-table allowlist. The completeness tripwire
-- (scripts/check-revocation-gate-completeness.sql) must return 0.
--
-- It regressed to 5 because the Jarvis assistant feature added 5 new RLS tables
-- (assistant_conversations, assistant_messages, assistant_tool_calls,
-- assistant_action_requests, assistant_preferences) to the DB after the gate was
-- built, so they never received `revocation_deny`. They are user-scoped and
-- CASCADE-delete with user_profiles (so the wipe already covers them), but
-- without the deny policy a revoked user could still read their OWN rows during
-- the revocation window — a deny-by-default completeness gap.
--
-- This migration re-runs the gate loop but ONLY for tables that are missing the
-- policy (idempotent; leaves the existing ~194 gated tables untouched). Uses the
-- current InitPlan-wrapped form so coverage + perf match the rest of the gate.
-- ============================================================================

BEGIN;

DO $rev$
DECLARE
  t   text;
  cnt int := 0;
  -- Same allowlist as the gate migration: tables a revoked session must still
  -- read for auth/branding, or service-role-only audit tables.
  allowlist text[] := ARRAY[
    'user_profiles', 'imos', 'agencies', 'data_export_log', 'account_deletion_log'
  ];
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    WHERE c.relkind = 'r'
      AND c.relrowsecurity = true
      AND c.relname <> ALL (allowlist)
      AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
          AND p.policyname = 'revocation_deny'
      )
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'CREATE POLICY revocation_deny ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      || 'USING (NOT (SELECT public.is_access_revoked(auth.uid()))) '
      || 'WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())))',
      t
    );
    cnt := cnt + 1;
    RAISE NOTICE 'revocation_deny backfilled on public.%', t;
  END LOOP;
  RAISE NOTICE 'gate backfill complete: % newly-gated table(s)', cnt;
END
$rev$;

COMMIT;
