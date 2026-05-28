-- ============================================================================
-- Platform-sunset M-E — make the deny gate evaluate is_access_revoked ONCE
-- per statement (InitPlan), not once per row.
-- ============================================================================
-- The deny-by-default gate (20260526200139) and the storage gate (20260526200510)
-- both used a BARE call: `NOT public.is_access_revoked(auth.uid())`. An EXPLAIN
-- under the `authenticated` role (2026-05-28 re-review) showed it lands in the
-- per-row Seq Scan **Filter**, NOT an InitPlan — and because is_access_revoked is
-- a SECURITY DEFINER SQL function it is **not inlined**, so it was a function call
-- (+ 2 PK lookups) for every scanned row, on every authenticated query, across all
-- ~194 gated tables, even while dormant. This repo has had two prod outages from
-- per-row RLS-function pool exhaustion, so this is a real regression.
--
-- FIX = wrap the call in a scalar subquery: `NOT (SELECT public.is_access_revoked
-- (auth.uid()))`. The argument is row-independent, so the optimizer hoists it to a
-- single per-statement InitPlan (the documented Supabase RLS performance pattern).
-- Semantically IDENTICAL — the subquery returns the same boolean — so this is a
-- pure performance change and stays fully dormant (NOT (SELECT false) = true for
-- every non-revoked user).
--
-- The completeness tripwire (scripts/check-revocation-gate-completeness.sql)
-- matches on the qual containing `is_access_revoked`, which the wrapped form still
-- satisfies, so coverage accounting is unchanged.
--
-- Mirrors the table set + allowlist of the original gate exactly (relkind='r',
-- relrowsecurity, minus the 5-table allowlist). Idempotent (DROP IF EXISTS).
-- ============================================================================

BEGIN;

-- ── 1. Owned-table deny gate (mirror of 20260526200139, InitPlan-wrapped) ────
DO $rev$
DECLARE
  t text;
  cnt int := 0;
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
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS revocation_deny ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY revocation_deny ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      || 'USING (NOT (SELECT public.is_access_revoked(auth.uid()))) '
      || 'WITH CHECK (NOT (SELECT public.is_access_revoked(auth.uid())))',
      t
    );
    cnt := cnt + 1;
  END LOOP;
  RAISE NOTICE 'revocation_deny re-created with InitPlan wrap on % RLS-enabled tables', cnt;
END
$rev$;

-- ── 2. Storage-objects deny gate (mirror of 20260526200510, InitPlan-wrapped) ─
DROP POLICY IF EXISTS revocation_deny_storage ON storage.objects;

CREATE POLICY revocation_deny_storage ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    bucket_id NOT IN ('user-documents', 'contract-documents', 'presentation-recordings')
    OR NOT (SELECT public.is_access_revoked(auth.uid()))
  )
  WITH CHECK (
    bucket_id NOT IN ('user-documents', 'contract-documents', 'presentation-recordings')
    OR NOT (SELECT public.is_access_revoked(auth.uid()))
  );

COMMIT;
