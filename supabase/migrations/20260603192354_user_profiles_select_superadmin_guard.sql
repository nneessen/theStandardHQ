-- ============================================================================
-- Tier 2: guard the last per-row helper in user_profiles_select_consolidated
-- ============================================================================
-- After mig 20260603185719 (Tier 1) the ONLY remaining per-row function call in
-- the policy Filter is super_admin_in_scope(imo_id) -- it takes the row's imo_id
-- so it can't be wrapped in (SELECT ...). It runs once per row scanned, and
-- internally calls is_super_admin() + get_effective_imo_id().
--
-- FIX (drift-free): super_admin_in_scope(x) is defined as
--     is_super_admin() AND (get_effective_imo_id() IS NULL OR x = get_effective_imo_id())
-- so guarding it with a constant InitPlan is logically identical:
--     (SELECT is_super_admin()) AND super_admin_in_scope(imo_id)
--   = is_super_admin() AND [is_super_admin() AND (...)]          -- A AND (A AND B)
--   = is_super_admin() AND (...)                                 -- = A AND B
-- The (SELECT is_super_admin()) is hoisted to a once-per-query InitPlan. When it
-- is FALSE (true for ~every user -- super-admins are rare), AND short-circuits and
-- super_admin_in_scope is NEVER called per row. When it is TRUE (a super-admin
-- session only), the per-row call still runs but that user population is tiny.
--
-- Unlike inlining super_admin_in_scope's body into the policy, this keeps the
-- function as the single source of truth -- it is used by ~28 other policies, so
-- no logic is duplicated and there is no drift hazard if the function changes.
--
-- EQUIVALENCE: provably identical truth value for every row; verified row-set-
-- identical for all prod callers via parity-user-profiles-select.sh.
-- Rollback: re-apply 20260603185719.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS user_profiles_select_consolidated ON public.user_profiles;

CREATE POLICY user_profiles_select_consolidated ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    -- self (user_profiles_select_own)
    ((SELECT auth.uid()) = id)
    -- super admins, in acting scope (Super admins can view all users)
    -- constant InitPlan guard => per-row super_admin_in_scope only fires for super-admins
    OR ((SELECT is_super_admin()) AND super_admin_in_scope(imo_id))
    -- everything IMO-scoped: same imo + acting-scope tail, then the role/relationship tests
    OR (
      imo_id = (SELECT get_my_imo_id())
      AND imo_id IS NOT NULL
      AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
      AND (
        (SELECT is_admin())                                                 -- Admins ... own IMO
        OR (SELECT is_imo_admin())                                          -- IMO admins ... own IMO
        OR (SELECT is_admin_user((SELECT auth.uid())))                      -- user_profiles_select_admin
        OR (approval_status = 'approved' AND email IS NOT NULL)             -- Agents view approved team
        OR (hierarchy_path ~~ ((SELECT get_current_user_hierarchy_path()) || '.%'::text))  -- Uplines view downline
        OR (                                                                -- user_profiles_select_hierarchy
          recruiter_id = (SELECT auth.uid())
          OR id IN (SELECT gdi.downline_id FROM get_downline_ids((SELECT auth.uid())) gdi(downline_id))
          OR upline_id = (SELECT auth.uid())
        )
        OR id = (SELECT x.upline_id    FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) x(upline_id, recruiter_id))     -- own_upline
        OR id = (SELECT x.recruiter_id FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) x(upline_id, recruiter_id))     -- own_recruiter
        OR ((SELECT has_role((SELECT auth.uid()), 'recruiter'::text)) AND onboarding_status = ANY (ARRAY['lead'::text, 'active'::text]))    -- recruiter
        OR ((SELECT has_role((SELECT auth.uid()), 'contracting_manager'::text)) AND 'recruit'::text = ANY (roles))  -- contracting_managers_view_imo_recruits
        OR ((SELECT is_imo_staff_role()) AND 'agent'::text = ANY (roles))   -- imo_staff_view_imo_agents
        OR ((SELECT has_role((SELECT auth.uid()), 'trainer'::text)) AND 'recruit'::text = ANY (roles))  -- trainers_view_imo_recruits
        OR (SELECT has_role((SELECT auth.uid()), 'view_only'::text))        -- user_profiles_select_view_only
      )
    )
    -- same-agency members (agency_members_can_view_same_agency) — agency-scoped, not imo-scoped
    OR (
      agency_id IS NOT NULL
      AND agency_id = (SELECT get_my_agency_id())
      AND approval_status = 'approved'
      AND archived_at IS NULL
      AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
    )
  );

COMMIT;
