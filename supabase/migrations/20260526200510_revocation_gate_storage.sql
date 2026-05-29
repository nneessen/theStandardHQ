-- ============================================================================
-- Revocation gate on user-owned Storage objects (DORMANT)
-- ============================================================================
-- The self-scoped storage.objects policies for the private user buckets match
-- on the `auth.uid()` path prefix and never consult the revocation chokepoint,
-- so a revoked user could still read/download their own files via the Storage
-- API. Close it with a RESTRICTIVE policy (AND-ed on top of the existing
-- permissive policies) scoped to the three PRIVATE user-owned buckets:
--   - user-documents          ({user_id}/...)
--   - contract-documents      ({agent_id}/...)
--   - presentation-recordings ({user_id}/...)
--
-- Scoped to those buckets only so shared/public buckets (imo-assets,
-- recruiting-assets, workspace-logos, …) are untouched — the sunset page may
-- render IMO branding, and other tenants' access must not change.
--
-- DORMANT: NOT public.is_access_revoked(auth.uid()) is TRUE for every
-- non-revoked user and every super-admin -> the policy always passes -> zero
-- behavior change until an IMO is revoked. Service-role (export/wipe edge
-- functions) bypasses RLS and is unaffected.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS revocation_deny_storage ON storage.objects;

CREATE POLICY revocation_deny_storage ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    bucket_id NOT IN ('user-documents', 'contract-documents', 'presentation-recordings')
    OR NOT public.is_access_revoked(auth.uid())
  )
  WITH CHECK (
    bucket_id NOT IN ('user-documents', 'contract-documents', 'presentation-recordings')
    OR NOT public.is_access_revoked(auth.uid())
  );

COMMIT;
