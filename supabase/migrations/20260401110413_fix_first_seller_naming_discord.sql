-- Fix check_first_seller_naming_unified to support Discord integrations
-- Bug: RPC only JOINed on slack_integrations, but Discord logs use discord_integration_id.
-- This caused the naming dialog to never appear for Discord-only channels.
-- Also: skip dialog if leaderboard was already posted (manual trigger scenario).

CREATE OR REPLACE FUNCTION check_first_seller_naming_unified(
  p_user_id UUID
)
RETURNS TABLE (
  first_sale_group_id UUID,
  representative_log_id UUID,
  agency_name TEXT,
  log_date DATE,
  needs_naming BOOLEAN,
  has_pending_notification BOOLEAN,
  total_channels INT,
  channel_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '5s'
AS $$
BEGIN
  RETURN QUERY
  WITH pending_logs AS (
    SELECT
      dsl.id as log_id,
      dsl.first_sale_group_id,
      dsl.log_date,
      dsl.title,
      dsl.pending_policy_data,
      COALESCE(si.agency_id, di.agency_id) as agency_id,
      COALESCE(
        a_slack.name,
        a_discord.name,
        'Self Made Financial'
      )::TEXT as the_agency_name,
      COALESCE(si.policy_channel_name, di.leaderboard_channel_name, 'daily-scoreboard')::TEXT as policy_channel_name,
      dsl.hierarchy_depth
    FROM daily_sales_logs dsl
    LEFT JOIN slack_integrations si ON si.id = dsl.slack_integration_id
    LEFT JOIN discord_integrations di ON di.id = dsl.discord_integration_id
    LEFT JOIN agencies a_slack ON a_slack.id = si.agency_id
    LEFT JOIN agencies a_discord ON a_discord.id = di.agency_id
    WHERE dsl.first_seller_id = p_user_id
      AND dsl.log_date = CURRENT_DATE
      AND (dsl.title IS NULL OR dsl.pending_policy_data IS NOT NULL)
      AND (dsl.slack_integration_id IS NOT NULL OR dsl.discord_integration_id IS NOT NULL)
      -- If leaderboard was already posted, notification is done — don't show dialog
      AND dsl.leaderboard_message_ts IS NULL
  ),
  grouped AS (
    SELECT
      COALESCE(pl.first_sale_group_id, pl.log_id) as effective_group_id,
      MIN(pl.log_id::text)::uuid as representative_log_id,
      (ARRAY_AGG(pl.the_agency_name ORDER BY pl.hierarchy_depth ASC))[1] as the_agency_name,
      MIN(pl.log_date) as the_log_date,
      BOOL_OR(pl.title IS NULL) as the_needs_naming,
      BOOL_OR(pl.pending_policy_data IS NOT NULL) as the_has_pending,
      COUNT(*)::INT as the_total_channels,
      ARRAY_AGG(DISTINCT pl.policy_channel_name ORDER BY pl.policy_channel_name) as the_channel_names
    FROM pending_logs pl
    GROUP BY COALESCE(pl.first_sale_group_id, pl.log_id)
  )
  SELECT
    g.effective_group_id,
    g.representative_log_id,
    g.the_agency_name,
    g.the_log_date,
    g.the_needs_naming,
    g.the_has_pending,
    g.the_total_channels,
    g.the_channel_names
  FROM grouped g
  WHERE g.the_needs_naming = true OR g.the_has_pending = true
  ORDER BY g.the_log_date DESC
  LIMIT 1;
END;
$$;
