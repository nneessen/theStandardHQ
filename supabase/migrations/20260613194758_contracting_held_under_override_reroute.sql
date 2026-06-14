-- Contracting Hub — "Held under a different upline" + override reroute/ledger (MONEY)
--
-- Either an agent OR their upline can mark, per carrier, that the agent's contract is
-- actually HELD UNDER a different upline ("Bob") — a real app user (held_under_id) OR a
-- free-text outside name (held_under_name; mutually exclusive). Effects on NEW business
-- (prospective-only, gated by held_under_since/until):
--   • Bob is an app user  → override reroutes to Bob's leg (seed = held_under_id), and
--     every rerouted override row is STAMPED with redirected_from_upline_id (the normal
--     upline owed the money back) + redirect_carrier_contract_id. This is the ledger.
--   • Bob is free-text     → SUPPRESS: no override up the normal leg (nothing to pay).
--   • Bob == normal upline → no-op (seed = normal upline, no stamp).
--
-- Precedence: held_under WINS over an approved alternate sponsor, which wins over the
-- normal upline. Prospective-only invariant mirrors the sponsorship gate: a policy is
-- affected only when held_under_since <= effective_date < COALESCE(held_under_until, ∞).
-- No backfill — set_contracted_under writes carrier_contracts only; existing override_
-- commissions never move. The override fn bodies are branched VERBATIM from the hardened
-- 20260610072218 (NOT 20260609203845) with only the held_under block + stamp added.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- Schema
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.carrier_contracts
  ADD COLUMN IF NOT EXISTS held_under_id    uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS held_under_name  text,
  ADD COLUMN IF NOT EXISTS held_under_since date,
  ADD COLUMN IF NOT EXISTS held_under_until date;

ALTER TABLE public.carrier_contracts
  DROP CONSTRAINT IF EXISTS held_under_exclusive;
ALTER TABLE public.carrier_contracts
  ADD CONSTRAINT held_under_exclusive
    CHECK (NOT (held_under_id IS NOT NULL AND held_under_name IS NOT NULL));

ALTER TABLE public.override_commissions
  ADD COLUMN IF NOT EXISTS redirected_from_upline_id    uuid REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS redirect_carrier_contract_id uuid REFERENCES public.carrier_contracts(id);

CREATE INDEX IF NOT EXISTS idx_oc_redirected_from
  ON public.override_commissions(redirected_from_upline_id)
  WHERE redirected_from_upline_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- regenerate_override_commissions(p_policy_id) — hardened + held_under reroute/ledger
--   Branched from 20260610072218; only the held_under block + INSERT stamp are new.
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

  -- NEW: "held under a different upline" WINS over the sponsorship seed (prospective-only,
  -- closed-interval gate so clearing is correct even when activation lags effective_date).
  SELECT cc.id, cc.held_under_id, cc.held_under_name
    INTO v_cc_id, v_held_under_id, v_held_under_name
  FROM carrier_contracts cc
  WHERE cc.agent_id = v_policy.user_id
    AND cc.carrier_id = v_policy.carrier_id
    AND cc.held_under_since IS NOT NULL
    AND cc.held_under_since <= v_policy.effective_date
    AND (cc.held_under_until IS NULL OR v_policy.effective_date < cc.held_under_until)
    AND (cc.held_under_id IS NOT NULL OR cc.held_under_name IS NOT NULL)
  ORDER BY cc.held_under_since DESC
  LIMIT 1;
  IF FOUND THEN
    IF v_held_under_name IS NOT NULL THEN
      RETURN 0;  -- free-text outside upline: suppress, money left the system
    ELSIF v_held_under_id IS NOT NULL THEN
      v_seed_upline_id := v_held_under_id;
      IF v_held_under_id <> v_default_upline THEN
        v_redirected_from := v_default_upline;  -- ledger: owed back by Bob
        v_redirect_cc_id  := v_cc_id;
      END IF;
    END IF;
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
'Regenerates override commissions for a policy. Override = monthly_premium * advance_months * (upline_rate - base_rate), rounded. Hardened: assert_in_acting_scope + pinned search_path. Seed precedence: held_under (carrier_contracts) > approved alternate sponsor > normal upline; all prospective-only. Free-text held_under suppresses; system-user held_under reroutes and stamps redirected_from_upline_id/redirect_carrier_contract_id (ledger). No backfill of pre-existing rows.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('regenerate_override_commissions', '20260613194758')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- create_override_commissions() — hardened + held_under reroute/ledger (trigger path)
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

  -- NEW: "held under a different upline" WINS over the sponsorship seed (prospective-only).
  SELECT cc.id, cc.held_under_id, cc.held_under_name
    INTO v_cc_id, v_held_under_id, v_held_under_name
  FROM carrier_contracts cc
  WHERE cc.agent_id = NEW.user_id
    AND cc.carrier_id = NEW.carrier_id
    AND cc.held_under_since IS NOT NULL
    AND cc.held_under_since <= NEW.effective_date
    AND (cc.held_under_until IS NULL OR NEW.effective_date < cc.held_under_until)
    AND (cc.held_under_id IS NOT NULL OR cc.held_under_name IS NOT NULL)
  ORDER BY cc.held_under_since DESC
  LIMIT 1;
  IF FOUND THEN
    IF v_held_under_name IS NOT NULL THEN
      RETURN NEW;  -- free-text outside upline: suppress, money left the system
    ELSIF v_held_under_id IS NOT NULL THEN
      v_seed_upline_id := v_held_under_id;
      IF v_held_under_id <> v_default_upline THEN
        v_redirected_from := v_default_upline;  -- ledger: owed back by Bob
        v_redirect_cc_id  := v_cc_id;
      END IF;
    END IF;
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
'Creates override commissions when a policy becomes active. Floor-based spread. Hardened: book-duplication guard + pinned search_path. Seed precedence: held_under (carrier_contracts) > approved alternate sponsor > normal upline; all prospective-only. Free-text held_under suppresses; system-user held_under reroutes and stamps redirected_from_upline_id/redirect_carrier_contract_id (ledger).';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('create_override_commissions', '20260613194758')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- set_contracted_under — write the held_under arrangement (agent self OR upline/staff).
--   All abuse/cycle guards live here so the money functions stay simple.
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
  v_caller       UUID := auth.uid();
  v_is_self      BOOLEAN;
  v_is_manager   BOOLEAN;
  v_agent_imo    UUID;
  v_normal_upline UUID;
  v_held_imo     UUID;
  v_name         TEXT := NULLIF(btrim(COALESCE(p_held_under_name, '')), '');
  v_clearing     BOOLEAN;
  v_row          public.carrier_contracts;
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

  -- Authorization: the agent themself, their upline, IMO staff, or super-admin.
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

  -- A held_under arrangement attaches to an existing contract row.
  IF NOT EXISTS (
    SELECT 1 FROM carrier_contracts WHERE agent_id = p_agent_id AND carrier_id = p_carrier_id
  ) THEN
    RAISE EXCEPTION 'No carrier contract exists for this agent and carrier';
  END IF;

  IF NOT v_clearing THEN
    -- Write-time guards (only when SETTING an arrangement).
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

      -- Cycle guard: held_under cannot be in the agent's own downline.
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

  UPDATE carrier_contracts SET
    held_under_id    = CASE WHEN v_clearing THEN NULL ELSE p_held_under_id END,
    held_under_name  = CASE WHEN v_clearing THEN NULL ELSE v_name END,
    held_under_since = CASE WHEN v_clearing THEN held_under_since
                            ELSE COALESCE(p_since, held_under_since, CURRENT_DATE) END,
    -- Clearing stops the arrangement prospectively (closed interval); setting reopens it.
    held_under_until = CASE WHEN v_clearing THEN CURRENT_DATE ELSE NULL END,
    updated_at = NOW()
  WHERE agent_id = p_agent_id AND carrier_id = p_carrier_id
  RETURNING * INTO v_row;

  -- When the AGENT self-marks (not the upline), make the bypassed normal upline aware.
  IF v_is_self AND NOT v_clearing AND v_normal_upline IS NOT NULL AND v_caller <> v_normal_upline THEN
    PERFORM create_notification(
      v_normal_upline,
      'held_under_set',
      'A downline marked a contract held under a different upline',
      (SELECT COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), email)
         FROM user_profiles WHERE id = p_agent_id)
        || ' marked their '
        || (SELECT name FROM carriers WHERE id = p_carrier_id)
        || ' contract as held under '
        || COALESCE(
             (SELECT COALESCE(NULLIF(CONCAT_WS(' ', first_name, last_name), ''), email)
                FROM user_profiles WHERE id = p_held_under_id),
             v_name, 'another upline')
        || '. New business overrides for this carrier will route there.',
      jsonb_build_object('agent_id', p_agent_id, 'carrier_id', p_carrier_id,
                         'held_under_id', p_held_under_id, 'held_under_name', v_name,
                         'link', '/contracting?tab=downline'),
      NULL
    );
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_contracted_under(UUID, UUID, UUID, TEXT, DATE) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_contracted_under(UUID, UUID, UUID, TEXT, DATE) TO authenticated;

COMMENT ON FUNCTION public.set_contracted_under IS
'Sets/clears the held_under arrangement on an existing carrier_contracts row. Caller must be the agent, their upline, IMO staff, or super-admin. Guards (reject at write): both id+name, self, cross-IMO, agent''s-own-downline (cycle). Clearing stops prospectively via held_under_until=CURRENT_DATE. Agent self-marks notify the bypassed normal upline (held_under_set).';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('set_contracted_under', '20260613194758')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- get_my_contracts — own contracts incl. resolved held_under (replaces the direct
--   table select so held_under user names resolve server-side regardless of RLS).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_my_contracts()
RETURNS TABLE (
  carrier_id uuid, carrier_name text, status text, writing_number text,
  requested_date date, submitted_date date, approved_date date, notes text,
  held_under_id uuid, held_under_name text, held_under_user_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cc.carrier_id, c.name::text, cc.status, cc.writing_number,
         cc.requested_date, cc.submitted_date, cc.approved_date, cc.notes,
         cc.held_under_id, cc.held_under_name,
         COALESCE(NULLIF(CONCAT_WS(' ', hu.first_name, hu.last_name), ''), hu.email)
  FROM carrier_contracts cc
  JOIN carriers c ON c.id = cc.carrier_id
  LEFT JOIN user_profiles hu ON hu.id = cc.held_under_id
  WHERE cc.agent_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_contracts() TO authenticated;

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_my_contracts', '20260613194758')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- get_my_downline_contracts — add resolved held_under columns (rest verbatim).
-- ════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_my_downline_contracts();
CREATE OR REPLACE FUNCTION public.get_my_downline_contracts()
RETURNS TABLE (
  agent_id uuid, agent_name text, contract_level integer,
  carrier_id uuid, carrier_name text, status text, writing_number text,
  requested_date date, submitted_date date, approved_date date, updated_at timestamptz,
  held_under_id uuid, held_under_name text, held_under_user_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cc.agent_id,
         COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email),
         up.contract_level,
         cc.carrier_id, c.name::text, cc.status, cc.writing_number,
         cc.requested_date, cc.submitted_date, cc.approved_date, cc.updated_at,
         cc.held_under_id, cc.held_under_name,
         COALESCE(NULLIF(CONCAT_WS(' ', hu.first_name, hu.last_name), ''), hu.email)
  FROM carrier_contracts cc
  JOIN user_profiles up ON up.id = cc.agent_id
  JOIN carriers c ON c.id = cc.carrier_id
  LEFT JOIN user_profiles hu ON hu.id = cc.held_under_id
  WHERE is_upline_of(cc.agent_id)
  ORDER BY up.last_name, up.first_name, c.name;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_downline_contracts() TO authenticated;

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_my_downline_contracts', '20260613194758')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

-- ════════════════════════════════════════════════════════════════════════════
-- get_my_override_redirect_ledger — "what Bob owes me back": rerouted overrides where
--   the caller is the bypassed normal upline (redirected_from_upline_id = auth.uid()).
--   Grouped agent → carrier → recipient (Bob).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_my_override_redirect_ledger()
RETURNS TABLE (
  agent_id uuid, agent_name text,
  carrier_id uuid, carrier_name text,
  recipient_id uuid, recipient_name text,
  policy_count bigint, total_amount numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT oc.base_agent_id,
         COALESCE(NULLIF(CONCAT_WS(' ', ag.first_name, ag.last_name), ''), ag.email),
         oc.carrier_id, c.name::text,
         oc.override_agent_id,
         COALESCE(NULLIF(CONCAT_WS(' ', rc.first_name, rc.last_name), ''), rc.email),
         COUNT(DISTINCT oc.policy_id),
         COALESCE(SUM(oc.override_commission_amount), 0)
  FROM override_commissions oc
  JOIN user_profiles ag ON ag.id = oc.base_agent_id
  JOIN user_profiles rc ON rc.id = oc.override_agent_id
  JOIN carriers c ON c.id = oc.carrier_id
  WHERE oc.redirected_from_upline_id = auth.uid()
    AND oc.status <> 'cancelled'
  GROUP BY oc.base_agent_id, ag.first_name, ag.last_name, ag.email,
           oc.carrier_id, c.name, oc.override_agent_id, rc.first_name, rc.last_name, rc.email
  ORDER BY ag.last_name, ag.first_name, c.name;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_override_redirect_ledger() TO authenticated;

COMMENT ON FUNCTION public.get_my_override_redirect_ledger IS
'Reconciliation ledger for the bypassed normal upline: override_commissions rerouted away from the caller (redirected_from_upline_id = auth.uid()) to a "held under" recipient, grouped by agent → carrier → recipient with policy counts and total $ owed back.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_my_override_redirect_ledger', '20260613194758')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
