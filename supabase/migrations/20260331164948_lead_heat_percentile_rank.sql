-- Add percentile rank and scoring model version to lead_heat_scores.
-- Percentile-based calibration replaces fixed score thresholds for heat level assignment.
ALTER TABLE lead_heat_scores ADD COLUMN IF NOT EXISTS percentile_rank SMALLINT;
ALTER TABLE lead_heat_scores ADD COLUMN IF NOT EXISTS scoring_model_version TEXT DEFAULT 'heuristic_v1';
