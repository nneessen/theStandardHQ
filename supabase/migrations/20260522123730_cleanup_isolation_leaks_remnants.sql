-- Cleanup remnants from the 20260522123045 leak-fix migration.
--
-- Two remaining issues found via post-fix audit:
--
-- 1. workflow_events still had the stale "Users can view workflow events in
--    own IMO or own workflows" policy left over from the FIRST (failed) run
--    of 20260522123045. The DROP for that NAME wasn't in the re-run because
--    the original policy was named "Users can view workflow events". The
--    new super_admin-only policy is correct; drop the stale one.
--
-- 2. subscription_plans had `subscription_plans_admin_all` bypass — any
--    is_admin user could manage plans globally. Plans are a global catalog,
--    not Epic Life data, but is_admin should not be able to modify global
--    plan definitions. Tighten to super_admin only.

DROP POLICY IF EXISTS "Users can view workflow events in own IMO or own workflows"
  ON public.workflow_events;

DROP POLICY IF EXISTS subscription_plans_admin_all ON public.subscription_plans;
CREATE POLICY subscription_plans_super_admin_all ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
