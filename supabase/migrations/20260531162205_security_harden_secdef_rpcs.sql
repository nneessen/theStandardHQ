-- Security hardening of SECURITY DEFINER RPCs (audit 2026-05-31)
--
-- Closes anon-reachable, RLS-bypassing tenant-isolation holes found by the
-- 2026-05-31 backend security audit. Each function below was EXECUTE-able by the
-- public `anon` role (the key shipped in the browser bundle) and either leaked
-- cross-tenant data, performed a cross-tenant write, or returned a secret.
--
-- Fix strategy per finding (see docs/security/SECURITY_AUDIT_2026-05-31.md):
--   C2 get_close_api_key               -> revoke anon (server-only; all 7 callers use service_role); pin search_path
--   H1 regenerate_override_commissions -> assert_in_acting_scope(policy.imo_id); pin search_path; revoke anon
--   H2 cascade_agency_assignment       -> require admin + assert_in_acting_scope(p_imo_id); revoke anon
--   H3 set_leaderboard_title_batch     -> scope UPDATE to caller IMO + ownership/admin; revoke anon
--   M3 update_daily_leaderboard_title  -> derive identity from auth.uid() (was caller-supplied p_user_id); revoke anon
--   H5 get_lead_vendor_user_breakdown  -> scope to caller IMO (super-admin bypass); revoke anon
--
-- DELIBERATELY EXCLUDED — H4 get_sync_webhook_secret: handled separately. Vault has no
-- 'sync_webhook_secret' row yet, and the comment names an off-repo `newAgentPortal` caller
-- that may use the anon key. Revoking anon / removing the hardcoded fallback here would risk
-- a sync outage. Follow-up sequence: rotate the leaked secret -> store in Vault ->
-- migrate the external caller to the service_role key -> THEN revoke anon + drop fallback.
--
-- Grant model: REVOKE from anon + PUBLIC, then GRANT explicitly. Several functions
-- had NO explicit `authenticated` grant and relied on PUBLIC, so authenticated is
-- granted back explicitly where the frontend calls the function with a user JWT.
-- CREATE OR REPLACE preserves prior grants, so the REVOKE/GRANT pairs are authoritative.

BEGIN;

-- =====================================================================
-- C2 — get_close_api_key: server-side only; the anon grant was the leak.
-- Body unchanged; add pinned search_path (was missing).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_close_api_key(p_user_id uuid)
  RETURNS text
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT cc.api_key_encrypted
  FROM close_config cc
  WHERE cc.is_active = true
    AND (
      cc.user_id = p_user_id
      OR
      cc.user_id = (
        SELECT a.owner_id
        FROM user_profiles up
        JOIN agencies a ON a.id = up.agency_id
        WHERE up.id = p_user_id
        LIMIT 1
      )
    )
  ORDER BY (cc.user_id = p_user_id) DESC
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_close_api_key(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_close_api_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_close_api_key(uuid) TO service_role;

-- =====================================================================
-- H1 — regenerate_override_commissions: block cross-IMO regeneration.
-- Adds assert_in_acting_scope on the policy's IMO + pinned search_path.
-- =====================================================================
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
  -- The override mirrors the base commission's advance period exactly.
  SELECT COALESCE(months_paid, 0), COALESCE(advance_months, 9)
  INTO v_months_paid, v_advance_months
  FROM commissions WHERE policy_id = p_policy_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_months_paid IS NULL THEN
    v_months_paid := 0;
  END IF;
  IF v_advance_months IS NULL OR v_advance_months <= 0 THEN
    v_advance_months := 9;  -- industry-standard default advance period
  END IF;

  -- Advance basis uses MONTHLY premium (annual / 12 fallback if monthly is absent)
  v_monthly_premium := COALESCE(v_policy.monthly_premium, v_policy.annual_premium / 12.0);

  -- Get base agent's contract comp level
  SELECT contract_level INTO v_base_comp_level
  FROM user_profiles WHERE id = v_policy.user_id;

  IF v_base_comp_level IS NULL THEN
    RAISE WARNING 'Policy % owner has no contract_level', p_policy_id;
    RETURN 0;
  END IF;

  -- Get base agent's commission rate
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

  -- Base advance on the 9-month (advance_months) basis, rounded to cents.
  v_base_commission_amount := ROUND(
    v_monthly_premium * v_advance_months * v_base_commission_rate, 2
  );

  -- Walk up hierarchy and create overrides
  FOR v_upline_record IN (
    WITH RECURSIVE upline_chain AS (
      SELECT up.id as upline_id, up.contract_level as upline_comp_level, 1 as depth
      FROM user_profiles up
      WHERE up.id = (SELECT upline_id FROM user_profiles WHERE id = v_policy.user_id)
        AND up.id IS NOT NULL AND up.contract_level IS NOT NULL
      UNION
      SELECT up.id, up.contract_level, uc.depth + 1
      FROM user_profiles up
      JOIN upline_chain uc ON up.id = (SELECT upline_id FROM user_profiles WHERE id = uc.upline_id)
      WHERE up.id IS NOT NULL AND up.contract_level IS NOT NULL
    )
    SELECT * FROM upline_chain
  ) LOOP
    -- Skip if upline has same or lower comp level
    IF v_upline_record.upline_comp_level <= v_base_comp_level THEN
      CONTINUE;
    END IF;

    -- Get upline's commission rate
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

    -- Upline advance and override on the SAME advance basis as the base, rounded.
    v_upline_commission_amount := ROUND(
      v_monthly_premium * v_advance_months * v_upline_commission_rate, 2
    );
    v_override_amount := ROUND(v_upline_commission_amount - v_base_commission_amount, 2);

    IF v_override_amount > 0 THEN
      -- Check if override already exists
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

-- =====================================================================
-- H2 — cascade_agency_assignment: GRANT-ONLY (revoke anon).
-- NOTE (2026-05-31): production already has a hardened body for this function
-- (admin check `is_super_admin`/`is_imo_admin` + dual target/owner-IMO scope) applied
-- out-of-band — NEWER than the stale local copy. We deliberately do NOT CREATE OR REPLACE
-- the body here (that would regress prod). We only revoke the leftover anon/PUBLIC grant
-- as defense-in-depth; the body's own admin guard already neutralizes anon callers.
-- (Local/remote body divergence for this one function is pre-existing drift to reconcile
-- separately by syncing prod's body down to local.)
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.cascade_agency_assignment(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cascade_agency_assignment(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cascade_agency_assignment(uuid, uuid, uuid) TO authenticated, service_role;

-- =====================================================================
-- H3 — set_leaderboard_title_batch: scope UPDATE to caller IMO + ownership.
-- p_user_id retained for signature compatibility but no longer trusted.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_leaderboard_title_batch(p_first_sale_group_id uuid, p_title text, p_user_id uuid DEFAULT NULL::uuid)
  RETURNS TABLE(updated_count integer, log_ids uuid[])
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_count INT;
  v_log_ids UUID[];
BEGIN
  -- Update all logs in the group, scoped for security:
  --   * rows must belong to the caller's acting IMO (super-admins bypass)
  --   * caller must be the first seller of the group OR an admin
  -- (was anon-reachable; p_user_id was an OPTIONAL filter -> NULL bypassed all authz)
  WITH updated AS (
    UPDATE daily_sales_logs
    SET title = p_title, title_set_at = NOW(), updated_at = NOW()
    WHERE (
      first_sale_group_id = p_first_sale_group_id
      OR (first_sale_group_id IS NULL AND id = p_first_sale_group_id)
    )
    AND (imo_id = public.get_effective_imo_id() OR public.is_super_admin())
    AND (first_seller_id = auth.uid() OR public.is_imo_admin() OR public.is_super_admin())
    RETURNING id
  )
  SELECT COUNT(*)::INT, ARRAY_AGG(id)
  INTO v_count, v_log_ids
  FROM updated;

  RETURN QUERY SELECT v_count, v_log_ids;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_leaderboard_title_batch(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_leaderboard_title_batch(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_leaderboard_title_batch(uuid, text, uuid) TO authenticated, service_role;

-- =====================================================================
-- M3 — update_daily_leaderboard_title: derive identity from auth.uid()
-- (was the caller-supplied p_user_id, which could be spoofed). Param kept
-- for signature compatibility but ignored for the authorization decision.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_daily_leaderboard_title(p_log_id uuid, p_title text, p_user_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_first_seller_id UUID;
  v_log_date DATE;
BEGIN
  SELECT first_seller_id, log_date INTO v_first_seller_id, v_log_date
  FROM daily_sales_logs
  WHERE id = p_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily sales log not found';
  END IF;

  -- SECURITY: identity comes from the verified JWT (auth.uid()), NOT a caller arg.
  IF v_first_seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the first seller can name the leaderboard'
      USING ERRCODE = '42501';
  END IF;

  IF v_log_date != CURRENT_DATE THEN
    RAISE EXCEPTION 'Can only name the leaderboard on the day of the first sale';
  END IF;

  UPDATE daily_sales_logs
  SET title = p_title, title_set_at = NOW(), updated_at = NOW()
  WHERE id = p_log_id;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_daily_leaderboard_title(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_daily_leaderboard_title(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_daily_leaderboard_title(uuid, text, uuid) TO authenticated, service_role;

-- =====================================================================
-- H5 — get_lead_vendor_user_breakdown: scope to caller's IMO.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_lead_vendor_user_breakdown(p_vendor_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
  RETURNS TABLE(user_id uuid, user_name text, last_purchase_date date, total_purchases bigint, total_leads integer, total_spent numeric, total_policies integer, total_commission numeric, avg_cost_per_lead numeric, avg_roi numeric, conversion_rate numeric, fresh_leads integer, aged_leads integer)
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT
    lp.user_id,
    COALESCE(up.first_name || ' ' || up.last_name, 'Unknown') as user_name,
    MAX(lp.purchase_date) as last_purchase_date,
    COUNT(lp.id)::bigint as total_purchases,
    COALESCE(SUM(lp.lead_count), 0)::integer as total_leads,
    COALESCE(SUM(lp.total_cost), 0) as total_spent,
    COALESCE(SUM(lp.policies_sold), 0)::integer as total_policies,
    COALESCE(SUM(lp.commission_earned), 0) as total_commission,
    CASE
      WHEN SUM(lp.lead_count) > 0 THEN SUM(lp.total_cost) / SUM(lp.lead_count)
      ELSE 0
    END as avg_cost_per_lead,
    CASE
      WHEN SUM(lp.total_cost) > 0 THEN ((SUM(lp.commission_earned) - SUM(lp.total_cost)) / SUM(lp.total_cost)) * 100
      ELSE 0
    END as avg_roi,
    CASE
      WHEN SUM(lp.lead_count) > 0 THEN (SUM(lp.policies_sold)::numeric / SUM(lp.lead_count)) * 100
      ELSE 0
    END as conversion_rate,
    COALESCE(SUM(CASE WHEN lp.lead_freshness = 'fresh' THEN lp.lead_count ELSE 0 END), 0)::integer as fresh_leads,
    COALESCE(SUM(CASE WHEN lp.lead_freshness = 'aged' THEN lp.lead_count ELSE 0 END), 0)::integer as aged_leads
  FROM lead_purchases lp
  LEFT JOIN user_profiles up ON up.id = lp.user_id
  WHERE lp.vendor_id = p_vendor_id
    -- SECURITY: scope to the caller's acting IMO (super-admins bypass). Was anon-reachable
    -- and returned per-user spend/commission/PII for ANY vendor across ALL tenants.
    AND (lp.imo_id = public.get_effective_imo_id() OR public.is_super_admin())
    AND (p_start_date IS NULL OR lp.purchase_date >= p_start_date)
    AND (p_end_date IS NULL OR lp.purchase_date <= p_end_date)
  GROUP BY lp.user_id, up.first_name, up.last_name
  ORDER BY last_purchase_date DESC NULLS LAST;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_lead_vendor_user_breakdown(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_lead_vendor_user_breakdown(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lead_vendor_user_breakdown(uuid, date, date) TO authenticated, service_role;

COMMIT;
