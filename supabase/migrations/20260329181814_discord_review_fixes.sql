-- Fixes from code review:
-- 1. Unique constraint on daily_sales_logs for Discord (race condition prevention)
-- 2. ON DELETE SET NULL for discord_integration_id FK
-- 3. Missing indexes for Discord tables
-- 4. Fix discord_integration_id FK to use ON DELETE SET NULL (matching Slack pattern)

-- Drop the bare FK and recreate with ON DELETE SET NULL
ALTER TABLE daily_sales_logs
  DROP CONSTRAINT IF EXISTS daily_sales_logs_discord_integration_id_fkey;

ALTER TABLE daily_sales_logs
  ADD CONSTRAINT daily_sales_logs_discord_integration_id_fkey
  FOREIGN KEY (discord_integration_id) REFERENCES discord_integrations(id) ON DELETE SET NULL;

-- Unique constraint for Discord daily logs (prevents race condition duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_sales_logs_discord_unique
  ON daily_sales_logs (imo_id, discord_integration_id, channel_id, log_date)
  WHERE discord_integration_id IS NOT NULL;

-- Partial index for active Discord integrations (matches Slack pattern)
CREATE INDEX IF NOT EXISTS idx_discord_integrations_active
  ON discord_integrations(imo_id)
  WHERE is_active = true AND connection_status = 'connected';

-- Index for discord_messages by imo_id (RLS query pattern)
CREATE INDEX IF NOT EXISTS idx_discord_messages_imo
  ON discord_messages(imo_id);

-- Re-apply the fixed trigger function (with EXCEPTION handler, submitDate, policy agency_id)
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
    RAISE LOG 'Missing app_config for Slack/Discord notification';
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

  SELECT EXISTS (
    SELECT 1 FROM discord_integrations
    WHERE imo_id = v_imo_id AND is_active = TRUE AND connection_status = 'connected' AND policy_channel_id IS NOT NULL
  ) INTO v_has_discord_integration;

  IF v_has_slack_integration THEN
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/slack-policy-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_role_key),
      body := v_payload
    ) INTO v_request_id;
    RAISE LOG 'Slack notification queued for policy % (agency: %, request_id: %)', NEW.id, v_agency_id, v_request_id;
  END IF;

  IF v_has_discord_integration THEN
    SELECT net.http_post(
      url := v_supabase_url || '/functions/v1/discord-policy-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_role_key),
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

DROP TRIGGER IF EXISTS trigger_notify_slack_on_policy_insert ON policies;
CREATE TRIGGER trigger_notify_slack_on_policy_insert
  AFTER INSERT ON policies
  FOR EACH ROW
  EXECUTE FUNCTION notify_slack_on_policy_insert();

NOTIFY pgrst, 'reload schema';
