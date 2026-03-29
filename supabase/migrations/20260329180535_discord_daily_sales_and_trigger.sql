-- Add discord_integration_id to daily_sales_logs for first-sale tracking
ALTER TABLE daily_sales_logs
  ADD COLUMN IF NOT EXISTS discord_integration_id UUID REFERENCES discord_integrations(id);

CREATE INDEX IF NOT EXISTS idx_daily_sales_logs_discord
  ON daily_sales_logs(discord_integration_id, channel_id, log_date);

-- Update the Self Made Discord integration with policy_channel_id = daily-scoreboard
UPDATE discord_integrations
SET policy_channel_id = '1485356029934829671',
    policy_channel_name = 'daily-scoreboard'
WHERE guild_id = '1485352568585719808';

-- Create/replace the trigger function to also call Discord
-- Preserves: EXCEPTION handler, submitDate defense-in-depth, policy's agency_id
CREATE OR REPLACE FUNCTION notify_slack_on_policy_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_imo_id UUID;
  v_agency_id UUID;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
  v_has_slack_integration BOOLEAN := FALSE;
  v_has_discord_integration BOOLEAN := FALSE;
  v_today_date DATE;
  v_payload JSONB;
BEGIN
  -- Get IMO ID
  v_imo_id := NEW.imo_id;
  IF v_imo_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Use policy's agency_id (not user_profiles — agent may have moved agencies)
  v_agency_id := NEW.agency_id;

  -- Backdating defense: only notify for today's submissions (ET)
  v_today_date := (NOW() AT TIME ZONE 'America/New_York')::date;
  IF NEW.submit_date IS NOT NULL AND NEW.submit_date::date <> v_today_date THEN
    RAISE LOG 'Skipping notification for backdated policy % (submit_date: %, today: %)', NEW.id, NEW.submit_date, v_today_date;
    RETURN NEW;
  END IF;

  -- Get config
  SELECT value INTO v_supabase_url FROM app_config WHERE key = 'supabase_project_url';
  SELECT value INTO v_service_role_key FROM app_config WHERE key = 'supabase_service_role_key';

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE LOG 'Missing app_config for Slack/Discord notification';
    RETURN NEW;
  END IF;

  -- Build shared payload (includes submitDate for defense-in-depth)
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

  -- Check for active Slack integration with policy channel
  SELECT EXISTS (
    SELECT 1 FROM slack_integrations
    WHERE imo_id = v_imo_id
      AND is_active = TRUE
      AND connection_status = 'connected'
      AND policy_channel_id IS NOT NULL
  ) INTO v_has_slack_integration;

  -- Check for active Discord integration with policy channel
  SELECT EXISTS (
    SELECT 1 FROM discord_integrations
    WHERE imo_id = v_imo_id
      AND is_active = TRUE
      AND connection_status = 'connected'
      AND policy_channel_id IS NOT NULL
  ) INTO v_has_discord_integration;

  -- Call Slack function if Slack integration exists
  IF v_has_slack_integration THEN
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/slack-policy-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := v_payload
    ) INTO v_request_id;
    RAISE LOG 'Slack notification queued for policy % (agency: %, request_id: %)', NEW.id, v_agency_id, v_request_id;
  END IF;

  -- Call Discord function if Discord integration exists
  IF v_has_discord_integration THEN
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/discord-policy-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := v_payload
    ) INTO v_request_id;
    RAISE LOG 'Discord notification queued for policy % (agency: %, request_id: %)', NEW.id, v_agency_id, v_request_id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_slack_on_policy_insert failed for policy %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net;

-- Ensure trigger exists (drop and recreate to pick up new function)
DROP TRIGGER IF EXISTS trigger_notify_slack_on_policy_insert ON policies;
CREATE TRIGGER trigger_notify_slack_on_policy_insert
  AFTER INSERT ON policies
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_policy_insert();

NOTIFY pgrst, 'reload schema';
