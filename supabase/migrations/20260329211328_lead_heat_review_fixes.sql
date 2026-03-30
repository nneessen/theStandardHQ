-- Lead Heat Index: code review fixes
-- H5: Add WITH CHECK to all service_role policies
-- M3: Add dedup constraint on lead_heat_outcomes
-- M10: Add CHECK constraint on score (0-100)
-- Also: RPC for avg score (avoids fetching all rows client-side)

-- ═══════════════════════════════════════════════════════════════════════
-- H5: Fix service_role policies to include WITH CHECK (project convention)
-- ═══════════════════════════════════════════════════════════════════════

-- lead_heat_scores
DROP POLICY IF EXISTS "Service role full access on lead_heat_scores" ON lead_heat_scores;
CREATE POLICY "Service role full access on lead_heat_scores"
  ON lead_heat_scores FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- lead_heat_agent_weights
DROP POLICY IF EXISTS "Service role full access on lead_heat_agent_weights" ON lead_heat_agent_weights;
CREATE POLICY "Service role full access on lead_heat_agent_weights"
  ON lead_heat_agent_weights FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- lead_heat_outcomes
DROP POLICY IF EXISTS "Service role full access on lead_heat_outcomes" ON lead_heat_outcomes;
CREATE POLICY "Service role full access on lead_heat_outcomes"
  ON lead_heat_outcomes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- lead_heat_scoring_runs
DROP POLICY IF EXISTS "Service role full access on lead_heat_scoring_runs" ON lead_heat_scoring_runs;
CREATE POLICY "Service role full access on lead_heat_scoring_runs"
  ON lead_heat_scoring_runs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- lead_heat_ai_portfolio_analysis
DROP POLICY IF EXISTS "Service role full access on lead_heat_ai_portfolio_analysis" ON lead_heat_ai_portfolio_analysis;
CREATE POLICY "Service role full access on lead_heat_ai_portfolio_analysis"
  ON lead_heat_ai_portfolio_analysis FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════════════════
-- M10: Add CHECK constraint on score (0-100)
-- ═══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lead_heat_scores_score_range'
    AND table_name = 'lead_heat_scores'
  ) THEN
    ALTER TABLE lead_heat_scores
      ADD CONSTRAINT lead_heat_scores_score_range CHECK (score >= 0 AND score <= 100);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════
-- M3: Add dedup constraint on lead_heat_outcomes
-- Prevents duplicate outcome events from overlapping scoring runs
-- ═══════════════════════════════════════════════════════════════════════

-- Use a unique index to prevent duplicate outcomes per lead/opp/type
-- COALESCE maps NULL opp_id to empty string for uniqueness
-- One outcome per lead per type per opportunity is sufficient granularity
CREATE UNIQUE INDEX IF NOT EXISTS idx_lho_dedup
  ON lead_heat_outcomes (user_id, close_lead_id, outcome_type, COALESCE(close_opp_id, ''));

-- ═══════════════════════════════════════════════════════════════════════
-- RPC: avg_lead_heat_score — server-side aggregate for summary widget
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION avg_lead_heat_score(p_user_id UUID)
RETURNS TABLE(avg_score NUMERIC) AS $$
  SELECT COALESCE(AVG(score)::NUMERIC, 0) AS avg_score
  FROM lead_heat_scores
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Grant execute to authenticated users (RPC will use the user_id parameter, not RLS)
GRANT EXECUTE ON FUNCTION avg_lead_heat_score(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION avg_lead_heat_score(UUID) TO service_role;
