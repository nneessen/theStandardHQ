-- Fix: deep-dive cache was using updated_at for TTL, which resets on every scoring run.
-- Add a dedicated timestamp for when AI insights were actually generated.
ALTER TABLE lead_heat_scores ADD COLUMN IF NOT EXISTS ai_insights_generated_at TIMESTAMPTZ;
