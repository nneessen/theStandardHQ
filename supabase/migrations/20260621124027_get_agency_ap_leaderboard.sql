-- get_agency_ap_leaderboard — a SMALL, ADDITIVE companion to get_leaderboard_data
-- for the Social Studio "agency AP leaderboard" / "Agent of the Week" graphics.
--
-- WHY: get_leaderboard_data ranks/returns an agent's ANNUAL PREMIUM (all SUBMITTED
-- policies, by submit_date) next to policy_count = ISSUED policies (approved, by
-- effective_date) — two different policy populations on different date anchors. The
-- matching SUBMITTED count (ap_data.submitted_policies) is computed there but dropped
-- from its RETURNS. Social graphics that pair AP with a count would publish
-- internally-inconsistent numbers. This function returns the AP-CONSISTENT submitted
-- count so the card can show a count that matches the premium it ranks on.
--
-- DESIGN: additive (no change to the shared get_leaderboard_data — zero blast radius
-- on the app-wide leaderboard). Self-scoped to the caller's IMO via get_my_imo_id()
-- under SECURITY DEFINER — exactly the security model get_leaderboard_data uses, so a
-- caller can never read another IMO's data and a foreign p_agency_id returns no rows.
-- The active_agents / agency filter and the ap_data expressions are copied verbatim
-- from get_leaderboard_data so the AP (and the agent set) match the in-app leaderboard.

CREATE OR REPLACE FUNCTION public.get_agency_ap_leaderboard(
  p_start_date date,
  p_end_date date,
  p_agency_id uuid
)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  profile_photo_url text,
  ap_total numeric,
  submitted_policies bigint
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

  RETURN QUERY
  WITH
  -- Identical agent set to get_leaderboard_data: approved, non-archived,
  -- agent/active_agent/admin, excluding recruit-only profiles.
  active_agents AS (
    SELECT
      u.id,
      COALESCE(u.first_name || ' ' || u.last_name, u.email) AS name,
      u.profile_photo_url,
      u.agency_id
    FROM user_profiles u
    WHERE u.imo_id = v_imo_id
      AND u.approval_status = 'approved'
      AND u.archived_at IS NULL
      AND (
        u.roles @> ARRAY['agent']
        OR u.roles @> ARRAY['active_agent']
        OR u.is_admin = true
      )
      AND NOT (
        u.roles @> ARRAY['recruit']
        AND NOT u.roles @> ARRAY['agent']
        AND NOT u.roles @> ARRAY['active_agent']
      )
  ),
  scoped_agents AS (
    SELECT a.* FROM active_agents a WHERE a.agency_id = p_agency_id
  ),
  -- Verbatim copy of get_leaderboard_data's ap_data CTE: SUBMITTED policies by
  -- submit_date, IMO-scoped — so ap_total here == the in-app leaderboard's ap_total.
  ap_data AS (
    SELECT
      p.user_id,
      SUM(COALESCE(p.annual_premium, 0)) AS total_ap,
      COUNT(DISTINCT p.id) AS submitted_policies
    FROM policies p
    WHERE p.imo_id = v_imo_id
      AND p.submit_date IS NOT NULL
      AND p.submit_date >= p_start_date
      AND p.submit_date <= p_end_date
    GROUP BY p.user_id
  )
  SELECT
    sa.id AS agent_id,
    sa.name AS agent_name,
    sa.profile_photo_url,
    COALESCE(ap.total_ap, 0) AS ap_total,
    COALESCE(ap.submitted_policies, 0) AS submitted_policies
  FROM scoped_agents sa
  LEFT JOIN ap_data ap ON ap.user_id = sa.id
  ORDER BY ap_total DESC, agent_name ASC;
END;
$function$;

-- Lock down: only authenticated callers (the function self-scopes by JWT IMO).
REVOKE ALL ON FUNCTION public.get_agency_ap_leaderboard(date, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_agency_ap_leaderboard(date, date, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_agency_ap_leaderboard(date, date, uuid) TO authenticated;
