-- Add recruit_channel_id and recruit_channel_name to slack_integrations.
--
-- Mirrors the existing leaderboard_channel_* and policy_channel_* pattern so
-- each IMO can pick a Slack channel for recruit notifications, instead of the
-- previous hard-coded `#new-agent-testing-odette` lookup that only worked for
-- the Self Made workspace.

ALTER TABLE public.slack_integrations
  ADD COLUMN IF NOT EXISTS recruit_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS recruit_channel_name TEXT;

COMMENT ON COLUMN public.slack_integrations.recruit_channel_id IS
  'Slack channel id where recruit notifications (new recruit, NPN received) are posted.';

COMMENT ON COLUMN public.slack_integrations.recruit_channel_name IS
  'Slack channel name (denormalized) for the recruit notifications channel.';

-- Tell PostgREST to reload its schema cache so the new columns are queryable.
NOTIFY pgrst, 'reload schema';
