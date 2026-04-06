-- Team Pipeline Snapshot RPCs for the Close KPIs Team tab.
--
-- Adds two SECURITY DEFINER functions that let a manager view aggregated
-- pipeline metrics for their downline agents:
--
--   1. get_team_pipeline_snapshot(p_target_user_ids UUID[] DEFAULT NULL)
--      Returns one aggregated row per agent (caller + downlines with
--      close_config). Super-admins see every user with close_config.
--      Aggregates lead_heat_scores by user_id, extracting engagement
--      signals from the signals JSONB column.
--
--   2. user_can_view_team_tab()
--      Returns true if the caller is super_admin OR has at least one
--      downline (their UUID appears in another user_profiles.hierarchy_path).
--      Used by the frontend to conditionally render the Team tab.
--
-- IMPORTANT: get_team_pipeline_snapshot depends on the following keys
-- being present in lead_heat_scores.signals (JSONB):
--
--   callsOutbound, callsAnswered, consecutiveNoAnswers, straightToVmCount,
--   hoursSinceLastTouch, hasActiveOpportunity, opportunityValueUsd,
--   isPositiveStatus
--
-- These are emitted by supabase/functions/close-lead-heat-score/signal-extractor.ts
-- (LeadSignals interface in types.ts). If those keys are renamed in the
-- edge function, this RPC will silently return zeros — update both.
--
-- A vitest schema-drift guard at:
--   src/features/close-kpi/services/__tests__/team-pipeline-signal-keys.test.ts
-- pins the key list against LeadSignals at build time.
--
-- TIME WINDOW SEMANTIC:
-- close-lead-heat-score/index.ts fetches activities from Close API with
-- `date_created__gte=${thirtyDaysAgo}`, so signals.callsOutbound and
-- signals.callsAnswered are counts of outbound calls in the LAST 30 DAYS
-- per lead, refreshed every 30 minutes by pg_cron. The aggregations below
-- therefore represent a 30-day rolling window of agent activity, NOT
-- all-time totals. The frontend surfaces this in the Team tab header.

BEGIN;

-- ============================================================================
-- 1. get_team_pipeline_snapshot
-- ============================================================================

CREATE OR REPLACE FUNCTION get_team_pipeline_snapshot(
  p_target_user_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  user_id              UUID,
  first_name           TEXT,
  last_name            TEXT,
  email                TEXT,
  profile_photo_url    TEXT,
  is_self              BOOLEAN,
  has_close_config     BOOLEAN,
  last_scored_at       TIMESTAMPTZ,
  total_leads          INTEGER,
  hot_count            INTEGER,
  warming_count        INTEGER,
  neutral_count        INTEGER,
  cooling_count        INTEGER,
  cold_count           INTEGER,
  avg_score            NUMERIC,
  total_dials          INTEGER,
  total_connects       INTEGER,
  connect_rate         NUMERIC,
  stale_leads_count    INTEGER,
  untouched_active     INTEGER,
  no_answer_streak     INTEGER,
  straight_to_vm       INTEGER,
  active_opps_count    INTEGER,
  open_opp_value_usd   NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_is_admin BOOLEAN := is_super_admin();
  v_allowed  UUID[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Resolve allowed agent set
  -- Filter close_config on is_active so disconnected agents drop off the list.
  -- Filter out archived users so deactivated profiles don't appear in the team view.
  IF v_is_admin THEN
    SELECT array_agg(cc.user_id) INTO v_allowed
      FROM close_config cc
      JOIN user_profiles up ON up.id = cc.user_id
     WHERE cc.is_active = true
       AND up.archived_at IS NULL;
  ELSE
    SELECT array_agg(up.id) INTO v_allowed
      FROM user_profiles up
      JOIN close_config cc ON cc.user_id = up.id
     WHERE cc.is_active = true
       AND up.archived_at IS NULL
       AND (
         up.id = v_caller   -- include self
         OR (up.hierarchy_path IS NOT NULL
             AND up.hierarchy_path LIKE '%' || v_caller::text || '%'
             AND up.id != v_caller)
       );
  END IF;

  IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN; -- caller has no team and no own close_config
  END IF;

  -- Optional narrowing param, intersected with allowed set
  IF p_target_user_ids IS NOT NULL THEN
    SELECT array_agg(x) INTO v_allowed
      FROM unnest(v_allowed) x
     WHERE x = ANY (p_target_user_ids);
  END IF;

  IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN; -- intersection emptied the allowed set
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      lhs.user_id,
      lhs.score,
      lhs.heat_level,
      lhs.scored_at,
      COALESCE((lhs.signals->>'callsOutbound')::int, 0)              AS calls_out,
      COALESCE((lhs.signals->>'callsAnswered')::int, 0)              AS calls_ans,
      COALESCE((lhs.signals->>'consecutiveNoAnswers')::int, 0)       AS no_ans,
      COALESCE((lhs.signals->>'straightToVmCount')::int, 0)          AS vm_cnt,
      NULLIF(lhs.signals->>'hoursSinceLastTouch', '')::numeric       AS hrs_since,
      COALESCE((lhs.signals->>'hasActiveOpportunity')::boolean, false) AS has_active_opp,
      COALESCE((lhs.signals->>'opportunityValueUsd')::numeric, 0)    AS opp_val,
      COALESCE((lhs.signals->>'isPositiveStatus')::boolean, false)   AS is_pos
    FROM lead_heat_scores lhs
    WHERE lhs.user_id = ANY (v_allowed)
  ),
  agg AS (
    SELECT
      base.user_id,
      MAX(base.scored_at)                                                AS last_scored_at,
      COUNT(*)::int                                                      AS total_leads,
      COUNT(*) FILTER (WHERE base.heat_level = 'hot')::int               AS hot_count,
      COUNT(*) FILTER (WHERE base.heat_level = 'warming')::int           AS warming_count,
      COUNT(*) FILTER (WHERE base.heat_level = 'neutral')::int           AS neutral_count,
      COUNT(*) FILTER (WHERE base.heat_level = 'cooling')::int           AS cooling_count,
      COUNT(*) FILTER (WHERE base.heat_level = 'cold')::int              AS cold_count,
      ROUND(AVG(base.score)::numeric, 1)                                 AS avg_score,
      SUM(base.calls_out)::int                                           AS total_dials,
      SUM(base.calls_ans)::int                                           AS total_connects,
      CASE WHEN SUM(base.calls_out) > 0
           THEN ROUND(SUM(base.calls_ans)::numeric / SUM(base.calls_out)::numeric, 4)
           ELSE NULL END                                                 AS connect_rate,
      COUNT(*) FILTER (WHERE base.hrs_since IS NOT NULL AND base.hrs_since > 72)::int AS stale_leads_count,
      COUNT(*) FILTER (WHERE base.is_pos AND (base.hrs_since IS NULL OR base.hrs_since > 48))::int AS untouched_active,
      COUNT(*) FILTER (WHERE base.no_ans >= 3)::int                      AS no_answer_streak,
      SUM(base.vm_cnt)::int                                              AS straight_to_vm,
      COUNT(*) FILTER (WHERE base.has_active_opp)::int                   AS active_opps_count,
      COALESCE(SUM(base.opp_val) FILTER (WHERE base.has_active_opp), 0)  AS open_opp_value_usd
    FROM base
    GROUP BY base.user_id
  )
  SELECT
    up.id,
    up.first_name,
    up.last_name,
    up.email,
    up.profile_photo_url,
    (up.id = v_caller)                  AS is_self,
    TRUE                                AS has_close_config,
    a.last_scored_at,
    COALESCE(a.total_leads, 0),
    COALESCE(a.hot_count, 0),
    COALESCE(a.warming_count, 0),
    COALESCE(a.neutral_count, 0),
    COALESCE(a.cooling_count, 0),
    COALESCE(a.cold_count, 0),
    a.avg_score,
    COALESCE(a.total_dials, 0),
    COALESCE(a.total_connects, 0),
    a.connect_rate,
    COALESCE(a.stale_leads_count, 0),
    COALESCE(a.untouched_active, 0),
    COALESCE(a.no_answer_streak, 0),
    COALESCE(a.straight_to_vm, 0),
    COALESCE(a.active_opps_count, 0),
    COALESCE(a.open_opp_value_usd, 0)
  FROM unnest(v_allowed) AS uid
  JOIN user_profiles up ON up.id = uid
  LEFT JOIN agg a ON a.user_id = up.id
  ORDER BY (up.id = v_caller) DESC, a.total_leads DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION get_team_pipeline_snapshot(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_team_pipeline_snapshot(UUID[]) TO authenticated;

COMMENT ON FUNCTION get_team_pipeline_snapshot(UUID[]) IS
  'Aggregated pipeline snapshot from lead_heat_scores for caller + downlines. Super-admins see all close-connected users. Self-resolves access via hierarchy_path. Phase 1 of Close KPIs Team tab.';

-- ============================================================================
-- 2. user_can_view_team_tab
-- ============================================================================

CREATE OR REPLACE FUNCTION user_can_view_team_tab()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
       WHERE up.hierarchy_path IS NOT NULL
         AND up.hierarchy_path LIKE '%' || auth.uid()::text || '%'
         AND up.id != auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION user_can_view_team_tab() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION user_can_view_team_tab() TO authenticated;

COMMENT ON FUNCTION user_can_view_team_tab() IS
  'Returns true if caller is super_admin OR has at least one downline. Used to conditionally render the Team tab on the Close KPIs page.';

COMMIT;
