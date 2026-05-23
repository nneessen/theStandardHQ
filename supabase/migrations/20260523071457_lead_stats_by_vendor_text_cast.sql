-- =============================================================================
-- Fixup: cast lead_vendors.name::text in get_lead_stats_by_vendor
-- =============================================================================
-- 20260523071259 redefined the function declaring `vendor_name text` but the
-- underlying column is character varying(255). Postgres rejects the mismatch
-- at RETURN QUERY time. Explicit cast resolves it without changing the
-- function signature.
-- =============================================================================

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
    AND (v_effective_imo IS NULL OR lp.imo_id IS NULL OR lp.imo_id = v_effective_imo)
  WHERE lv.imo_id = v_scope_imo
  GROUP BY lv.id, lv.name
  ORDER BY total_spent DESC NULLS LAST;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_lead_stats_by_vendor(uuid, date, date) TO authenticated;
