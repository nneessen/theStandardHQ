-- Migration D: Add updated_at triggers + previous_score CHECK constraint
--
-- Problem: lead_heat_scores and lead_heat_agent_weights have updated_at columns
-- but no BEFORE UPDATE triggers. The edge function manually sets updated_at in
-- some code paths but misses others. Direct SQL updates leave stale timestamps.
--
-- Also adds a CHECK constraint on previous_score to prevent out-of-range values
-- from propagating through the trend calculation.

-- ─── updated_at trigger for lead_heat_scores ─────────────────────────

CREATE OR REPLACE FUNCTION update_lead_heat_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lead_heat_scores_updated_at
  BEFORE UPDATE ON lead_heat_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_heat_scores_updated_at();

-- ─── updated_at trigger for lead_heat_agent_weights ──────────────────

CREATE OR REPLACE FUNCTION update_lead_heat_agent_weights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_lead_heat_agent_weights_updated_at
  BEFORE UPDATE ON lead_heat_agent_weights
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_heat_agent_weights_updated_at();

-- ─── previous_score range check ──────────────────────────────────────

ALTER TABLE lead_heat_scores
  ADD CONSTRAINT lead_heat_scores_previous_score_range
  CHECK (previous_score IS NULL OR (previous_score >= 0 AND previous_score <= 100));
