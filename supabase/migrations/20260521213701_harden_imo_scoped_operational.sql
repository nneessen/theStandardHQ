-- Harden IMO-scoped operational data: user_profiles, policies, commissions.
--
-- The May 2026 settings hardening (20260519090000_harden_imo_scoped_settings.sql)
-- left three operational tables with cross-IMO read leaks:
--   * user_profiles: 'Agents can view approved team members' was visible to every
--     authenticated user globally; admin/recruiter/view_only/hierarchy policies
--     bypassed imo_id; result was that any FFG/Self Made user could SELECT
--     user_profiles across all IMOs.
--   * policies, commissions: 'Uplines can view downline X' and admin policies
--     ignored imo_id, leaking cross-IMO operational data.
--
-- This migration:
--   1. Backfills imo_id on all three tables (3-tier fallback: agency -> recruiter
--      -> upline for user_profiles; user-derivation for policies; policy/user
--      derivation + Founders fallback for legacy adjustment commissions).
--   2. Adds NOT NULL on imo_id.
--   3. Adds a commissions IMO-consistency trigger (mirror of the existing
--      policies trigger from the May migration).
--   4. Adds a user_profiles trigger that requires imo_id on INSERT (inherits
--      from agency/recruiter/upline/auth-caller in that order).
--   5. DROP + CREATE each leaky RLS policy with an additional imo_id guard.
--      Super-admin policies are preserved unchanged so Nick retains cross-IMO
--      visibility.
--
-- Anti-downgrade: this migration is additive and idempotent (DROP IF EXISTS,
-- CREATE IF NOT EXISTS where supported, COALESCE-guarded updates) so the
-- migration runner's function-version check passes cleanly.

-- ---------------------------------------------------------------------------
-- 1. Backfill imo_id on user_profiles (agency -> recruiter -> upline).
-- ---------------------------------------------------------------------------
UPDATE public.user_profiles up
SET imo_id = a.imo_id
FROM public.agencies a
WHERE up.imo_id IS NULL
  AND up.agency_id = a.id
  AND a.imo_id IS NOT NULL;

UPDATE public.user_profiles up
SET imo_id = recruiter.imo_id
FROM public.user_profiles recruiter
WHERE up.imo_id IS NULL
  AND up.recruiter_id = recruiter.id
  AND recruiter.imo_id IS NOT NULL;

UPDATE public.user_profiles up
SET imo_id = upline.imo_id
FROM public.user_profiles upline
WHERE up.imo_id IS NULL
  AND up.upline_id = upline.id
  AND upline.imo_id IS NOT NULL;

-- Any user_profile still NULL after three tiers is genuinely orphaned (no
-- agency, no recruiter, no upline). Fail loudly so we don't silently mis-assign.
DO $$
DECLARE
  v_orphan_count int;
BEGIN
  SELECT count(*) INTO v_orphan_count FROM public.user_profiles WHERE imo_id IS NULL;
  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot backfill user_profiles.imo_id: % rows have no agency, recruiter, or upline to derive IMO from. Manually assign before re-running.', v_orphan_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Backfill imo_id on policies (derive from user_profiles).
--    The enforce_policy_reference_imo_consistency trigger from the May
--    settings migration already keeps new writes correct; this catches
--    any pre-trigger rows.
-- ---------------------------------------------------------------------------
UPDATE public.policies p
SET imo_id = u.imo_id
FROM public.user_profiles u
WHERE p.imo_id IS NULL
  AND p.user_id = u.id
  AND u.imo_id IS NOT NULL;

DO $$
DECLARE
  v_orphan_count int;
BEGIN
  SELECT count(*) INTO v_orphan_count FROM public.policies WHERE imo_id IS NULL;
  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot backfill policies.imo_id: % rows have no derivable IMO. Manually assign before re-running.', v_orphan_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Backfill imo_id on commissions (policy -> user -> Founders fallback for
--    pre-multi-IMO adjustment rows).
-- ---------------------------------------------------------------------------
UPDATE public.commissions c
SET imo_id = p.imo_id
FROM public.policies p
WHERE c.imo_id IS NULL
  AND c.policy_id = p.id
  AND p.imo_id IS NOT NULL;

UPDATE public.commissions c
SET imo_id = u.imo_id
FROM public.user_profiles u
WHERE c.imo_id IS NULL
  AND c.user_id = u.id
  AND u.imo_id IS NOT NULL;

-- Legacy manually-entered commission adjustments (Dec 2025 - Jan 2026, all
-- with NULL policy_id and NULL user_id) predate multi-IMO architecture and
-- represent Founders Financial Group revenue. Attribute explicitly rather
-- than via 'oldest IMO' heuristic so a fresh-DB re-run does not mis-attribute.
UPDATE public.commissions
SET imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
WHERE imo_id IS NULL
  AND policy_id IS NULL
  AND user_id IS NULL
  AND EXISTS (SELECT 1 FROM public.imos WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);

DO $$
DECLARE
  v_orphan_count int;
BEGIN
  SELECT count(*) INTO v_orphan_count FROM public.commissions WHERE imo_id IS NULL;
  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'Cannot backfill commissions.imo_id: % rows have no derivable IMO. Manually assign before re-running.', v_orphan_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. NOT NULL constraints.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ALTER COLUMN imo_id SET NOT NULL;
ALTER TABLE public.policies      ALTER COLUMN imo_id SET NOT NULL;
ALTER TABLE public.commissions   ALTER COLUMN imo_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Commission IMO-consistency trigger (mirror of policies trigger).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_commission_reference_imo_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected_imo_id uuid;
  v_policy_imo_id uuid;
  v_user_imo_id uuid;
BEGIN
  IF NEW.policy_id IS NOT NULL THEN
    SELECT imo_id INTO v_policy_imo_id
    FROM public.policies WHERE id = NEW.policy_id;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT imo_id INTO v_user_imo_id
    FROM public.user_profiles WHERE id = NEW.user_id;
  END IF;

  v_expected_imo_id := COALESCE(NEW.imo_id, v_policy_imo_id, v_user_imo_id, public.get_my_imo_id());

  IF v_expected_imo_id IS NULL THEN
    RAISE EXCEPTION 'Commission requires an IMO' USING ERRCODE = 'check_violation';
  END IF;

  IF v_policy_imo_id IS NOT NULL AND v_policy_imo_id IS DISTINCT FROM v_expected_imo_id THEN
    RAISE EXCEPTION 'Commission IMO must match policy IMO' USING ERRCODE = 'check_violation';
  END IF;

  IF v_user_imo_id IS NOT NULL AND v_user_imo_id IS DISTINCT FROM v_expected_imo_id THEN
    RAISE EXCEPTION 'Commission user must belong to commission IMO' USING ERRCODE = 'check_violation';
  END IF;

  NEW.imo_id := v_expected_imo_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_commission_reference_imo_consistency ON public.commissions;
CREATE TRIGGER enforce_commission_reference_imo_consistency
  BEFORE INSERT OR UPDATE OF user_id, policy_id, imo_id ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_commission_reference_imo_consistency();

-- ---------------------------------------------------------------------------
-- 6. user_profiles INSERT trigger: require imo_id (derive from agency /
--    recruiter / upline / authenticated caller in that order).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_profile_imo_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agency_imo_id uuid;
  v_recruiter_imo_id uuid;
  v_upline_imo_id uuid;
  v_caller_imo_id uuid;
BEGIN
  IF NEW.agency_id IS NOT NULL THEN
    SELECT imo_id INTO v_agency_imo_id FROM public.agencies WHERE id = NEW.agency_id;
  END IF;
  IF NEW.recruiter_id IS NOT NULL THEN
    SELECT imo_id INTO v_recruiter_imo_id FROM public.user_profiles WHERE id = NEW.recruiter_id;
  END IF;
  IF NEW.upline_id IS NOT NULL THEN
    SELECT imo_id INTO v_upline_imo_id FROM public.user_profiles WHERE id = NEW.upline_id;
  END IF;
  v_caller_imo_id := public.get_my_imo_id();

  NEW.imo_id := COALESCE(NEW.imo_id, v_agency_imo_id, v_recruiter_imo_id, v_upline_imo_id, v_caller_imo_id);

  IF NEW.imo_id IS NULL THEN
    RAISE EXCEPTION 'user_profile requires an IMO (no explicit imo_id, agency, recruiter, upline, or caller IMO available)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Defensive: if explicit imo_id conflicts with agency's IMO, reject.
  IF v_agency_imo_id IS NOT NULL AND NEW.imo_id IS DISTINCT FROM v_agency_imo_id THEN
    RAISE EXCEPTION 'user_profile IMO must match agency IMO' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_user_profile_imo_consistency ON public.user_profiles;
CREATE TRIGGER enforce_user_profile_imo_consistency
  BEFORE INSERT OR UPDATE OF agency_id, imo_id ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_profile_imo_consistency();

-- ---------------------------------------------------------------------------
-- 7. RLS hardening: user_profiles.
--    Pattern: each leaky SELECT/UPDATE/DELETE policy gets DROP'd and recreated
--    with an additional 'AND imo_id = get_my_imo_id() AND imo_id IS NOT NULL'
--    guard. The dedicated 'Super admins can ...' policies remain untouched
--    so Nick retains cross-IMO access.
-- ---------------------------------------------------------------------------

-- SELECT policies
DROP POLICY IF EXISTS "Admins can view all user profiles" ON public.user_profiles;
CREATE POLICY "Admins can view all user profiles in own IMO"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (is_admin() AND imo_id = public.get_my_imo_id() AND imo_id IS NOT NULL);

DROP POLICY IF EXISTS "Agents can view approved team members" ON public.user_profiles;
CREATE POLICY "Agents can view approved team members in own IMO"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    approval_status = 'approved'
    AND email IS NOT NULL
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS user_profiles_select_admin ON public.user_profiles;
CREATE POLICY user_profiles_select_admin ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    is_admin_user((SELECT auth.uid()))
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS user_profiles_select_hierarchy ON public.user_profiles;
CREATE POLICY user_profiles_select_hierarchy ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    (
      (recruiter_id = (SELECT auth.uid()))
      OR (id IN (SELECT downline_id FROM get_downline_ids((SELECT auth.uid())) AS gdi(downline_id)))
      OR (upline_id = (SELECT auth.uid()))
    )
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS user_profiles_select_own_recruiter ON public.user_profiles;
CREATE POLICY user_profiles_select_own_recruiter ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT recruiter_id FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) AS x(upline_id, recruiter_id))
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS user_profiles_select_own_upline ON public.user_profiles;
CREATE POLICY user_profiles_select_own_upline ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    id = (SELECT upline_id FROM get_user_upline_and_recruiter_ids((SELECT auth.uid())) AS x(upline_id, recruiter_id))
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS user_profiles_select_recruiter ON public.user_profiles;
CREATE POLICY user_profiles_select_recruiter ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'recruiter'::text)
    AND onboarding_status = ANY (ARRAY['lead'::text, 'active'::text])
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS user_profiles_select_view_only ON public.user_profiles;
CREATE POLICY user_profiles_select_view_only ON public.user_profiles
  FOR SELECT TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'view_only'::text)
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

DROP POLICY IF EXISTS "Uplines can view downline profiles" ON public.user_profiles;
CREATE POLICY "Uplines can view downline profiles in own IMO"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    hierarchy_path LIKE (get_current_user_hierarchy_path() || '.%')
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

-- UPDATE policies
DROP POLICY IF EXISTS "Admins can update all user profiles" ON public.user_profiles;
CREATE POLICY "Admins can update all user profiles in own IMO"
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (is_admin() AND imo_id = public.get_my_imo_id() AND imo_id IS NOT NULL)
  WITH CHECK (is_admin() AND imo_id = public.get_my_imo_id() AND imo_id IS NOT NULL);

DROP POLICY IF EXISTS user_profiles_update_admin ON public.user_profiles;
CREATE POLICY user_profiles_update_admin ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (is_admin_user((SELECT auth.uid())) AND imo_id = public.get_my_imo_id() AND imo_id IS NOT NULL)
  WITH CHECK (is_admin_user((SELECT auth.uid())) AND imo_id = public.get_my_imo_id() AND imo_id IS NOT NULL);

DROP POLICY IF EXISTS user_profiles_update_contracting ON public.user_profiles;
CREATE POLICY user_profiles_update_contracting ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'contracting_manager'::text)
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  )
  WITH CHECK (
    has_role((SELECT auth.uid()), 'contracting_manager'::text)
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

-- DELETE policies
DROP POLICY IF EXISTS delete_user_policy ON public.user_profiles;
CREATE POLICY delete_user_policy ON public.user_profiles
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR (
      (SELECT auth.uid()) IN (SELECT u.id FROM user_profiles u WHERE u.is_admin = true)
      AND imo_id = public.get_my_imo_id()
      AND imo_id IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- 8. RLS hardening: policies.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Uplines can view downline policies" ON public.policies;
CREATE POLICY "Uplines can view downline policies in own IMO"
  ON public.policies FOR SELECT TO authenticated
  USING (
    is_upline_of(user_id)
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 9. RLS hardening: commissions.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Uplines can view downline commissions" ON public.commissions;
CREATE POLICY "Uplines can view downline commissions in own IMO"
  ON public.commissions FOR SELECT TO authenticated
  USING (
    is_upline_of(user_id)
    AND imo_id = public.get_my_imo_id()
    AND imo_id IS NOT NULL
  );

-- Clean up legacy email-hardcoded admin bypass; super_admin policy covers it.
DROP POLICY IF EXISTS commissions_update_admin_simple ON public.commissions;
