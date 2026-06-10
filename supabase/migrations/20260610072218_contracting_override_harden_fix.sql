-- Contracting Hub — corrective: re-harden the override calculators (MONEY/AUTH FIX)
--
-- 20260609203845 branched the override functions from PRE-hardening versions and
-- silently reverted shipped security guards. The version-tracking runner could not
-- catch it because the version number rose while the body regressed. This migration
-- restores the hardened bodies and re-applies ONLY the alternate-sponsor seed change.
--
-- Regressions being fixed (both functions):
--   1. regenerate_override_commissions lost  `SET search_path TO 'public'`
--      + `PERFORM assert_in_acting_scope(v_policy.imo_id)` (20260531162205 H1) +
--      the anon/PUBLIC revokes  → cross-IMO money write + search-path hijack.
--   2. create_override_commissions lost  `SET search_path TO 'public'`,
--      `IF is_book_duplication_mode() THEN RETURN NEW` (20260524153637), and the
--      in-body `IF NEW.lifecycle_status != 'active' THEN RETURN NEW` guard
--      → phantom overrides during book duplication.
--
-- Bodies below = the hardened 20260531162205 (regenerate) / 20260524153637 (create)
-- definitions VERBATIM, with only: (a) two seed vars added, (b) the seed-selection
-- block injected, (c) the recursive CTE anchor seeded from v_seed_upline_id. The
-- alternate-sponsor seed + prospective-only date rule are unchanged from 203845.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- regenerate_override_commissions(p_policy_id) — hardened + alt-sponsor seed
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.regenerate_override_commissions(p_policy_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_policy RECORD;
  v_upline_record RECORD;
  v_base_comp_level INTEGER;
  v_base_commission_rate DECIMAL(5,4);
  v_base_commission_amount DECIMAL(12,2);
  v_upline_commission_rate DECIMAL(5,4);
  v_upline_commission_amount DECIMAL(12,2);
  v_override_amount DECIMAL(12,2);
  v_monthly_premium DECIMAL(12,2);
  v_advance_months INTEGER;
  v_months_paid INTEGER;
  v_count INTEGER := 0;
  v_seed_upline_id UUID;
  v_sponsor_id UUID;
BEGIN
  -- Get policy details
  SELECT * INTO v_policy FROM policies WHERE id = p_policy_id;

  IF NOT FOUND THEN
    RAISE WARNING 'Policy % not found', p_policy_id;
    RETURN 0;
  END IF;

  -- SECURITY: this function was anon-reachable with no authz. Block any caller
  -- operating outside their acting IMO (raises 42501). Super-admins (NULL
  -- effective IMO) pass through, as do service-role calls.
  PERFORM public.assert_in_acting_scope(v_policy.imo_id);

  -- Get months_paid AND advance_months from the base commission (not policies).
  SELECT COALESCE(months_paid, 0), COALESCE(advance_months, 9)
  INTO v_months_paid, v_advance_months
  FROM commissions WHERE policy_id = p_policy_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_months_paid IS NULL THEN
    v_months_paid := 0;
  END IF;
  IF v_advance_months IS NULL OR v_advance_months <= 0 THEN
    v_advance_months := 9;
  END IF;

  v_monthly_premium := COALESCE(v_policy.monthly_premium, v_policy.annual_premium / 12.0);

  SELECT contract_level INTO v_base_comp_level
  FROM user_profiles WHERE id = v_policy.user_id;

  IF v_base_comp_level IS NULL THEN
    RAISE WARNING 'Policy % owner has no contract_level', p_policy_id;
    RETURN 0;
  END IF;

  SELECT commission_percentage INTO v_base_commission_rate
  FROM comp_guide
  WHERE carrier_id = v_policy.carrier_id
    AND (product_id = v_policy.product_id OR product_type = v_policy.product)
    AND contract_level = v_base_comp_level
    AND effective_date <= v_policy.effective_date
    AND (expiration_date IS NULL OR expiration_date >= v_policy.effective_date)
  ORDER BY effective_date DESC
  LIMIT 1;

  IF v_base_commission_rate IS NULL THEN
    RAISE WARNING 'No comp_guide entry for policy %', p_policy_id;
    RETURN 0;
  END IF;

  v_base_commission_amount := ROUND(
    v_monthly_premium * v_advance_months * v_base_commission_rate, 2
  );

  -- Override seed: normal upline, OR an approved alternate sponsor for this
  -- (agent, carrier) when the policy was written on/after the sponsorship approval.
  -- The date gate is in the WHERE (not a post-filter) so multiple approved
  -- sponsorships pick the one in effect for this policy's date rather than
  -- falling back to the normal upline (prospective-only money rule).
  v_seed_upline_id := (SELECT upline_id FROM user_profiles WHERE id = v_policy.user_id);
  SELECT csr.override_recipient_id
    INTO v_sponsor_id
  FROM carrier_sponsorship_requests csr
  WHERE csr.requesting_agent_id = v_policy.user_id
    AND csr.carrier_id = v_policy.carrier_id
    AND csr.overall_status = 'approved'
    AND csr.override_recipient_id IS NOT NULL
    AND csr.approved_at::date <= v_policy.effective_date
  ORDER BY csr.approved_at DESC
  LIMIT 1;
  IF v_sponsor_id IS NOT NULL THEN
    v_seed_upline_id := v_sponsor_id;
  END IF;

  -- Walk up hierarchy and create overrides
  FOR v_upline_record IN (
    WITH RECURSIVE upline_chain AS (
      SELECT up.id as upline_id, up.contract_level as upline_comp_level, 1 as depth
      FROM user_profiles up
      WHERE up.id = v_seed_upline_id
        AND up.id IS NOT NULL AND up.contract_level IS NOT NULL
      UNION
      SELECT up.id, up.contract_level, uc.depth + 1
      FROM user_profiles up
      JOIN upline_chain uc ON up.id = (SELECT upline_id FROM user_profiles WHERE id = uc.upline_id)
      WHERE up.id IS NOT NULL AND up.contract_level IS NOT NULL
    )
    SELECT * FROM upline_chain
  ) LOOP
    IF v_upline_record.upline_comp_level <= v_base_comp_level THEN
      CONTINUE;
    END IF;

    SELECT commission_percentage INTO v_upline_commission_rate
    FROM comp_guide
    WHERE carrier_id = v_policy.carrier_id
      AND (product_id = v_policy.product_id OR product_type = v_policy.product)
      AND contract_level = v_upline_record.upline_comp_level
      AND effective_date <= v_policy.effective_date
      AND (expiration_date IS NULL OR expiration_date >= v_policy.effective_date)
    ORDER BY effective_date DESC
    LIMIT 1;

    IF v_upline_commission_rate IS NULL THEN
      CONTINUE;
    END IF;

    v_upline_commission_amount := ROUND(
      v_monthly_premium * v_advance_months * v_upline_commission_rate, 2
    );
    v_override_amount := ROUND(v_upline_commission_amount - v_base_commission_amount, 2);

    IF v_override_amount > 0 THEN
      IF NOT EXISTS (
        SELECT 1 FROM override_commissions
        WHERE policy_id = p_policy_id AND override_agent_id = v_upline_record.upline_id
      ) THEN
        INSERT INTO override_commissions (
          policy_id, base_agent_id, override_agent_id, hierarchy_depth,
          base_comp_level, override_comp_level, carrier_id, product_id,
          policy_premium, base_commission_amount, override_commission_amount,
          advance_months, months_paid, earned_amount, unearned_amount, status
        ) VALUES (
          p_policy_id, v_policy.user_id, v_upline_record.upline_id, v_upline_record.depth,
          v_base_comp_level, v_upline_record.upline_comp_level, v_policy.carrier_id, v_policy.product_id,
          v_policy.annual_premium, v_base_commission_amount, v_override_amount,
          v_advance_months, v_months_paid, 0, v_override_amount, 'pending'
        );
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.regenerate_override_commissions(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.regenerate_override_commissions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_override_commissions(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.regenerate_override_commissions(UUID) IS
'Regenerates override commissions for a policy. Override = monthly_premium * advance_months * (upline_rate - base_rate), rounded — off the advance (Gap H, 2026-05-26). Hardened: assert_in_acting_scope + pinned search_path (2026-05-31). Override seed is the normal upline, OR an approved alternate sponsor for (agent,carrier) when policy.effective_date >= sponsorship.approved_at (Contracting Hub, prospective-only).';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('regenerate_override_commissions', '20260610072218')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- create_override_commissions() — hardened + alt-sponsor seed (trigger path)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_override_commissions()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_upline_record RECORD;
  v_base_comp_level INTEGER;
  v_base_commission_rate DECIMAL(5,4);
  v_base_commission_amount DECIMAL(12,2);
  v_upline_commission_rate DECIMAL(5,4);
  v_upline_commission_amount DECIMAL(12,2);
  v_override_amount DECIMAL(12,2);
  v_floor_commission_amount DECIMAL(12,2);
  v_floor_comp_level INTEGER;
  v_seed_upline_id UUID;
  v_sponsor_id UUID;
BEGIN
  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping override creation for policy % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_status != 'active' THEN
    RETURN NEW;
  END IF;

  SELECT contract_level
  INTO v_base_comp_level
  FROM user_profiles
  WHERE id = NEW.user_id;

  IF v_base_comp_level IS NULL THEN
    RAISE WARNING 'Policy % created by user % has no contract_level set in user_profiles - skipping override calculation',
      NEW.id, NEW.user_id;
    RETURN NEW;
  END IF;

  SELECT commission_percentage
  INTO v_base_commission_rate
  FROM comp_guide
  WHERE carrier_id = NEW.carrier_id
    AND (product_id = NEW.product_id OR product_type = NEW.product)
    AND contract_level = v_base_comp_level
    AND effective_date <= NEW.effective_date
    AND (expiration_date IS NULL OR expiration_date >= NEW.effective_date)
  ORDER BY effective_date DESC
  LIMIT 1;

  IF v_base_commission_rate IS NULL THEN
    RAISE WARNING 'No comp_guide entry found for carrier=%, product=%, level=% - skipping override calculation',
      NEW.carrier_id, NEW.product, v_base_comp_level;
    RETURN NEW;
  END IF;

  v_base_commission_amount := NEW.annual_premium * v_base_commission_rate;
  v_floor_commission_amount := v_base_commission_amount;
  v_floor_comp_level := v_base_comp_level;

  -- Override seed: normal upline, OR an approved alternate sponsor for this
  -- (agent, carrier) when the policy was written on/after the sponsorship approval
  -- (prospective-only; date gate in the WHERE so the right sponsorship is picked).
  v_seed_upline_id := (SELECT upline_id FROM user_profiles WHERE id = NEW.user_id);
  SELECT csr.override_recipient_id
    INTO v_sponsor_id
  FROM carrier_sponsorship_requests csr
  WHERE csr.requesting_agent_id = NEW.user_id
    AND csr.carrier_id = NEW.carrier_id
    AND csr.overall_status = 'approved'
    AND csr.override_recipient_id IS NOT NULL
    AND csr.approved_at::date <= NEW.effective_date
  ORDER BY csr.approved_at DESC
  LIMIT 1;
  IF v_sponsor_id IS NOT NULL THEN
    v_seed_upline_id := v_sponsor_id;
  END IF;

  FOR v_upline_record IN (
    WITH RECURSIVE upline_chain AS (
      SELECT
        up.id as upline_id,
        up.contract_level as upline_comp_level,
        1 as depth
      FROM user_profiles up
      WHERE up.id = v_seed_upline_id
      AND up.id IS NOT NULL
      AND up.contract_level IS NOT NULL

      UNION

      SELECT
        up.id as upline_id,
        up.contract_level as upline_comp_level,
        uc.depth + 1
      FROM user_profiles up
      JOIN upline_chain uc ON up.id = (
        SELECT upline_id FROM user_profiles WHERE id = uc.upline_id
      )
      WHERE up.id IS NOT NULL
      AND up.contract_level IS NOT NULL
    )
    SELECT * FROM upline_chain
    ORDER BY depth ASC
  ) LOOP
    IF v_upline_record.upline_comp_level <= v_floor_comp_level THEN
      RAISE WARNING 'Upline % has contract_level=% <= floor_level=% - skipping override (no spread)',
        v_upline_record.upline_id, v_upline_record.upline_comp_level, v_floor_comp_level;
      CONTINUE;
    END IF;

    SELECT commission_percentage
    INTO v_upline_commission_rate
    FROM comp_guide
    WHERE carrier_id = NEW.carrier_id
      AND (product_id = NEW.product_id OR product_type = NEW.product)
      AND contract_level = v_upline_record.upline_comp_level
      AND effective_date <= NEW.effective_date
      AND (expiration_date IS NULL OR expiration_date >= NEW.effective_date)
    ORDER BY effective_date DESC
    LIMIT 1;

    IF v_upline_commission_rate IS NULL THEN
      RAISE WARNING 'No comp_guide entry found for upline % at level % - skipping override',
        v_upline_record.upline_id, v_upline_record.upline_comp_level;
      CONTINUE;
    END IF;

    v_upline_commission_amount := NEW.annual_premium * v_upline_commission_rate;
    v_override_amount := v_upline_commission_amount - v_floor_commission_amount;

    IF v_override_amount > 0 THEN
      INSERT INTO override_commissions (
        policy_id,
        base_agent_id,
        override_agent_id,
        hierarchy_depth,
        base_comp_level,
        override_comp_level,
        carrier_id,
        product_id,
        policy_premium,
        base_commission_amount,
        override_commission_amount,
        advance_months,
        months_paid,
        earned_amount,
        unearned_amount,
        status,
        created_at
      ) VALUES (
        NEW.id,
        NEW.user_id,
        v_upline_record.upline_id,
        v_upline_record.depth,
        v_base_comp_level,
        v_upline_record.upline_comp_level,
        NEW.carrier_id,
        NEW.product_id,
        NEW.annual_premium,
        v_base_commission_amount,
        v_override_amount,
        9,
        0,
        0,
        v_override_amount,
        'pending',
        NOW()
      )
      ON CONFLICT (policy_id, override_agent_id) DO NOTHING;

      v_floor_commission_amount := v_upline_commission_amount;
      v_floor_comp_level := v_upline_record.upline_comp_level;
    ELSE
      RAISE WARNING 'Override amount for upline % is <= 0 (%.2f) - skipping',
        v_upline_record.upline_id, v_override_amount;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.create_override_commissions() IS
'Creates override commissions when a policy becomes active. Floor-based spread to immediate downline. Hardened: book-duplication guard + pinned search_path (2026-05-24). Override seed is the normal upline, OR an approved alternate sponsor for (agent,carrier) when NEW.effective_date >= sponsorship.approved_at (Contracting Hub, prospective-only).';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('create_override_commissions', '20260610072218')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
