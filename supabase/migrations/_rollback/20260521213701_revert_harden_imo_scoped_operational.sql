-- ROLLBACK FOR 20260521213701_harden_imo_scoped_operational.sql
--
-- ⚠️  DO NOT RUN unless Layer 1 (the IMO-scoped operational hardening) is
-- catastrophically wrong and needs to be reverted.
--
-- WHY THIS FILE LIVES IN _rollback/ INSTEAD OF migrations/:
-- The run-migration.sh runner blocks downgrades by tracking function_versions.
-- This file is not a real migration — it is a documented insurance artifact so
-- a human responder has a starting point if Layer 1 needs to be undone in a
-- hurry. To actually use it: copy into supabase/migrations/ with a fresh
-- YYYYMMDDHHMMSS_revert_*.sql filename, then apply via run-migration.sh after
-- explicitly bypassing version tracking (or after dropping the affected
-- function_versions rows).
--
-- WHAT THIS DOES:
--   1. Restores leaky pre-Layer-1 RLS policies on user_profiles, policies,
--      commissions (verbatim from 20260217123227_optimize_rls_auth_function_calls.sql).
--   2. Drops the two triggers added by Layer 1 (enforce_user_profile_imo_consistency,
--      enforce_commission_reference_imo_consistency).
--
-- WHAT THIS DOES NOT DO (intentionally):
--   - Does NOT undo the imo_id backfill. The backfilled values are data
--     integrity gains regardless of RLS state — keep them.
--   - Does NOT drop the NOT NULL constraint on imo_id. Same reason.
--   - Does NOT drop the commissions_update_admin_simple policy that Layer 1
--     removed — that policy hardcoded Nick's old email; do not bring it back.
--
-- SCENARIOS THAT MIGHT JUSTIFY RUNNING THIS:
--   - Mass user lockout because a non-super-admin role is missing a SELECT
--     policy that should exist.
--   - An incident where a critical query path is broken and Nick is on a
--     plane with no laptop. The verification harness (scripts/verify-imo-isolation.sh)
--     should catch this in the staging step BEFORE prod, so this file should
--     stay unused.

-- ---------------------------------------------------------------------------
-- 1. Drop Layer 1 triggers.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS enforce_user_profile_imo_consistency ON public.user_profiles;
DROP TRIGGER IF EXISTS enforce_commission_reference_imo_consistency ON public.commissions;
DROP FUNCTION IF EXISTS public.enforce_user_profile_imo_consistency();
DROP FUNCTION IF EXISTS public.enforce_commission_reference_imo_consistency();

-- ---------------------------------------------------------------------------
-- 2. Restore leaky pre-Layer-1 RLS on user_profiles.
--    Verbatim from 20260217123227_optimize_rls_auth_function_calls.sql except
--    where Layer 1 created new policy names — those new names are dropped and
--    the old leaky names recreated.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all user profiles in own IMO" ON public.user_profiles;
CREATE POLICY "Admins can view all user profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Agents can view approved team members in own IMO" ON public.user_profiles;
CREATE POLICY "Agents can view approved team members"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (approval_status = 'approved' AND email IS NOT NULL);

DROP POLICY IF EXISTS user_profiles_select_admin ON public.user_profiles;
CREATE POLICY user_profiles_select_admin ON public.user_profiles
  FOR SELECT TO authenticated
  USING (is_admin_user((SELECT auth.uid())));

DROP POLICY IF EXISTS user_profiles_select_hierarchy ON public.user_profiles;
CREATE POLICY user_profiles_select_hierarchy ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    (recruiter_id = (SELECT auth.uid()))
    OR (id IN (SELECT downline_id FROM get_downline_ids((SELECT auth.uid())) AS gdi(downline_id)))
    OR (upline_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS user_profiles_select_own_recruiter ON public.user_profiles;
CREATE POLICY user_profiles_select_own_recruiter ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT recruiter_id FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) AS x(upline_id, recruiter_id))
  );

DROP POLICY IF EXISTS user_profiles_select_own_upline ON public.user_profiles;
CREATE POLICY user_profiles_select_own_upline ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT upline_id FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) AS x(upline_id, recruiter_id))
  );

DROP POLICY IF EXISTS user_profiles_select_recruiter ON public.user_profiles;
CREATE POLICY user_profiles_select_recruiter ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'recruiter'::text)
    AND onboarding_status = ANY (ARRAY['lead'::text, 'active'::text])
  );

DROP POLICY IF EXISTS user_profiles_select_view_only ON public.user_profiles;
CREATE POLICY user_profiles_select_view_only ON public.user_profiles
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'view_only'::text));

DROP POLICY IF EXISTS "Uplines can view downline profiles in own IMO" ON public.user_profiles;
CREATE POLICY "Uplines can view downline profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (hierarchy_path LIKE (get_current_user_hierarchy_path() || '.%'));

DROP POLICY IF EXISTS "Admins can update all user profiles in own IMO" ON public.user_profiles;
CREATE POLICY "Admins can update all user profiles"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS user_profiles_update_admin ON public.user_profiles;
CREATE POLICY user_profiles_update_admin ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (is_admin_user((SELECT auth.uid())))
  WITH CHECK (is_admin_user((SELECT auth.uid())));

DROP POLICY IF EXISTS user_profiles_update_contracting ON public.user_profiles;
CREATE POLICY user_profiles_update_contracting ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (has_role((SELECT auth.uid()), 'contracting_manager'::text))
  WITH CHECK (has_role((SELECT auth.uid()), 'contracting_manager'::text));

DROP POLICY IF EXISTS delete_user_policy ON public.user_profiles;
CREATE POLICY delete_user_policy ON public.user_profiles
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR ((SELECT auth.uid()) IN (SELECT u.id FROM user_profiles u WHERE u.is_admin = true))
  );

-- ---------------------------------------------------------------------------
-- 3. Restore leaky pre-Layer-1 RLS on policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Uplines can view downline policies in own IMO" ON public.policies;
CREATE POLICY "Uplines can view downline policies"
  ON public.policies FOR SELECT TO authenticated
  USING (is_upline_of(user_id));

-- ---------------------------------------------------------------------------
-- 4. Restore leaky pre-Layer-1 RLS on commissions.
--    NOTE: commissions_update_admin_simple is NOT restored — it hardcoded
--    Nick's old email. The super_admin policy already covers admin updates.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Uplines can view downline commissions in own IMO" ON public.commissions;
CREATE POLICY "Uplines can view downline commissions"
  ON public.commissions FOR SELECT TO authenticated
  USING (is_upline_of(user_id));
