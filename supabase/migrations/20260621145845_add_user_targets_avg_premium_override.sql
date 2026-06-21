-- Add per-agent average-premium override to user_targets.
--
-- Each agent controls their own avg-premium divisor for the Optimistic/Realistic
-- target plans, replacing the agency-wide constants.avgAP override on the Targets
-- page (per-agent-only model). NULL = "not set" → target math falls back to the
-- computed cohort average (Mean/Median per premium_stat_preference).
--
-- RLS: user_targets already restricts every operation to user_id = auth.uid()
-- (see 20260113_003_user_targets_own_access_policy.sql), so this column is
-- automatically protected. No new policy required.

ALTER TABLE public.user_targets
  ADD COLUMN IF NOT EXISTS avg_premium_override numeric;

COMMENT ON COLUMN public.user_targets.avg_premium_override IS
  'Per-agent average annual premium override for target calculations. NULL = use computed cohort average. Replaces agency-wide constants.avgAP on the Targets page.';
