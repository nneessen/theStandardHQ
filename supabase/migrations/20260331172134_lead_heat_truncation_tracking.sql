-- Track when scoring runs hit API limits and data was truncated.
-- Frontend uses this to show partial-data warnings.
ALTER TABLE lead_heat_scoring_runs ADD COLUMN IF NOT EXISTS is_truncated BOOLEAN DEFAULT false;
