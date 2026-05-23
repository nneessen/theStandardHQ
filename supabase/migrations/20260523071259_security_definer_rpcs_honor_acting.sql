-- =============================================================================
-- SECURITY DEFINER stats RPCs honor acting_imo_id
-- =============================================================================
--
-- SECURITY DEFINER functions BYPASS RLS. The owner's privileges determine row
-- access, not the caller's. That means even after all the RLS migrations,
-- stats/aggregation RPCs that scope by `user_id = auth.uid()` happily return
-- the caller's Founders data when they're acting as Epic — RLS isn't even
-- consulted.
--
-- This migration rewrites the user-scoped stats RPCs that read from imo-scoped
-- tables to add a `(get_effective_imo_id() IS NULL OR row.imo_id IS NULL OR
-- row.imo_id = get_effective_imo_id())` clause to their WHERE.
--
-- WHAT'S FIXED:
--   get_lead_purchase_stats — dashboard for Expenses → Lead Purchases
--   get_lead_stats_by_vendor — breakdown by vendor
--
-- NOT TOUCHED (intentionally — personal config, not tenant data):
--   get_my_notification_preferences, is_contact_favorited, get_user_addons,
--   get_user_subscription_tier, etc.
--
-- TODO (next round, once user confirms more leaks):
--   get_clients_with_stats, get_agent_daily_stats, get_agency_premium_stats,
--   get_message_stats, get_uw_wizard_usage, get_module_progress_summary,
--   get_workflow_email_usage. Each needs inspection to confirm it reads from
--   an imo-scoped table.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_lead_purchase_stats(
  p_user_id uuid DEFAULT NULL::uuid,
  p_start_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date
)
RETURNS TABLE(
  total_purchases bigint,
  total_leads integer,
  total_spent numeric,
  total_policies integer,
  total_commission numeric,
  avg_cost_per_lead numeric,
  avg_roi numeric,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_effective_imo uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  v_effective_imo := public.get_effective_imo_id();

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_purchases,
    COALESCE(SUM(lp.lead_count), 0)::integer AS total_leads,
    COALESCE(SUM(lp.total_cost), 0) AS total_spent,
    COALESCE(SUM(lp.policies_sold), 0)::integer AS total_policies,
    COALESCE(SUM(lp.commission_earned), 0) AS total_commission,
    CASE
      WHEN SUM(lp.lead_count) > 0 THEN SUM(lp.total_cost) / SUM(lp.lead_count)
      ELSE 0
    END AS avg_cost_per_lead,
    CASE
      WHEN SUM(lp.total_cost) > 0 THEN ((SUM(lp.commission_earned) - SUM(lp.total_cost)) / SUM(lp.total_cost)) * 100
      ELSE 0
    END AS avg_roi,
    CASE
      WHEN SUM(lp.lead_count) > 0 THEN (SUM(lp.policies_sold)::numeric / SUM(lp.lead_count)) * 100
      ELSE 0
    END AS conversion_rate
  FROM lead_purchases lp
  WHERE lp.user_id = v_user_id
    AND (p_start_date IS NULL OR lp.purchase_date >= p_start_date)
    AND (p_end_date IS NULL OR lp.purchase_date <= p_end_date)
    -- IMO gate: honor super-admin acting via auth.users.raw_user_meta_data
    AND (v_effective_imo IS NULL OR lp.imo_id IS NULL OR lp.imo_id = v_effective_imo);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_lead_purchase_stats(uuid, date, date) TO authenticated;

-- ----------------------------------------------------------------------------
-- get_lead_stats_by_vendor — breakdown by vendor on the same page
-- Drop first because OUT parameters differ from what CREATE OR REPLACE expects.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_lead_stats_by_vendor(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_lead_stats_by_vendor(
  p_user_id uuid DEFAULT NULL::uuid,
  p_start_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date
)
RETURNS TABLE(
  vendor_id uuid,
  vendor_name text,
  total_purchases bigint,
  total_leads integer,
  total_spent numeric,
  total_policies integer,
  total_commission numeric,
  avg_cost_per_lead numeric,
  avg_roi numeric,
  conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_effective_imo uuid;
  v_scope_imo uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  v_effective_imo := public.get_effective_imo_id();
  -- For not-acting super-admin (v_effective_imo IS NULL), fall back to
  -- the user's real imo so the dashboard still works.
  v_scope_imo := COALESCE(v_effective_imo, (SELECT imo_id FROM user_profiles WHERE id = v_user_id));

  RETURN QUERY
  SELECT
    lv.id AS vendor_id,
    lv.name::text AS vendor_name,
    COUNT(lp.id)::bigint AS total_purchases,
    COALESCE(SUM(lp.lead_count), 0)::integer AS total_leads,
    COALESCE(SUM(lp.total_cost), 0) AS total_spent,
    COALESCE(SUM(lp.policies_sold), 0)::integer AS total_policies,
    COALESCE(SUM(lp.commission_earned), 0) AS total_commission,
    CASE
      WHEN SUM(lp.lead_count) > 0 THEN SUM(lp.total_cost) / SUM(lp.lead_count)
      ELSE 0
    END AS avg_cost_per_lead,
    CASE
      WHEN SUM(lp.total_cost) > 0 THEN ((SUM(lp.commission_earned) - SUM(lp.total_cost)) / SUM(lp.total_cost)) * 100
      ELSE 0
    END AS avg_roi,
    CASE
      WHEN SUM(lp.lead_count) > 0 THEN (SUM(lp.policies_sold)::numeric / SUM(lp.lead_count)) * 100
      ELSE 0
    END AS conversion_rate
  FROM lead_vendors lv
  LEFT JOIN lead_purchases lp
    ON lp.vendor_id = lv.id
    AND lp.user_id = v_user_id
    AND (p_start_date IS NULL OR lp.purchase_date >= p_start_date)
    AND (p_end_date IS NULL OR lp.purchase_date <= p_end_date)
    -- IMO gate on the purchases join too — without it, an Epic vendor that
    -- somehow had cross-imo purchases would still show Founders numbers.
    AND (v_effective_imo IS NULL OR lp.imo_id IS NULL OR lp.imo_id = v_effective_imo)
  WHERE lv.imo_id = v_scope_imo
  GROUP BY lv.id, lv.name
  ORDER BY total_spent DESC NULLS LAST;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_lead_stats_by_vendor(uuid, date, date) TO authenticated;
