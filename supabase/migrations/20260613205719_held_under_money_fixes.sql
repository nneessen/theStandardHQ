-- Contracting Hub — "held under" follow-up MONEY fixes (code-review findings).
--
-- Fixes four correctness bugs in 20260613194758 + two hygiene items:
--   #1 Double-count: the reroute is additive — switching the held_under target (or
--      clearing it) and then re-firing a calculator (policy reactivation, or any raw
--      regenerate caller) added a SECOND override leg alongside the prior one. Fixed with
--      a divergence guard that fires ONLY when a held_under reroute is/was involved
--      (zero behaviour change for normal, non-held_under policies): if the policy already
--      has override rows and the current OR prior arrangement is a reroute, skip — recompute
--      must go through delete-first (overrideService.recalculateOverridesForPolicy).
--   #2 Stale start date: set_contracted_under reused the old held_under_since when the
--      target changed or was re-set after a clear, backdating a new recipient's window.
--      Now held_under_since resets to COALESCE(p_since, CURRENT_DATE) on any target change.
--   #3 Wrong ledger creditor: redirected_from_upline_id was stamped as the normal upline
--      even when an approved alternate sponsor was the party actually displaced (and a
--      phantom debt was stamped when held_under == the sponsor). Now stamps the PRE-held
--      seed (sponsor if active, else normal upline) via IS DISTINCT FROM.
--   #4 Dead column: held_under_until never affected the gate (clearing also nulls id/name),
--      so the "closed interval" was vestigial. Dropped the column + its gate clause; clear
--      is hard-clear (prospective from the clear). Activation-lag-past-a-clear is accepted.
--   #5 Notification symmetry: only agent self-marks notified anyone. Now an upline/manager
--      setting it notifies the agent AND the bypassed normal upline (never the actor).
--   #10 NULL-safe carrier name in the notification (COALESCE).
--   #11 REVOKE anon/PUBLIC on the three read RPCs (consistency; no data leak either way).
--
-- Override fn bodies = 20260613194758 VERBATIM with only: v_pre_held_seed capture, the
-- pre-seed stamp, the held_under_until gate clause removed, and the divergence guard.

BEGIN;

-- #4: held_under_until was dead (clearing nulls id/name, so the gate's id/name term already
-- excluded cleared rows). Drop it and the references below.
ALTER TABLE public.carrier_contracts DROP COLUMN IF EXISTS held_under_until;

-- ════════════════════════════════════════════════════════════════════════════
-- regenerate_override_commissions(p_policy_id)
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
  v_default_upline UUID;
  v_pre_held_seed UUID;
  v_cc_id UUID;
  v_held_under_id UUID;
  v_held_under_name TEXT;
  v_redirected_from UUID := NULL;
  v_redirect_cc_id UUID := NULL;
BEGIN
  SELECT * INTO v_policy FROM policies WHERE id = p_policy_id;

  IF NOT FOUND THEN
    RAISE WARNING 'Policy % not found', p_policy_id;
    RETURN 0;
  END IF;

  PERFORM public.assert_in_acting_scope(v_policy.imo_id);

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

  -- Override seed: normal upline, OR approved alternate sponsor (prospective).
  v_default_upline := (SELECT upline_id FROM user_profiles WHERE id = v_policy.user_id);
  v_seed_upline_id := v_default_upline;
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

  -- NEW: "held under a different upline" WINS over the sponsorship seed (prospective-only).
  -- The party DISPLACED by the reroute is the pre-held seed (sponsor if active, else normal
  -- upline) — that is who is stamped as owed back, not unconditionally the normal upline.
  v_pre_held_seed := v_seed_upline_id;
  SELECT cc.id, cc.held_under_id, cc.held_under_name
    INTO v_cc_id, v_held_under_id, v_held_under_name
  FROM carrier_contracts cc
  WHERE cc.agent_id = v_policy.user_id
    AND cc.carrier_id = v_policy.carrier_id
    AND cc.held_under_since IS NOT NULL
    AND cc.held_under_since <= v_policy.effective_date
    AND (cc.held_under_id IS NOT NULL OR cc.held_under_name IS NOT NULL)
  ORDER BY cc.held_under_since DESC
  LIMIT 1;
  IF FOUND THEN
    IF v_held_under_name IS NOT NULL THEN
      RETURN 0;  -- free-text outside upline: suppress, money left the system
    ELSIF v_held_under_id IS NOT NULL THEN
      v_seed_upline_id := v_held_under_id;
      IF v_held_under_id IS DISTINCT FROM v_pre_held_seed THEN
        v_redirected_from := v_pre_held_seed;  -- ledger: owed back to the displaced party
        v_redirect_cc_id  := v_cc_id;
      END IF;
    END IF;
  END IF;

  -- #1 Divergence guard: the reroute is single-row/no-history, so a target change or clear
  -- followed by a re-run would add a divergent second leg. Fire ONLY when held_under is or
  -- was involved (normal policies are untouched): if rows already exist, skip — recompute
  -- must delete-first (overrideService.recalculateOverridesForPolicy does).
  IF EXISTS (SELECT 1 FROM override_commissions WHERE policy_id = p_policy_id)
     AND (v_held_under_id IS NOT NULL
          OR EXISTS (SELECT 1 FROM override_commissions
                     WHERE policy_id = p_policy_id AND redirected_from_upline_id IS NOT NULL))
  THEN
    RETURN 0;
  END IF;

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
          advance_months, months_paid, earned_amount, unearned_amount, status,
          redirected_from_upline_id, redirect_carrier_contract_id
        ) VALUES (
          p_policy_id, v_policy.user_id, v_upline_record.upline_id, v_upline_record.depth,
          v_base_comp_level, v_upline_record.upline_comp_level, v_policy.carrier_id, v_policy.product_id,
          v_policy.annual_premium, v_base_commission_amount, v_override_amount,
          v_advance_months, v_months_paid, 0, v_override_amount, 'pending',
          v_redirected_from, v_redirect_cc_id
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
'Regenerates override commissions for a policy. Hardened: assert_in_acting_scope + pinned search_path. Seed precedence: held_under > approved alternate sponsor > normal upline; all prospective-only. Free-text held_under suppresses; system-user held_under reroutes and stamps redirected_from_upline_id (the PRE-held seed actually displaced) + redirect_carrier_contract_id. Divergence guard skips when a held_under reroute is/was involved and rows already exist (recompute via delete-first).';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('regenerate_override_commissions', '20260613205719')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- create_override_commissions() — trigger path
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
  v_default_upline UUID;
  v_pre_held_seed UUID;
  v_cc_id UUID;
  v_held_under_id UUID;
  v_held_under_name TEXT;
  v_redirected_from UUID := NULL;
  v_redirect_cc_id UUID := NULL;
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

  -- Override seed: normal upline, OR approved alternate sponsor (prospective).
  v_default_upline := (SELECT upline_id FROM user_profiles WHERE id = NEW.user_id);
  v_seed_upline_id := v_default_upline;
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

  -- NEW: held_under WINS over the sponsorship seed (prospective-only). The displaced party
  -- (stamped as owed back) is the pre-held seed, not unconditionally the normal upline.
  v_pre_held_seed := v_seed_upline_id;
  SELECT cc.id, cc.held_under_id, cc.held_under_name
    INTO v_cc_id, v_held_under_id, v_held_under_name
  FROM carrier_contracts cc
  WHERE cc.agent_id = NEW.user_id
    AND cc.carrier_id = NEW.carrier_id
    AND cc.held_under_since IS NOT NULL
    AND cc.held_under_since <= NEW.effective_date
    AND (cc.held_under_id IS NOT NULL OR cc.held_under_name IS NOT NULL)
  ORDER BY cc.held_under_since DESC
  LIMIT 1;
  IF FOUND THEN
    IF v_held_under_name IS NOT NULL THEN
      RETURN NEW;  -- free-text outside upline: suppress, money left the system
    ELSIF v_held_under_id IS NOT NULL THEN
      v_seed_upline_id := v_held_under_id;
      IF v_held_under_id IS DISTINCT FROM v_pre_held_seed THEN
        v_redirected_from := v_pre_held_seed;  -- ledger: owed back to the displaced party
        v_redirect_cc_id  := v_cc_id;
      END IF;
    END IF;
  END IF;

  -- #1 Divergence guard (held_under only; normal policies untouched): on reactivation, if
  -- rows already exist and a reroute is/was involved, don't add a divergent leg.
  IF EXISTS (SELECT 1 FROM override_commissions WHERE policy_id = NEW.id)
     AND (v_held_under_id IS NOT NULL
          OR EXISTS (SELECT 1 FROM override_commissions
                     WHERE policy_id = NEW.id AND redirected_from_upline_id IS NOT NULL))
  THEN
    RETURN NEW;
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
        created_at,
        redirected_from_upline_id,
        redirect_carrier_contract_id
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
        NOW(),
        v_redirected_from,
        v_redirect_cc_id
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
'Creates override commissions when a policy becomes active. Floor-based spread. Hardened: book-duplication guard + pinned search_path. Seed precedence: held_under > approved alternate sponsor > normal upline; prospective-only. Free-text held_under suppresses; system-user held_under reroutes and stamps the PRE-held seed displaced + redirect_carrier_contract_id. Divergence guard avoids a second leg on reactivation when a held_under reroute is/was involved.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('create_override_commissions', '20260613205719')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- set_contracted_under — reset start date on target change (#2), no held_under_until (#4),
--   notify agent + bypassed upline when set by someone else (#5), NULL-safe carrier (#10).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_contracted_under(
  p_agent_id UUID,
  p_carrier_id UUID,
  p_held_under_id UUID DEFAULT NULL,
  p_held_under_name TEXT DEFAULT NULL,
  p_since DATE DEFAULT NULL
)
RETURNS public.carrier_contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        UUID := auth.uid();
  v_is_self       BOOLEAN;
  v_is_manager    BOOLEAN;
  v_agent_imo     UUID;
  v_normal_upline UUID;
  v_held_imo      UUID;
  v_name          TEXT := NULLIF(btrim(COALESCE(p_held_under_name, '')), '');
  v_clearing      BOOLEAN;
  v_old_id        UUID;
  v_old_name      TEXT;
  v_target_changed BOOLEAN;
  v_carrier_name  TEXT;
  v_agent_name    TEXT;
  v_held_name     TEXT;
  v_row           public.carrier_contracts;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_clearing := (p_held_under_id IS NULL AND v_name IS NULL);

  SELECT imo_id, upline_id INTO v_agent_imo, v_normal_upline
  FROM user_profiles WHERE id = p_agent_id;
  IF v_agent_imo IS NULL THEN
    RAISE EXCEPTION 'Agent not found or has no IMO';
  END IF;

  v_is_self := (v_caller = p_agent_id);
  v_is_manager := (
    is_super_admin()
    OR is_upline_of(p_agent_id)
    OR EXISTS (
      SELECT 1 FROM user_profiles caller
      WHERE caller.id = v_caller
        AND caller.imo_id = v_agent_imo
        AND (caller.roles @> ARRAY['trainer']::text[]
             OR caller.roles @> ARRAY['contracting_manager']::text[]
             OR caller.is_admin = true)
    )
  );
  IF NOT (v_is_self OR v_is_manager) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Existing arrangement (also the existence check).
  SELECT held_under_id, held_under_name INTO v_old_id, v_old_name
  FROM carrier_contracts WHERE agent_id = p_agent_id AND carrier_id = p_carrier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No carrier contract exists for this agent and carrier';
  END IF;

  IF NOT v_clearing THEN
    IF p_held_under_id IS NOT NULL AND v_name IS NOT NULL THEN
      RAISE EXCEPTION 'Provide either a system user OR a free-text name, not both';
    END IF;

    IF p_held_under_id IS NOT NULL THEN
      IF p_held_under_id = p_agent_id THEN
        RAISE EXCEPTION 'An agent cannot be held under themselves';
      END IF;

      SELECT imo_id INTO v_held_imo FROM user_profiles WHERE id = p_held_under_id;
      IF v_held_imo IS NULL THEN
        RAISE EXCEPTION 'The selected upline was not found';
      END IF;
      IF v_held_imo <> v_agent_imo THEN
        RAISE EXCEPTION 'The selected upline must be in the same organization';
      END IF;

      IF EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = p_held_under_id
          AND hierarchy_path IS NOT NULL
          AND hierarchy_path LIKE '%' || p_agent_id::text || '%'
      ) THEN
        RAISE EXCEPTION 'The selected upline cannot be one of the agent''s own downline agents';
      END IF;
    END IF;
  END IF;

  -- #2: a new/changed target must NOT inherit the prior arrangement's start date.
  v_target_changed := (p_held_under_id IS DISTINCT FROM v_old_id)
                   OR (v_name IS DISTINCT FROM v_old_name);

  UPDATE carrier_contracts SET
    held_under_id    = CASE WHEN v_clearing THEN NULL ELSE p_held_under_id END,
    held_under_name  = CASE WHEN v_clearing THEN NULL ELSE v_name END,
    held_under_since = CASE
                         WHEN v_clearing       THEN held_under_since
                         WHEN v_target_changed THEN COALESCE(p_since, CURRENT_DATE)
                         ELSE COALESCE(p_since, held_under_since, CURRENT_DATE)
                       END,
    updated_at = NOW()
  WHERE agent_id = p_agent_id AND carrier_id = p_carrier_id
  RETURNING * INTO v_row;

  -- #5 + #10: awareness notifications (never to the actor). Skip on clear.
  IF NOT v_clearing THEN
    v_carrier_name := COALESCE((SELECT name FROM carriers WHERE id = p_carrier_id), 'a carrier');
    v_agent_name := COALESCE(
      (SELECT COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), email)
         FROM user_profiles WHERE id = p_agent_id), 'A downline agent');
    v_held_name := COALESCE(
      (SELECT COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), email)
         FROM user_profiles WHERE id = p_held_under_id),
      v_name, 'another upline');

    -- The agent whose contract was rerouted (only when someone else set it).
    IF p_agent_id <> v_caller THEN
      PERFORM create_notification(
        p_agent_id, 'held_under_set',
        'Your contract was marked held under a different upline',
        'Your ' || v_carrier_name || ' contract was marked as held under ' || v_held_name
          || '. New business overrides for this carrier will route there.',
        jsonb_build_object('agent_id', p_agent_id, 'carrier_id', p_carrier_id,
                           'held_under_id', p_held_under_id, 'held_under_name', v_name,
                           'link', '/contracting?tab=mine'),
        NULL);
    END IF;

    -- The bypassed normal upline (when not the actor) — they lose the override.
    IF v_normal_upline IS NOT NULL AND v_normal_upline <> v_caller THEN
      PERFORM create_notification(
        v_normal_upline, 'held_under_set',
        'A downline contract is held under a different upline',
        v_agent_name || '''s ' || v_carrier_name || ' contract is marked held under '
          || v_held_name || '. New business overrides for this carrier route there instead of to you.',
        jsonb_build_object('agent_id', p_agent_id, 'carrier_id', p_carrier_id,
                           'held_under_id', p_held_under_id, 'held_under_name', v_name,
                           'link', '/contracting?tab=downline'),
        NULL);
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_contracted_under(UUID, UUID, UUID, TEXT, DATE) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_contracted_under(UUID, UUID, UUID, TEXT, DATE) TO authenticated;

COMMENT ON FUNCTION public.set_contracted_under IS
'Sets/clears the held_under arrangement. Caller = agent, their upline, IMO staff, or super-admin. Guards: both id+name, self, cross-IMO, own-downline (cycle). A changed target resets held_under_since (prospective). Hard-clear (prospective from the clear). Notifies the agent and the bypassed normal upline when set by someone else (never the actor).';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('set_contracted_under', '20260613205719')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- #11: consistency — these read RPCs filter by auth.uid() (no leak) but were missing the
-- REVOKE the rest of the contracting RPCs carry.
REVOKE EXECUTE ON FUNCTION public.get_my_contracts() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_contracts() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_downline_contracts() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_downline_contracts() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_override_redirect_ledger() FROM anon, PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_override_redirect_ledger() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
