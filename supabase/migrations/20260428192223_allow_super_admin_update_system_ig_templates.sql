-- Allow super-admins to UPDATE/DELETE system IG message templates (user_id IS NULL).
--
-- Background: Existing policies `instagram_templates_update_personal` /
-- `instagram_templates_delete_personal` restrict mutations to rows where
-- `user_id = auth.uid()`. All seeded templates have `user_id = NULL`, so they
-- are visible (SELECT policy includes a NULL branch) but cannot be edited or
-- deleted by anyone, including super-admins. PostgREST silently filters them
-- out under RLS, causing `.update().select().single()` to fail with PGRST116
-- and the UI to surface a generic "Failed to update template" toast.
--
-- This migration follows the convention used by pipeline_templates (see
-- 20260127132900_fix_pipeline_rls_policies.sql): add separate `*_super_admin_*`
-- policies alongside the personal ones rather than OR'ing into a single policy.

CREATE POLICY instagram_templates_super_admin_update
  ON public.instagram_message_templates
  FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY instagram_templates_super_admin_delete
  ON public.instagram_message_templates
  FOR DELETE
  TO authenticated
  USING (is_super_admin());
