-- Migration B: Fix outcome dedup index to allow repeat status events
--
-- Problem: The existing idx_lho_dedup uses COALESCE(close_opp_id, '') which means
-- non-opportunity outcomes (status_advance, status_regress, stagnant) all share
-- close_opp_id=NULL → COALESCE='', so only ONE event of each type per lead is
-- ever allowed. A lead that advances, regresses, then advances again has its
-- second status_advance silently dropped.
--
-- Fix: Split into two partial unique indexes:
--   1) Opportunity outcomes: one per (user, lead, type, opp_id)
--   2) Status outcomes: one per (user, lead, type) per calendar day

-- Drop the broken combined index
DROP INDEX IF EXISTS idx_lho_dedup;

-- Opportunity-based outcomes: dedup by opp_id (won/lost can only happen once per opp)
CREATE UNIQUE INDEX idx_lho_dedup_opp
  ON lead_heat_outcomes (user_id, close_lead_id, outcome_type, close_opp_id)
  WHERE close_opp_id IS NOT NULL;

-- Status-based outcomes: allow one per type per day (tracks daily progression)
-- NOTE: Uses AT TIME ZONE 'UTC' to make the expression immutable for indexing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lho_dedup_status
  ON lead_heat_outcomes (
    user_id, close_lead_id, outcome_type,
    ((occurred_at AT TIME ZONE 'UTC')::date)
  )
  WHERE close_opp_id IS NULL;
