-- Add visibility into Slack post failures on daily_sales_logs.
--
-- Context: on 2026-04-11 a not_in_channel Slack delivery failure left
-- Self Made Financial's daily log in a silent dead state — pending_policy_data
-- had been cleared (dialog dismissal logic) but leaderboard_message_ts was
-- never set, and no error was surfaced anywhere. Operators had to diagnose
-- by reading pg_net._http_response content blobs.
--
-- This migration adds a dedicated error column so ops can query
--   SELECT id FROM daily_sales_logs WHERE last_post_error IS NOT NULL
-- to see which logs failed, with the raw Slack error code captured.
--
-- The companion fix in slack-policy-notification/index.ts now self-heals
-- not_in_channel via conversations.join + retry, so this column primarily
-- surfaces the non-recoverable failures (token_revoked, invalid_auth,
-- is_archived, channel_not_found, etc.).

ALTER TABLE daily_sales_logs
  ADD COLUMN IF NOT EXISTS last_post_error TEXT,
  ADD COLUMN IF NOT EXISTS last_post_attempted_at TIMESTAMPTZ;

COMMENT ON COLUMN daily_sales_logs.last_post_error IS
  'Last Slack post error (null = ok). Populated by slack-policy-notification when chat.postMessage fails.';

COMMENT ON COLUMN daily_sales_logs.last_post_attempted_at IS
  'Timestamp of the most recent Slack post attempt for this log, regardless of success.';

-- Partial index for operators monitoring failed posts
CREATE INDEX IF NOT EXISTS idx_daily_sales_logs_post_error
  ON daily_sales_logs (last_post_attempted_at DESC)
  WHERE last_post_error IS NOT NULL;

NOTIFY pgrst, 'reload schema';
