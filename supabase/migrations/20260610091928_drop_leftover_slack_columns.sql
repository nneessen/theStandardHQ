-- Drop the last leftover Slack columns on kept tables (completes the full Slack
-- removal). Verified on prod: NO RLS policy, view, or function references either
-- column, and no live application code reads them (only a test mock + historical
-- migrations), so dropping them is safe and needs no CASCADE.
--
--   user_profiles.slack_member_overrides   (per-user Slack mention overrides)
--   communication_preferences.slack_enabled (Slack notification opt-in)

BEGIN;

ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS slack_member_overrides;

ALTER TABLE public.communication_preferences
  DROP COLUMN IF EXISTS slack_enabled;

COMMIT;

-- Verification: zero Slack columns should remain anywhere in public.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name ILIKE '%slack%'
ORDER BY table_name, column_name;
