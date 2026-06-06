-- ============================================================================
-- Optimize override_commissions RLS: hoist bare STABLE helpers to InitPlans
-- ============================================================================
-- WHY: a normal agent's `SELECT ... FROM override_commissions` measured 5.4s
-- (2936 rows). EXPLAIN shows ~6 permissive policies OR'd in the row Filter, each
-- calling STABLE SECURITY DEFINER helpers BARE -- get_effective_imo_id() (many×),
-- get_my_imo_id(), is_imo_admin(), is_user_approved(), super_admin_in_scope() --
-- re-evaluated for every row scanned (same anti-pattern fixed for user_profiles
-- in 20260603185719). Each bare helper is wrapped here in (SELECT ...) so the
-- planner hoists it to a once-per-query InitPlan.
--
-- super_admin_in_scope(imo_id) takes the row's imo_id (can't be wrapped); it is
-- guarded with the constant InitPlan (SELECT is_super_admin()) -- identical truth
-- value (the fn ANDs is_super_admin() internally), short-circuits per-row for
-- non-super-admins (see 20260603192354 for the proof). Genuinely row-arg helpers
-- is_upline_of(...) / is_agency_owner(...) are left per-row by necessity.
--
-- EQUIVALENCE: wrapping a STABLE scalar fn in (SELECT ...) is value-identical;
-- only call frequency changes. No qual added/removed/reordered. Verified row-set-
-- identical for all prod callers via parity-rls-select.sh override_commissions id.
-- Rollback: ALTER each policy back to the bare-call form (prior catalog state).
-- ============================================================================

BEGIN;

-- super-admin (ALL) — guard the per-row fn with a constant InitPlan
ALTER POLICY "Super admins can manage all override_commissions" ON public.override_commissions
  USING ((SELECT is_super_admin()) AND super_admin_in_scope(imo_id));

-- SELECT policies (the measured hot path)
ALTER POLICY "Uplines can view downline override_commissions" ON public.override_commissions
  USING (
    ((override_agent_id = (SELECT auth.uid())) OR is_upline_of(base_agent_id))
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

ALTER POLICY "Users can view overrides from own policies" ON public.override_commissions
  USING (
    (SELECT auth.uid()) = base_agent_id AND (SELECT is_user_approved())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

ALTER POLICY "Users can view own override commissions" ON public.override_commissions
  USING (
    (SELECT auth.uid()) = override_agent_id AND (SELECT is_user_approved())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

ALTER POLICY "Agency owners can view override_commissions in own agency" ON public.override_commissions
  USING (
    agency_id IS NOT NULL AND imo_id = (SELECT get_my_imo_id()) AND is_agency_owner(agency_id)
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

ALTER POLICY "IMO admins can view all override_commissions in own IMO" ON public.override_commissions
  USING (
    imo_id = (SELECT get_my_imo_id()) AND (SELECT is_imo_admin())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

-- write-path policies (same helpers; fixed for consistency)
ALTER POLICY "Agency owners can delete override_commissions in own agency" ON public.override_commissions
  USING (
    agency_id IS NOT NULL AND imo_id = (SELECT get_my_imo_id()) AND is_agency_owner(agency_id)
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

ALTER POLICY "Agency owners can insert override_commissions in own agency" ON public.override_commissions
  WITH CHECK (
    agency_id IS NOT NULL AND imo_id = (SELECT get_my_imo_id()) AND is_agency_owner(agency_id)
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

ALTER POLICY "Agency owners can update override_commissions in own agency" ON public.override_commissions
  USING (
    agency_id IS NOT NULL AND imo_id = (SELECT get_my_imo_id()) AND is_agency_owner(agency_id)
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

ALTER POLICY "IMO admins can delete override_commissions in own IMO" ON public.override_commissions
  USING (
    imo_id = (SELECT get_my_imo_id()) AND (SELECT is_imo_admin())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

ALTER POLICY "IMO admins can insert override_commissions in own IMO" ON public.override_commissions
  WITH CHECK (
    imo_id = (SELECT get_my_imo_id()) AND (SELECT is_imo_admin())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

ALTER POLICY "IMO admins can update override_commissions in own IMO" ON public.override_commissions
  USING (
    imo_id = (SELECT get_my_imo_id()) AND (SELECT is_imo_admin())
    AND ((SELECT get_effective_imo_id()) IS NULL OR imo_id IS NULL OR imo_id = (SELECT get_effective_imo_id()))
  );

COMMIT;
