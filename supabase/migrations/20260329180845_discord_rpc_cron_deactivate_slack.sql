-- 1. Update get_my_daily_sales_logs to include discord_integration_id
CREATE OR REPLACE FUNCTION get_my_daily_sales_logs()
RETURNS TABLE(
  id UUID,
  imo_id UUID,
  slack_integration_id UUID,
  discord_integration_id UUID,
  channel_id TEXT,
  log_date DATE,
  title TEXT,
  first_seller_id UUID,
  is_first_seller BOOLEAN,
  can_rename BOOLEAN,
  leaderboard_message_ts TEXT,
  title_set_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dsl.id,
    dsl.imo_id,
    dsl.slack_integration_id,
    dsl.discord_integration_id,
    dsl.channel_id,
    dsl.log_date,
    dsl.title,
    dsl.first_seller_id,
    (dsl.first_seller_id = auth.uid()) as is_first_seller,
    (dsl.first_seller_id = auth.uid() AND dsl.log_date = CURRENT_DATE AND dsl.title_set_at IS NULL) as can_rename,
    dsl.leaderboard_message_ts,
    dsl.title_set_at,
    dsl.created_at,
    dsl.updated_at
  FROM daily_sales_logs dsl
  WHERE dsl.imo_id IN (
    SELECT up.imo_id FROM user_profiles up WHERE up.id = auth.uid()
  )
  AND dsl.log_date = CURRENT_DATE;
END;
$$;

-- 2. Set up cron for weekly Discord IP leaderboard — Sundays at 10am ET (15:00 UTC in EDT, 14:00 UTC when EDT)
-- Note: 10am ET = 14:00 UTC (EDT) or 15:00 UTC (EST). Using 14:00 for spring/summer (EDT).
-- pg_cron does not support timezone, so we use UTC equivalent.
SELECT cron.schedule(
  'discord-weekly-ip-leaderboard',
  '0 14 * * 0',  -- Every Sunday at 14:00 UTC = 10:00 AM EDT
  $$
  SELECT net.http_post(
    url := (SELECT value FROM app_config WHERE key = 'supabase_project_url') || '/functions/v1/discord-ip-leaderboard',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM app_config WHERE key = 'supabase_service_role_key')
    ),
    body := jsonb_build_object(
      'imoId', 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    )
  );
  $$
);

-- 3. Deactivate Self Made Slack integration (broken encryption, replaced by Discord)
UPDATE slack_integrations
SET is_active = FALSE,
    last_error = 'Replaced by Discord integration (2026-03-29)',
    updated_at = NOW()
WHERE team_name ILIKE '%self made%'
  AND imo_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

NOTIFY pgrst, 'reload schema';
