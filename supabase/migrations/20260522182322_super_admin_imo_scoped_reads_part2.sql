-- =============================================================================
-- Super-admin imo-scoped reads — Part 2 (legacy permission-grant patterns)
-- =============================================================================
--
-- 20260522180703 (Part 1) rewrote 107 super-admin policies that used the
-- pure `is_super_admin()` function or the verbose EXISTS-user_profiles form.
-- It left 4 policies on 4 tables untouched because they use a different
-- shape: `'super_admin' = ANY(user_profiles.roles)` (role-array literal) OR
-- the entire policy is structured as `user_profiles.imo_id = row.imo_id AND
-- role-check` (permission grant, NOT scope-bypass).
--
-- This migration adds super-admin acting-IMO support to those 4 tables by
-- OR-ing `super_admin_in_scope(...)` onto each policy's qual. Non-super-admin
-- behavior is unchanged (the helper returns FALSE for them). Super-admins
-- gain the JWT-claim-scoped read path: claim = NULL → see all; claim set →
-- see only the acting IMO's rows.
--
-- Tables touched:
--   agency_slack_credentials   - "Agency owners can view credential metadata"
--                              - "IMO admins can manage credentials"
--   carrier_underwriting_criteria - "Users can view own IMO criteria"
--                                 - "Admins can update criteria"
--                                 - "Admins can delete criteria"
--   email_templates           - "email_templates_update"
--                              - "email_templates_delete"
--   scheduled_reports         - "Super admins have full access to scheduled_reports"
--                              - "IMO admins can view IMO schedules"
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- agency_slack_credentials
-- Has direct imo_id column. Existing policies use `up.imo_id = X.imo_id AND
-- role` shape; simply OR in the helper.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Agency owners can view credential metadata" ON public.agency_slack_credentials;
CREATE POLICY "Agency owners can view credential metadata"
  ON public.agency_slack_credentials
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agencies a
      WHERE a.id = agency_slack_credentials.agency_id
        AND a.owner_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
        AND up.imo_id = agency_slack_credentials.imo_id
        AND ('imo_admin' = ANY(up.roles) OR 'super_admin' = ANY(up.roles))
    )
    OR super_admin_in_scope(agency_slack_credentials.imo_id)
  );

DROP POLICY IF EXISTS "IMO admins can manage credentials" ON public.agency_slack_credentials;
CREATE POLICY "IMO admins can manage credentials"
  ON public.agency_slack_credentials
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = (SELECT auth.uid())
        AND up.imo_id = agency_slack_credentials.imo_id
        AND ('imo_admin' = ANY(up.roles) OR 'super_admin' = ANY(up.roles))
    )
    OR super_admin_in_scope(agency_slack_credentials.imo_id)
  );

-- ----------------------------------------------------------------------------
-- carrier_underwriting_criteria
-- Has direct imo_id column. Existing policies use the
-- `imo_id IN (SELECT user_profiles.imo_id ... user_profiles.is_super_admin = true)`
-- "permission grant" shape — the subquery returns the user's real imo_id, so
-- super-admin Nick currently sees only Founders. OR-ing the helper preserves
-- existing imo_admin behavior and enables acting for super-admin.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own IMO criteria" ON public.carrier_underwriting_criteria;
CREATE POLICY "Users can view own IMO criteria"
  ON public.carrier_underwriting_criteria
  FOR SELECT
  USING (
    imo_id IN (
      SELECT user_profiles.imo_id
      FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
    )
    OR super_admin_in_scope(imo_id)
  );

DROP POLICY IF EXISTS "Admins can update criteria" ON public.carrier_underwriting_criteria;
CREATE POLICY "Admins can update criteria"
  ON public.carrier_underwriting_criteria
  FOR UPDATE
  USING (
    imo_id IN (
      SELECT user_profiles.imo_id
      FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
        AND (
          user_profiles.roles && ARRAY['imo_admin', 'imo_owner', 'admin', 'super-admin']::text[]
          OR user_profiles.is_super_admin = true
        )
    )
    OR super_admin_in_scope(imo_id)
  );

DROP POLICY IF EXISTS "Admins can delete criteria" ON public.carrier_underwriting_criteria;
CREATE POLICY "Admins can delete criteria"
  ON public.carrier_underwriting_criteria
  FOR DELETE
  USING (
    imo_id IN (
      SELECT user_profiles.imo_id
      FROM user_profiles
      WHERE user_profiles.id = (SELECT auth.uid())
        AND (
          user_profiles.roles && ARRAY['imo_admin', 'imo_owner', 'admin', 'super-admin']::text[]
          OR user_profiles.is_super_admin = true
        )
    )
    OR super_admin_in_scope(imo_id)
  );

-- ----------------------------------------------------------------------------
-- email_templates
-- No imo_id column on the table. Scopes via created_by → user_profiles.imo_id.
-- The existing UPDATE/DELETE policies say "creator OR (admin/super_admin) OR
-- (is_global AND staff)". The middle branch is the leak — any admin can edit
-- any template. Tighten by requiring the editor's effective imo to match the
-- template creator's imo (via a join).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "email_templates_update" ON public.email_templates;
CREATE POLICY "email_templates_update"
  ON public.email_templates
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = created_by
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles editor
        WHERE editor.id = (SELECT auth.uid())
          AND (editor.is_admin = true OR editor.is_super_admin = true)
      )
      AND (
        -- editor's effective IMO must match the template creator's IMO
        get_effective_imo_id() IS NULL
        OR EXISTS (
          SELECT 1 FROM user_profiles creator
          WHERE creator.id = email_templates.created_by
            AND creator.imo_id = get_effective_imo_id()
        )
      )
    )
    OR (is_global = true AND is_imo_staff_role())
    OR super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = email_templates.created_by))
  );

DROP POLICY IF EXISTS "email_templates_delete" ON public.email_templates;
CREATE POLICY "email_templates_delete"
  ON public.email_templates
  FOR DELETE
  USING (
    (SELECT auth.uid()) = created_by
    OR (
      EXISTS (
        SELECT 1 FROM user_profiles editor
        WHERE editor.id = (SELECT auth.uid())
          AND (editor.is_admin = true OR editor.is_super_admin = true)
      )
      AND (
        get_effective_imo_id() IS NULL
        OR EXISTS (
          SELECT 1 FROM user_profiles creator
          WHERE creator.id = email_templates.created_by
            AND creator.imo_id = get_effective_imo_id()
        )
      )
    )
    OR (is_global = true AND is_imo_staff_role())
    OR super_admin_in_scope((SELECT imo_id FROM user_profiles WHERE id = email_templates.created_by))
  );

-- ----------------------------------------------------------------------------
-- scheduled_reports
-- Has direct imo_id column. The "Super admins have full access" policy uses
-- the role-array literal form ('super_admin' = ANY(user_profiles.roles))
-- instead of `is_super_admin = true` — that's why Part 1's regex didn't match.
-- Rewrite it cleanly with super_admin_in_scope. The "IMO admins" policy uses
-- the user-imo = row-imo shape; OR in the helper for acting support.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admins have full access to scheduled_reports" ON public.scheduled_reports;
CREATE POLICY "Super admins have full access to scheduled_reports"
  ON public.scheduled_reports
  FOR ALL
  USING (super_admin_in_scope(imo_id));

DROP POLICY IF EXISTS "IMO admins can view IMO schedules" ON public.scheduled_reports;
CREATE POLICY "IMO admins can view IMO schedules"
  ON public.scheduled_reports
  FOR SELECT
  USING (
    imo_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = (SELECT auth.uid())
          AND 'imo_admin' = ANY(user_profiles.roles)
          AND user_profiles.imo_id = scheduled_reports.imo_id
      )
      OR super_admin_in_scope(imo_id)
    )
  );

-- ----------------------------------------------------------------------------
-- Final assertion: no scopable super-admin policy should remain unscoped.
-- ----------------------------------------------------------------------------
DO $assert$
DECLARE
  unscoped_count int;
  unscoped_examples text;
  global_tables_excluded constant text[] := ARRAY[
    'imos','permissions','roles','role_permissions',
    'subscription_plans','subscription_addons','subscription_plan_changes','subscription_settings',
    'sync_hierarchy_root','system_audit_log','system_settings',
    'global_expense_categories','underwriting_health_conditions',
    'workflow_events','notification_digest_log'
  ];
BEGIN
  WITH leftovers AS (
    SELECT tablename, policyname
      FROM pg_policies
     WHERE schemaname='public'
       AND NOT (tablename = ANY(global_tables_excluded))
       AND (qual::text ~ 'super_admin' OR with_check::text ~ 'super_admin')
       AND NOT (qual::text ~ 'super_admin_in_scope' OR with_check::text ~ 'super_admin_in_scope')
  )
  SELECT COUNT(*), string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname)
    INTO unscoped_count, unscoped_examples
    FROM leftovers;

  IF unscoped_count > 0 THEN
    RAISE EXCEPTION 'Part 2 leftover: % scopable policies still reference super_admin without super_admin_in_scope: %',
      unscoped_count, unscoped_examples;
  ELSE
    RAISE NOTICE 'All scopable super-admin policies now reference super_admin_in_scope';
  END IF;
END
$assert$;

COMMIT;
