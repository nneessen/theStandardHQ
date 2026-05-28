-- Rollback for 20260528141931_consolidate_user_profiles_select_policies.sql
-- Drops the consolidated policy and re-creates the 16 original user_profiles
-- SELECT policies verbatim (quals captured from pg_policies pre-consolidation).
-- Apply with run-migration.sh if the consolidation ever needs reverting.

BEGIN;

DROP POLICY IF EXISTS user_profiles_select_consolidated ON public.user_profiles;

CREATE POLICY "Admins can view all user profiles in own IMO" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (is_admin() AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "Agents can view approved team members in own IMO" ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((approval_status = 'approved'::text) AND (email IS NOT NULL) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "IMO admins can view all users in own IMO" ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((imo_id = get_my_imo_id()) AND is_imo_admin() AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "Super admins can view all users" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (super_admin_in_scope(imo_id));

CREATE POLICY "Uplines can view downline profiles in own IMO" ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((hierarchy_path ~~ (get_current_user_hierarchy_path() || '.%'::text)) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "agency_members_can_view_same_agency" ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((agency_id IS NOT NULL) AND (agency_id = get_my_agency_id()) AND (approval_status = 'approved'::text) AND (archived_at IS NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "contracting_managers_view_imo_recruits" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'contracting_manager'::text) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ('recruit'::text = ANY (roles)) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "imo_staff_view_imo_agents" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (is_imo_staff_role() AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ('agent'::text = ANY (roles)) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "trainers_view_imo_recruits" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'trainer'::text) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ('recruit'::text = ANY (roles)) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "user_profiles_select_admin" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (is_admin_user((SELECT auth.uid())) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "user_profiles_select_hierarchy" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (((recruiter_id = (SELECT auth.uid())) OR (id IN (SELECT gdi.downline_id FROM get_downline_ids((SELECT auth.uid())) gdi(downline_id))) OR (upline_id = (SELECT auth.uid()))) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "user_profiles_select_own" ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "user_profiles_select_own_recruiter" ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((id = (SELECT x.recruiter_id FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) x(upline_id, recruiter_id))) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "user_profiles_select_own_upline" ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((id = (SELECT x.upline_id FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) x(upline_id, recruiter_id))) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "user_profiles_select_recruiter" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'recruiter'::text) AND (onboarding_status = ANY (ARRAY['lead'::text, 'active'::text])) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

CREATE POLICY "user_profiles_select_view_only" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (has_role((SELECT auth.uid()), 'view_only'::text) AND (imo_id = get_my_imo_id()) AND (imo_id IS NOT NULL) AND ((get_effective_imo_id() IS NULL) OR (imo_id IS NULL) OR (imo_id = get_effective_imo_id())));

COMMIT;
