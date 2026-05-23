-- =============================================================================
-- A user can always read their own user_profiles row, regardless of acting IMO
-- =============================================================================
--
-- The universal IMO gate (20260523065348) tightened `user_profiles_select_own`
-- to require `imo_id = get_effective_imo_id()`. But that breaks AuthContext:
-- when super-admin Nick acts as Epic, his real profile (imo_id = Founders) is
-- hidden — and Nick's session can't load his own `is_super_admin` flag, agency
-- info, etc. The app effectively can't tell who he is, and the IMO switcher
-- disappears so he can't switch back.
--
-- This row is auth identity, not tenant data. Restore the "see your own row
-- always" semantic.
-- =============================================================================

DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;

CREATE POLICY user_profiles_select_own
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- For symmetry, also restore "update your own row" without the imo gate so
-- a super-admin acting on another IMO can still update their own profile
-- (settings, password change, etc.).
DROP POLICY IF EXISTS user_profiles_update_own ON public.user_profiles;

CREATE POLICY user_profiles_update_own
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
