-- ============================================================================
-- Optimize user_profiles_select_consolidated: hoist STABLE helpers to InitPlans
-- ============================================================================
-- WHY: the consolidated SELECT policy (mig 20260528141931) wrapped auth.uid() as
-- (SELECT auth.uid()) so the planner hoists it into a once-per-query InitPlan,
-- but left every other STABLE SECURITY DEFINER helper as a BARE call on the
-- assumption "the planner hoists them". It does NOT. EXPLAIN (VERBOSE) proves the
-- bare calls -- get_my_imo_id(), get_effective_imo_id() (x4), is_admin(),
-- is_imo_admin(), is_admin_user(...), get_current_user_hierarchy_path(),
-- has_role(...) (x4), is_imo_staff_role(), get_my_agency_id() -- sit inline in the
-- Filter and are re-evaluated FOR EVERY ROW SCANNED. Each is a SECURITY DEFINER
-- function that itself runs a small query, so a single SELECT over N user_profiles
-- fires ~8*N nested SECURITY-DEFINER subqueries. This is the documented Supabase
-- RLS anti-pattern (https://supabase.com/docs/guides/troubleshooting/rls-performance).
--
-- FIX: wrap each scalar STABLE helper whose arguments are constant-per-query in a
-- scalar subselect (SELECT helper(...)). The planner then hoists it to an InitPlan
-- evaluated ONCE per query. EXPLAIN confirms each wrapped call becomes
-- "(InitPlan N).col1" instead of an inline per-row call. Per-row work collapses to
-- bare column comparisons against the precomputed scalars.
--
-- EQUIVALENCE: wrapping a STABLE scalar function in (SELECT ...) is semantically
-- identical -- same value, same NULL semantics -- it only changes HOW OFTEN the
-- value is computed, never WHAT it is. No qual is added, removed, or reordered.
-- Visibility (who-can-see-whom) is unchanged. Proven row-set-identical via the
-- parity harness (scripts/migrations/parity-user-profiles-select.sh: every caller's
-- md5(string_agg of visible ids) is byte-identical before vs after).
--
-- SCOPE: Tier 1 only -- the no-arg / constant-arg helpers. super_admin_in_scope(imo_id)
-- is deliberately LEFT AS-IS: it takes the row's imo_id, so it cannot be wrapped
-- without inlining the function body into the policy (a drift hazard). That is a
-- separate, optional Tier 2 decision.
--
-- Rollback: re-apply 20260528141931 (its policy text is the pre-optimization state).
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS user_profiles_select_consolidated ON public.user_profiles;

CREATE POLICY user_profiles_select_consolidated ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    -- self (user_profiles_select_own)
    ((SELECT auth.uid()) = id)
    -- super admins, in acting scope (Super admins can view all users)
    -- NOTE: per-row by design (takes row imo_id); Tier 2 candidate, left unchanged.
    OR super_admin_in_scope(imo_id)
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
