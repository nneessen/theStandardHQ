-- Prevent concurrent scoring runs for the same user at the database level.
-- The edge function has an application-level concurrency guard (check-then-insert),
-- but it is vulnerable to TOCTOU race conditions. This partial unique index makes
-- the second INSERT fail with a unique constraint violation (code 23505), which the
-- edge function catches and returns "Already running".

CREATE UNIQUE INDEX IF NOT EXISTS idx_lhsr_one_running_per_user
  ON lead_heat_scoring_runs (user_id)
  WHERE status = 'running';
