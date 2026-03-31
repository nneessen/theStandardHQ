-- Fix Discord first-sale naming + add statement_timeouts to prevent DB lockup
--
-- Bug: check_first_seller_naming_unified only JOINs slack_integrations,
--       so Discord-only first sales never trigger the naming dialog.
-- Risk: get_slack_leaderboard_with_periods has no statement_timeout,
--        matching the exact pattern of the Feb 12 2026 DB lockup.

-- ============================================================================
-- 1. Fix check_first_seller_naming_unified to support Discord
-- ============================================================================
DROP FUNCTION IF EXISTS check_first_seller_naming_unified(UUID);

CREATE OR REPLACE FUNCTION check_first_seller_naming_unified(p_user_id UUID)
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
SET search_path = public
SET statement_timeout = '5s'
AS $$
BEGIN
  RETURN QUERY
  WITH pending_logs AS (
    -- Slack integration logs
    SELECT
      dsl.id as log_id,
      dsl.first_sale_group_id,
      dsl.log_date,
      dsl.title,
      dsl.pending_policy_data,
      si.agency_id,
      COALESCE(a.name, 'Self Made Financial')::TEXT as agency_name,
      si.policy_channel_name,
      dsl.hierarchy_depth,
      'slack'::TEXT as integration_type -- used for debugging/logging only
    FROM daily_sales_logs dsl
    JOIN slack_integrations si ON si.id = dsl.slack_integration_id
    LEFT JOIN agencies a ON a.id = si.agency_id
    WHERE dsl.first_seller_id = p_user_id
      AND dsl.log_date = CURRENT_DATE
      AND (dsl.title IS NULL OR dsl.pending_policy_data IS NOT NULL)

    UNION ALL

    -- Discord integration logs
    SELECT
      dsl.id as log_id,
      dsl.first_sale_group_id,
      dsl.log_date,
      dsl.title,
      dsl.pending_policy_data,
      di.agency_id,
      COALESCE(a.name, 'Self Made Financial')::TEXT as agency_name,
      di.policy_channel_name,
      dsl.hierarchy_depth,
      'discord'::TEXT as integration_type -- used for debugging/logging only
    FROM daily_sales_logs dsl
    JOIN discord_integrations di ON di.id = dsl.discord_integration_id
    LEFT JOIN agencies a ON a.id = di.agency_id
    WHERE dsl.first_seller_id = p_user_id
      AND dsl.log_date = CURRENT_DATE
      AND (dsl.title IS NULL OR dsl.pending_policy_data IS NOT NULL)
  ),
  grouped AS (
    SELECT
      COALESCE(pl.first_sale_group_id, pl.log_id) as effective_group_id,
      MIN(pl.log_id::text)::uuid as representative_log_id,
      (ARRAY_AGG(pl.agency_name ORDER BY pl.hierarchy_depth ASC))[1] as agency_name,
      MIN(pl.log_date) as log_date,
      BOOL_OR(pl.title IS NULL) as needs_naming,
      BOOL_OR(pl.pending_policy_data IS NOT NULL) as has_pending_notification,
      COUNT(*)::INT as total_channels,
      ARRAY_AGG(DISTINCT pl.policy_channel_name ORDER BY pl.policy_channel_name) as channel_names
    FROM pending_logs pl
    GROUP BY COALESCE(pl.first_sale_group_id, pl.log_id)
  )
  SELECT
    g.effective_group_id as first_sale_group_id,
    g.representative_log_id,
    g.agency_name,
    g.log_date,
    g.needs_naming,
    g.has_pending_notification,
    g.total_channels,
    g.channel_names
  FROM grouped g
  WHERE g.needs_naming = true OR g.has_pending_notification = true
  ORDER BY g.log_date DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION check_first_seller_naming_unified(UUID) IS
'Returns a single pending first sale group for the user with metadata about all channels.
Supports both Slack and Discord integrations via UNION.
Has 5s statement_timeout to prevent connection pool exhaustion.';

GRANT EXECUTE ON FUNCTION check_first_seller_naming_unified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_first_seller_naming_unified(UUID) TO service_role;

-- ============================================================================
-- 2. Add statement_timeout to get_slack_leaderboard_with_periods
--    Prevents the Feb 12 lockup pattern (expensive function, no timeout)
-- ============================================================================
ALTER FUNCTION get_slack_leaderboard_with_periods(UUID, UUID)
  SET statement_timeout = '5s';

-- ============================================================================
-- 3. Add statement_timeout to the trigger function (defense in depth)
--    If app_config or integration tables are locked, this prevents indefinite blocking
-- ============================================================================
ALTER FUNCTION notify_slack_on_policy_insert()
  SET statement_timeout = '3s';

NOTIFY pgrst, 'reload schema';
