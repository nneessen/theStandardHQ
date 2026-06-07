-- ============================================================================
-- Tenant-scope SELECT on communication_consent + communication_suppression.
-- ============================================================================
-- Both tables carry imo_id (+ user_id) but their SELECT policy was USING (true),
-- making every IMO's consent/suppression PII (contact_value = phone/email,
-- ip_address, consent_text) world-readable to ANY authenticated user — a latent
-- cross-IMO read leak surfaced by scripts/check-tenant-isolation.sql.
--
-- Safe to tighten: no authenticated-client code path SELECTs these tables
-- directly. All access is via SECURITY DEFINER functions (record_consent,
-- add_suppression, is_suppressed, remove_suppression) or the service-role
-- email-unsubscribe edge function — all of which bypass RLS. Both tables had
-- 0 rows at migration time, so there is no live exposure; this closes the
-- structural gap.
--
-- The new predicate is identical to the carriers/products/comp_guide SELECT
-- policy: a user sees only their effective IMO's rows (acting-IMO aware for
-- super-admins). No super-admin see-all branch — consent/suppression is read
-- one IMO at a time via the IMO selector, matching the unified tenant model.
-- ============================================================================

DROP POLICY IF EXISTS communication_consent_read ON public.communication_consent;
CREATE POLICY communication_consent_read ON public.communication_consent
  FOR SELECT TO authenticated
  USING (
    imo_id = get_my_imo_id()
    AND (get_effective_imo_id() IS NULL OR imo_id = get_effective_imo_id())
  );

DROP POLICY IF EXISTS communication_suppression_read ON public.communication_suppression;
CREATE POLICY communication_suppression_read ON public.communication_suppression
  FOR SELECT TO authenticated
  USING (
    imo_id = get_my_imo_id()
    AND (get_effective_imo_id() IS NULL OR imo_id = get_effective_imo_id())
  );
