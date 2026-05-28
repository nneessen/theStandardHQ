-- supabase/migrations/20260528115847_get_lead_priorities.sql
-- Lead Prioritization agent: a read RPC that returns the caller's highest-priority
-- sales leads from lead_heat_scores (Close-synced + heat-scored), hottest first and
-- surfacing leads going cold.
--
-- SECURITY INVOKER (like get_at_risk_commissions): the lead_heat_scores RLS policy
-- "Users read own scores" (auth.uid() = user_id) does the scoping, so even if a
-- caller passes another p_user_id they only ever see their own leads. Returns the
-- lean ranking fields only — NOT the heavy jsonb (signals/breakdown/ai_insights) —
-- to keep payload and audit-log size down.

CREATE OR REPLACE FUNCTION get_lead_priorities(
  p_user_id uuid DEFAULT NULL,
  p_limit   int  DEFAULT 10
)
RETURNS TABLE (
  close_lead_id   text,
  display_name    text,
  score           smallint,
  heat_level      text,
  trend           text,
  previous_score  smallint,
  percentile_rank smallint,
  last_activity_at timestamptz,
  scored_at        timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT close_lead_id, display_name, score, heat_level, trend,
         previous_score, percentile_rank, last_activity_at, scored_at
  FROM lead_heat_scores
  WHERE (p_user_id IS NULL OR user_id = p_user_id)
  ORDER BY score DESC NULLS LAST, last_activity_at ASC NULLS LAST
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
$$;

REVOKE ALL ON FUNCTION get_lead_priorities(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_lead_priorities(uuid, int) TO authenticated;

COMMENT ON FUNCTION get_lead_priorities(uuid, int) IS
  'Top-priority sales leads for the caller from lead_heat_scores, hottest first then most-stale. SECURITY INVOKER so RLS (auth.uid()=user_id) scopes to own leads. Lean ranking fields only (no signals/breakdown/ai_insights jsonb). Used by the Lead Prioritization assistant agent.';
