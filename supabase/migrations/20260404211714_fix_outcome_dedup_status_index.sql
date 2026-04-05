-- Fixup: Create the status-based outcome dedup index that failed in the
-- previous migration due to the ::date cast not being immutable on TIMESTAMPTZ.
-- Uses (occurred_at AT TIME ZONE 'UTC')::date which IS immutable since the
-- timezone is fixed to UTC.

CREATE UNIQUE INDEX IF NOT EXISTS idx_lho_dedup_status
  ON lead_heat_outcomes (
    user_id,
    close_lead_id,
    outcome_type,
    ((occurred_at AT TIME ZONE 'UTC')::date)
  )
  WHERE close_opp_id IS NULL;
