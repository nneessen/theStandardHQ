-- Migration A: Separate opp_snapshot from signals JSONB + add last_activity_at
--
-- Problem: _oppSnapshot was embedded inside the signals JSONB column, which:
--   1) Pollutes the signals object sent to AI prompts
--   2) Has no schema guarantee (undefined on pre-existing rows → phantom outcomes)
--   3) Makes it impossible to query opp state independently
--
-- Also adds last_activity_at to persist the last activity timestamp across scoring
-- runs, enabling stale-lead detection beyond the 30-day Close API fetch window.

-- Add dedicated columns
ALTER TABLE lead_heat_scores
  ADD COLUMN IF NOT EXISTS opp_snapshot JSONB DEFAULT '[]'::jsonb;

ALTER TABLE lead_heat_scores
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- Backfill: extract _oppSnapshot from existing signals JSONB into the new column,
-- then strip it from signals to prevent dual-storage.
UPDATE lead_heat_scores
SET
  opp_snapshot = COALESCE(signals->'_oppSnapshot', '[]'::jsonb),
  signals = signals - '_oppSnapshot'
WHERE signals ? '_oppSnapshot';

-- Index for quick lookups when building previous state map
CREATE INDEX IF NOT EXISTS idx_lhs_last_activity
  ON lead_heat_scores (user_id, last_activity_at DESC NULLS LAST)
  WHERE last_activity_at IS NOT NULL;
