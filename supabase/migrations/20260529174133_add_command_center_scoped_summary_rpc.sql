-- get_command_center_summary: caller-scoped production + pipeline rollup for the
-- assistant command-center "Production" panel. Replaces the org-wide
-- get_imo_production_summary read with a "Mine vs My Team" scope so an agent sees
-- their OWN book (and optionally their downline), not the entire IMO.
--
-- WHY: the panel showed whole-IMO totals (e.g. ~$644k MTD AP across all of Founders)
-- which is meaningless for an individual agent. This function scopes every metric to
-- a flat, DISTINCT set of user_ids derived from the caller:
--   p_scope = 'personal' -> { caller }
--   p_scope = 'team'     -> { caller } + entire downline subtree (hierarchy_path)
--
-- Single `user_id IN (set)` membership (NOT a hierarchy join) guarantees each policy /
-- lead is counted exactly once — avoids the nested-leader double-count that forced
-- get_imo_production_summary into existence (see migration 20260529084035).
--
-- TENANCY: the downline subtree is intersected with the caller's own imo_id, so a
-- team whose hierarchy_path crosses an IMO boundary (these exist in the data) never
-- folds another tenant's production into the caller's totals. Scope therefore stays
-- within the caller's IMO even though it is derived from hierarchy_path.
--
-- Metric semantics are preserved from the prior panel; only the scope predicate
-- changes (imo_id = v_imo  ->  user_id IN (scope set)):
--   total_ap           = SUM(annual_premium) for policies SUBMITTED in range (any status)
--   total_ip           = SUM(annual_premium) for APPROVED policies EFFECTIVE in range
--   total_policies     = COUNT of APPROVED policies EFFECTIVE in range
--   total_prospects    = recruit prospects ATTRIBUTED to the scope (recruiter_id), snapshot
--   total_leads_scored = lead_heat_scores owned by the scope (user_id), snapshot
--
-- The date range (p_start_date..p_end_date) applies ONLY to AP/IP/policies. Prospects
-- and leads_scored are current-pipeline snapshots (date-independent), matching how the
-- panel rendered them before.
--
-- SECURITY DEFINER is required: a team rollup must aggregate downline rows the caller's
-- RLS cannot see individually. Only AGGREGATES are returned (no rows / no PII), so there
-- is no leak. Scope is derived from auth.uid() + hierarchy_path, never a caller argument,
-- so an agent can only ever see themselves + their own subtree.
--
-- ADDED, not replacing: get_imo_production_summary stays in place (the currently
-- deployed prod frontend still calls it until the scoped frontend ships).

CREATE OR REPLACE FUNCTION public.get_command_center_summary(
  p_start_date date DEFAULT (date_trunc('month', CURRENT_DATE::timestamptz))::date,
  p_end_date date DEFAULT CURRENT_DATE,
  p_scope text DEFAULT 'team'
)
RETURNS TABLE(
  total_ap numeric,
  total_ip numeric,
  total_policies bigint,
  total_prospects bigint,
  total_leads_scored bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $function$
DECLARE
  v_uid uuid;
  v_path text;
  v_imo uuid;
  v_scope text;
BEGIN
  v_uid := auth.uid();

  -- Normalize scope. Fail CLOSED: an unrecognized or NULL scope narrows to
  -- 'personal' (the smaller view), never broadens to 'team'. An omitted argument
  -- still defaults to 'team' via the function signature; only a malformed explicit
  -- value lands here.
  v_scope := lower(p_scope);
  IF v_scope IS NULL OR v_scope NOT IN ('personal', 'team') THEN
    v_scope := 'personal';
  END IF;

  IF v_uid IS NULL THEN
    -- Unauthenticated / no context: render an empty panel instead of erroring.
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  SELECT up.hierarchy_path, up.imo_id
    INTO v_path, v_imo
  FROM user_profiles up
  WHERE up.id = v_uid;

  RETURN QUERY
  WITH scope_users AS (
    -- Always include the caller. Add the downline subtree only for 'team', and only
    -- when the caller's hierarchy_path is non-null (NULL || '.%' is NULL -> matches
    -- nobody, so guard it; a path-less agent simply scopes to themselves). The
    -- downline is intersected with the caller's imo_id so a subtree that crosses an
    -- IMO boundary never pulls another tenant's rows into the totals.
    SELECT v_uid AS uid
    UNION
    SELECT up.id
    FROM user_profiles up
    WHERE v_scope = 'team'
      AND v_path IS NOT NULL
      AND up.hierarchy_path LIKE v_path || '.%'
      AND up.imo_id = v_imo
  ),
  policy_agg AS (
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
    WHERE p.user_id IN (SELECT uid FROM scope_users)
  ),
  prospect_agg AS (
    SELECT COUNT(*)::bigint AS prospects
    FROM user_profiles r
    WHERE r.recruiter_id IN (SELECT uid FROM scope_users)
      AND r.archived_at IS NULL
      AND r.roles @> ARRAY['recruit']
      AND (
        r.onboarding_status = 'prospect'
        OR (r.onboarding_started_at IS NULL AND r.onboarding_status IS NULL)
      )
  ),
  leads_agg AS (
    SELECT COUNT(*)::bigint AS leads_scored
    FROM lead_heat_scores lhs
    WHERE lhs.user_id IN (SELECT uid FROM scope_users)
  )
  SELECT pa.ap, pa.ip, pa.policies, pr.prospects, la.leads_scored
  FROM policy_agg pa
  CROSS JOIN prospect_agg pr
  CROSS JOIN leads_agg la;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_command_center_summary(date, date, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_command_center_summary(date, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_command_center_summary(date, date, text) TO authenticated;
