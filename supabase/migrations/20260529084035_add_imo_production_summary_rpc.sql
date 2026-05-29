-- get_imo_production_summary: accurate, org-wide MTD production rollup for the
-- assistant command-center "Production · MTD" hero panel.
--
-- WHY: the panel previously derived its totals from get_team_leaderboard_data by
-- summing per-team-leader rows (calculateTeamTotals). Because a member under
-- nested leaders (A above B, both with 5+ downlines) matches BOTH leaders via the
-- hierarchy_path LIKE join, that sum double-counts overlapping subtrees — inflating
-- AP/IP/policies (observed ~$998k vs the true org-wide submitted-MTD AP of ~$628k).
--
-- This function computes the same metrics with NO team_members join: a single
-- pass over `policies` scoped to the caller's IMO, so every policy is counted once.
-- Metric semantics are preserved from the prior panel:
--   total_ap        = SUM(annual_premium) for policies SUBMITTED in range (any status)
--   total_ip        = SUM(annual_premium) for APPROVED policies EFFECTIVE in range
--   total_policies  = COUNT of APPROVED policies EFFECTIVE in range
--   total_prospects = recruit prospects in the IMO (date-independent, matches panel)
--
-- Scope mirrors get_team_leaderboard_data: SECURITY DEFINER + get_my_imo_id(), no
-- admin gate, so it is visible to any authenticated user in the IMO exactly like the
-- team leaderboard the panel already renders.

CREATE OR REPLACE FUNCTION public.get_imo_production_summary(
  p_start_date date DEFAULT (date_trunc('month', CURRENT_DATE::timestamptz))::date,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_ap numeric,
  total_ip numeric,
  total_policies bigint,
  total_prospects bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $function$
DECLARE
  v_imo_id uuid;
BEGIN
  v_imo_id := get_my_imo_id();

  IF v_imo_id IS NULL THEN
    -- No IMO context (e.g. unauthenticated): return zeros rather than error so the
    -- panel renders an empty state instead of failing.
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  RETURN QUERY
  WITH policy_agg AS (
    SELECT
      COALESCE(SUM(p.annual_premium) FILTER (
        WHERE p.submit_date IS NOT NULL
          AND p.submit_date >= p_start_date
          AND p.submit_date <= p_end_date
      ), 0)::numeric AS ap,
      COALESCE(SUM(p.annual_premium) FILTER (
        WHERE p.status = 'approved'
          AND p.effective_date IS NOT NULL
          AND p.effective_date >= p_start_date
          AND p.effective_date <= p_end_date
      ), 0)::numeric AS ip,
      COUNT(*) FILTER (
        WHERE p.status = 'approved'
          AND p.effective_date IS NOT NULL
          AND p.effective_date >= p_start_date
          AND p.effective_date <= p_end_date
      )::bigint AS policies
    FROM policies p
    WHERE p.imo_id = v_imo_id
  ),
  prospect_agg AS (
    SELECT COUNT(*)::bigint AS prospects
    FROM user_profiles r
    WHERE r.imo_id = v_imo_id
      AND r.archived_at IS NULL
      AND r.roles @> ARRAY['recruit']
      AND (
        r.onboarding_status = 'prospect'
        OR (r.onboarding_started_at IS NULL AND r.onboarding_status IS NULL)
      )
  )
  SELECT pa.ap, pa.ip, pa.policies, pr.prospects
  FROM policy_agg pa
  CROSS JOIN prospect_agg pr;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_imo_production_summary(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_imo_production_summary(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_imo_production_summary(date, date) TO authenticated;
