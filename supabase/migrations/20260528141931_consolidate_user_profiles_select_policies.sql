-- ============================================================================
-- Consolidate user_profiles' 16 permissive SELECT policies into ONE
-- ============================================================================
-- WHY: user_profiles had 16 permissive SELECT policies. That 16-way OR is the
-- amplifier behind the statement_timeout 500s: any other table whose RLS does
-- `EXISTS (SELECT ... FROM user_profiles ...)` (23+ tables) makes the planner
-- expand all 16 recursively → 5700+ InitPlans → ~26s PLANNING time. Collapsing
-- to one policy makes those nested expansions cheap.
--
-- EQUIVALENCE: the single USING below is a faithful 1:1 OR of the 16 original
-- quals (self / super-admin / agency / + the 13 in-IMO role/relationship tests),
-- with the shared imo scope tail factored out once. auth.uid() is wrapped as
-- (SELECT auth.uid()) per the repo idiom; the STABLE SECURITY DEFINER helpers
-- are left bare (planner hoists them). Proven row-set-identical for all 115
-- live users (every caller archetype) via the equivalence harness before apply.
-- Rollback: supabase/migrations/_rollback/20260528141931_..._rollback.sql.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Admins can view all user profiles in own IMO" ON public.user_profiles;
DROP POLICY IF EXISTS "Agents can view approved team members in own IMO" ON public.user_profiles;
DROP POLICY IF EXISTS "IMO admins can view all users in own IMO" ON public.user_profiles;
DROP POLICY IF EXISTS "Super admins can view all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Uplines can view downline profiles in own IMO" ON public.user_profiles;
DROP POLICY IF EXISTS "agency_members_can_view_same_agency" ON public.user_profiles;
DROP POLICY IF EXISTS "contracting_managers_view_imo_recruits" ON public.user_profiles;
DROP POLICY IF EXISTS "imo_staff_view_imo_agents" ON public.user_profiles;
DROP POLICY IF EXISTS "trainers_view_imo_recruits" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_admin" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_hierarchy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own_recruiter" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_own_upline" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_recruiter" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_view_only" ON public.user_profiles;

CREATE POLICY user_profiles_select_consolidated ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    -- self (user_profiles_select_own)
    ((SELECT auth.uid()) = id)
    -- super admins, in acting scope (Super admins can view all users)
    OR super_admin_in_scope(imo_id)
    -- everything IMO-scoped: same imo + acting-scope tail, then the role/relationship tests
    OR (
      imo_id = get_my_imo_id()
      AND imo_id IS NOT NULL
      AND (get_effective_imo_id() IS NULL OR imo_id IS NULL OR imo_id = get_effective_imo_id())
      AND (
        is_admin()                                                          -- Admins ... own IMO
        OR is_imo_admin()                                                   -- IMO admins ... own IMO
        OR is_admin_user((SELECT auth.uid()))                               -- user_profiles_select_admin
        OR (approval_status = 'approved' AND email IS NOT NULL)             -- Agents view approved team
        OR (hierarchy_path ~~ (get_current_user_hierarchy_path() || '.%'::text))  -- Uplines view downline
        OR (                                                                -- user_profiles_select_hierarchy
          recruiter_id = (SELECT auth.uid())
          OR id IN (SELECT gdi.downline_id FROM get_downline_ids((SELECT auth.uid())) gdi(downline_id))
          OR upline_id = (SELECT auth.uid())
        )
        OR id = (SELECT x.upline_id    FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) x(upline_id, recruiter_id))     -- own_upline
        OR id = (SELECT x.recruiter_id FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) x(upline_id, recruiter_id))     -- own_recruiter
        OR (has_role((SELECT auth.uid()), 'recruiter'::text) AND onboarding_status = ANY (ARRAY['lead'::text, 'active'::text]))    -- recruiter
        OR (has_role((SELECT auth.uid()), 'contracting_manager'::text) AND 'recruit'::text = ANY (roles))  -- contracting_managers_view_imo_recruits
        OR (is_imo_staff_role() AND 'agent'::text = ANY (roles))            -- imo_staff_view_imo_agents
        OR (has_role((SELECT auth.uid()), 'trainer'::text) AND 'recruit'::text = ANY (roles))  -- trainers_view_imo_recruits
        OR has_role((SELECT auth.uid()), 'view_only'::text)                 -- user_profiles_select_view_only
      )
    )
    -- same-agency members (agency_members_can_view_same_agency) — agency-scoped, not imo-scoped
    OR (
      agency_id IS NOT NULL
      AND agency_id = get_my_agency_id()
      AND approval_status = 'approved'
      AND archived_at IS NULL
      AND (get_effective_imo_id() IS NULL OR imo_id IS NULL OR imo_id = get_effective_imo_id())
    )
  );

COMMIT;
