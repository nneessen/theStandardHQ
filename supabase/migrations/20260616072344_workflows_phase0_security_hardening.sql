-- Workflows Phase 0 — security hardening
-- 1) Lock down the workflow rate-limit / email-tracking SECURITY DEFINER functions.
--    They are only ever invoked server-side by the process-workflow edge function
--    using the service-role key. They were EXECUTE-granted to anon + authenticated,
--    which let any (even unauthenticated) caller poison another user's rate-limit
--    records and read cross-IMO email usage. Revoke from anon + authenticated;
--    service_role + owner retain EXECUTE.
-- 2) trigger_event_types is a GLOBAL registry (no imo_id). Two overly-broad write
--    policies let ANY IMO admin mutate it for every tenant. Replace them with a
--    super-admin-only write policy. SELECT policies are unchanged.

-- ---------------------------------------------------------------------------
-- 1) Revoke EXECUTE on the rate-limit / tracking functions
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION
  public.check_workflow_email_rate_limit(uuid, uuid, text, integer)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.record_workflow_email(uuid, uuid, text, text, boolean, text)
  FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION
  public.get_workflow_email_usage(uuid)
  FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) trigger_event_types: super-admin-only writes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage event types" ON public.trigger_event_types;
DROP POLICY IF EXISTS "Only admins can manage trigger event types" ON public.trigger_event_types;

-- One permissive ALL policy gated on super-admin. Because it is permissive it
-- ORs with the existing SELECT policies (so non-super-admins keep read access),
-- while INSERT/UPDATE/DELETE now require super-admin (no other write policy exists).
CREATE POLICY "Super admins manage trigger event types"
  ON public.trigger_event_types
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
