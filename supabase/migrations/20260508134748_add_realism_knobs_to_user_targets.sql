-- Migration: 20260508134748_add_realism_knobs_to_user_targets.sql
-- Purpose: Persist the four "realism knobs" from the Targets page so the
-- Dashboard, GamePlan, IncomeGoalTracker, and any other consumer can render
-- the same realistic plan the user tuned.
--
-- Knobs (defaults match DEFAULT_REALISM_OPTIONS in
-- src/services/targets/targetsCalculationService.ts):
--   persistency_assumption    DEFAULT 0.75   — overrides historical when set
--   tax_reserve_rate          DEFAULT 0.30   — combined SE + federal + state reserve
--   nto_buffer_rate           DEFAULT 0.12   — apps-to-write multiplier
--   premium_stat_preference   DEFAULT 'median' — 'mean' | 'median' for avg premium
--
-- Additive only. Existing rows get defaults via DEFAULT clause.

ALTER TABLE public.user_targets
  ADD COLUMN IF NOT EXISTS persistency_assumption  numeric NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS tax_reserve_rate        numeric NOT NULL DEFAULT 0.30,
  ADD COLUMN IF NOT EXISTS nto_buffer_rate         numeric NOT NULL DEFAULT 0.12,
  ADD COLUMN IF NOT EXISTS premium_stat_preference text    NOT NULL DEFAULT 'median';

-- Bound the rate columns to sane ranges. Prevents bad client input from
-- producing nonsense math (e.g. negative tax, persistency > 100%).
ALTER TABLE public.user_targets
  ADD CONSTRAINT user_targets_persistency_assumption_range
    CHECK (persistency_assumption >= 0 AND persistency_assumption <= 1),
  ADD CONSTRAINT user_targets_tax_reserve_rate_range
    CHECK (tax_reserve_rate >= 0 AND tax_reserve_rate < 1),
  ADD CONSTRAINT user_targets_nto_buffer_rate_range
    CHECK (nto_buffer_rate >= 0 AND nto_buffer_rate < 1),
  ADD CONSTRAINT user_targets_premium_stat_preference_values
    CHECK (premium_stat_preference IN ('mean', 'median'));

COMMENT ON COLUMN public.user_targets.persistency_assumption IS
  'Persistency rate as decimal. Overrides historical 13-month persistency in target calculations. Default 0.75.';

COMMENT ON COLUMN public.user_targets.tax_reserve_rate IS
  'Combined effective tax rate as decimal (SE + federal + state). Used to gross-up annual_income_target into pre-tax commission needed. Default 0.30.';

COMMENT ON COLUMN public.user_targets.nto_buffer_rate IS
  'App-to-policy drag as decimal. Apps-to-write = issued × (1 + nto_buffer_rate). Default 0.12.';

COMMENT ON COLUMN public.user_targets.premium_stat_preference IS
  'Which statistic to use for avg policy premium divisor: mean (sensitive to outliers) or median (robust). Default median.';
