-- Remove Discord integration entirely, restore Slack as sole notification channel.
-- Discord was added March 2026 as parallel channel; now reverting to Slack-only.
-- Both slack_integrations and discord_integrations are empty in production,
-- so this is purely a schema/function cleanup.

-- ============================================================================
-- 1. Unschedule the Discord weekly IP leaderboard cron job (idempotent)
-- ============================================================================
DO $$
BEGIN
  PERFORM cron.unschedule('discord-weekly-ip-leaderboard');
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'discord-weekly-ip-leaderboard cron job not found (already removed)';
END;
$$;

-- ============================================================================
-- 2. Restore notify_slack_on_policy_insert() — Slack-only, no Discord
--    Keeps all hardening: EXCEPTION handler, submit_date defense, statement_timeout
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_slack_on_policy_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_imo_id UUID;
  v_agency_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
  v_has_slack_integration BOOLEAN := FALSE;
  v_today_date DATE;
  v_payload JSONB;
BEGIN
  v_imo_id := NEW.imo_id;
  IF v_imo_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_agency_id := NEW.agency_id;

  v_today_date := (NOW() AT TIME ZONE 'America/New_York')::date;
  IF NEW.submit_date IS NOT NULL AND NEW.submit_date::date <> v_today_date THEN
    RAISE LOG 'Skipping notification for backdated policy % (submit_date: %, today: %)', NEW.id, NEW.submit_date, v_today_date;
    RETURN NEW;
  END IF;

  SELECT value INTO v_supabase_url FROM app_config WHERE key = 'supabase_project_url';
  SELECT value INTO v_service_role_key FROM app_config WHERE key = 'supabase_service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE LOG 'Missing app_config for Slack notification';
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'policyId', NEW.id::text,
    'policyNumber', COALESCE(NEW.policy_number, ''),
    'carrierId', NEW.carrier_id::text,
    'productId', NEW.product_id::text,
    'agentId', NEW.user_id::text,
    'annualPremium', COALESCE(NEW.annual_premium, 0),
    'effectiveDate', COALESCE(NEW.effective_date::text, ''),
    'submitDate', COALESCE(NEW.submit_date::text, ''),
    'status', COALESCE(NEW.status, ''),
    'imoId', v_imo_id::text,
    'agencyId', v_agency_id::text
  );

  SELECT EXISTS (
    SELECT 1 FROM slack_integrations
    WHERE imo_id = v_imo_id AND is_active = TRUE AND connection_status = 'connected' AND policy_channel_id IS NOT NULL
  ) INTO v_has_slack_integration;

  IF v_has_slack_integration THEN
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/slack-policy-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_role_key),
      body := v_payload
    ) INTO v_request_id;
    RAISE LOG 'Slack notification queued for policy % (agency: %, request_id: %)', NEW.id, v_agency_id, v_request_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_slack_on_policy_insert failed for policy %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net
SET statement_timeout = '3s';

DROP TRIGGER IF EXISTS trigger_notify_slack_on_policy_insert ON policies;
CREATE TRIGGER trigger_notify_slack_on_policy_insert
  AFTER INSERT ON policies
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_policy_insert();

-- ============================================================================
-- 3. Restore check_first_seller_naming_unified() — Slack-only
--    Keeps: statement_timeout, leaderboard_message_ts guard, grouped structure
-- ============================================================================
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
      si.agency_id,
      COALESCE(a.name, 'Self Made Financial')::TEXT as the_agency_name,
      si.policy_channel_name,
      dsl.hierarchy_depth
    FROM daily_sales_logs dsl
    JOIN slack_integrations si ON si.id = dsl.slack_integration_id
    LEFT JOIN agencies a ON a.id = si.agency_id
    WHERE dsl.first_seller_id = p_user_id
      AND dsl.log_date = CURRENT_DATE
      AND (dsl.title IS NULL OR dsl.pending_policy_data IS NOT NULL)
      AND dsl.slack_integration_id IS NOT NULL
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

GRANT EXECUTE ON FUNCTION check_first_seller_naming_unified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_first_seller_naming_unified(UUID) TO service_role;

-- ============================================================================
-- 4. Restore get_my_daily_sales_logs() — remove discord_integration_id
--    Must DROP first because return type is changing (removing OUT parameter)
-- ============================================================================
DROP FUNCTION IF EXISTS get_my_daily_sales_logs();
CREATE FUNCTION get_my_daily_sales_logs()
RETURNS TABLE(
  id UUID,
  imo_id UUID,
  slack_integration_id UUID,
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

-- ============================================================================
-- 5. Drop Discord indexes
-- ============================================================================
DROP INDEX IF EXISTS idx_daily_sales_logs_discord;
DROP INDEX IF EXISTS idx_daily_sales_logs_discord_unique;
DROP INDEX IF EXISTS idx_discord_integrations_active;
DROP INDEX IF EXISTS idx_discord_messages_imo;
DROP INDEX IF EXISTS idx_discord_integrations_guild_agency;
DROP INDEX IF EXISTS idx_discord_messages_integration;
DROP INDEX IF EXISTS idx_discord_messages_type;

-- ============================================================================
-- 6. Drop discord_integration_id column from daily_sales_logs
-- ============================================================================
ALTER TABLE daily_sales_logs DROP CONSTRAINT IF EXISTS daily_sales_logs_discord_integration_id_fkey;
ALTER TABLE daily_sales_logs DROP COLUMN IF EXISTS discord_integration_id;

-- ============================================================================
-- 7. Drop Discord tables (order matters: discord_messages FK → discord_integrations)
-- ============================================================================
DROP TABLE IF EXISTS discord_messages CASCADE;
DROP TABLE IF EXISTS discord_integrations CASCADE;

-- ============================================================================
-- 8. Reload PostgREST schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';
