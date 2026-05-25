-- Guard side-effecting trigger functions during book-of-business duplication.
--
-- Problem:
-- A normal INSERT path into policies / clients / commissions fires production
-- side effects:
-- - Slack policy notifications
-- - policy/client sync webhooks
-- - workflow_runs fanout
-- - override commission creation
--
-- For the FFG -> Epic backfill, those side effects must be suppressed without
-- disabling table triggers globally. The backfill will opt in per-transaction:
--
--   SELECT set_config('app.book_duplication_mode', 'on', true);
--
-- Functions updated here early-return only while that session flag is enabled.

CREATE OR REPLACE FUNCTION public.is_book_duplication_mode()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(current_setting('app.book_duplication_mode', true), '') = 'on';
$function$;

COMMENT ON FUNCTION public.is_book_duplication_mode() IS
  'Returns true only for transactions that explicitly opt into book duplication mode via set_config(app.book_duplication_mode, ''on'', true).';

CREATE OR REPLACE FUNCTION public.notify_slack_on_policy_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net'
SET statement_timeout TO '3s'
AS $function$
DECLARE
  v_imo_id uuid;
  v_agency_id uuid;
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
  v_has_slack_integration boolean := false;
  v_today_date date;
  v_payload jsonb;
BEGIN
  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping Slack notification for policy % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.notify_policy_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  webhook_url text := 'https://lopznswmsgkccydrsomy.supabase.co/functions/v1/sync-policy';
  webhook_secret text := '1ceabec33ce48a2b5a5a4535704e96a5de0720e83e9b4295b417e3fadfa455f2';
  payload jsonb;
  request_id bigint;
BEGIN
  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping policy sync webhook for policy % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', 'policies',
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE
      WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)
      ELSE NULL
    END
  );

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := payload
  ) INTO request_id;

  RAISE NOTICE 'Policy sync webhook sent: request_id=%, policy_id=%', request_id, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Policy sync webhook failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_client_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  webhook_url text := 'https://lopznswmsgkccydrsomy.supabase.co/functions/v1/sync-client';
  webhook_secret text := '1ceabec33ce48a2b5a5a4535704e96a5de0720e83e9b4295b417e3fadfa455f2';
  payload jsonb;
  request_id bigint;
BEGIN
  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping client sync webhook for client % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', 'clients',
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE
      WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)
      ELSE NULL
    END
  );

  SELECT net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := payload
  ) INTO request_id;

  RAISE NOTICE 'Client sync webhook sent: request_id=%, client_id=%', request_id, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Client sync webhook failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_policy_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping policy.created workflow fanout for policy % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM trigger_workflows_for_event(
    'policy.created',
    jsonb_build_object(
      'policyId', NEW.id,
      'policyNumber', NEW.policy_number,
      'clientId', NEW.client_id,
      'productType', NEW.product,
      'premium', NEW.annual_premium,
      'effectiveDate', NEW.effective_date,
      'userId', NEW.user_id,
      'recipientId', NEW.user_id,
      'targetTable', 'policies',
      'targetId', NEW.id
    )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_commission_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping commission.received workflow fanout for commission % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.status = 'received' AND (OLD.status IS NULL OR OLD.status != 'received') THEN
    PERFORM trigger_workflows_for_event(
      'commission.received',
      jsonb_build_object(
        'commissionId', NEW.id,
        'amount', NEW.amount,
        'policyId', NEW.policy_id,
        'userId', NEW.user_id,
        'recipientId', NEW.user_id,
        'receivedDate', NEW.received_date,
        'targetTable', 'commissions',
        'targetId', NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_override_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_upline_record RECORD;
  v_base_comp_level INTEGER;
  v_base_commission_rate DECIMAL(5,4);
  v_base_commission_amount DECIMAL(12,2);
  v_upline_commission_rate DECIMAL(5,4);
  v_upline_commission_amount DECIMAL(12,2);
  v_override_amount DECIMAL(12,2);
  v_floor_commission_amount DECIMAL(12,2);
  v_floor_comp_level INTEGER;
BEGIN
  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping override creation for policy % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_status != 'active' THEN
    RETURN NEW;
  END IF;

  SELECT contract_level
  INTO v_base_comp_level
  FROM user_profiles
  WHERE id = NEW.user_id;

  IF v_base_comp_level IS NULL THEN
    RAISE WARNING 'Policy % created by user % has no contract_level set in user_profiles - skipping override calculation',
      NEW.id, NEW.user_id;
    RETURN NEW;
  END IF;

  SELECT commission_percentage
  INTO v_base_commission_rate
  FROM comp_guide
  WHERE carrier_id = NEW.carrier_id
    AND (product_id = NEW.product_id OR product_type = NEW.product)
    AND contract_level = v_base_comp_level
    AND effective_date <= NEW.effective_date
    AND (expiration_date IS NULL OR expiration_date >= NEW.effective_date)
  ORDER BY effective_date DESC
  LIMIT 1;

  IF v_base_commission_rate IS NULL THEN
    RAISE WARNING 'No comp_guide entry found for carrier=%, product=%, level=% - skipping override calculation',
      NEW.carrier_id, NEW.product, v_base_comp_level;
    RETURN NEW;
  END IF;

  v_base_commission_amount := NEW.annual_premium * v_base_commission_rate;
  v_floor_commission_amount := v_base_commission_amount;
  v_floor_comp_level := v_base_comp_level;

  FOR v_upline_record IN (
    WITH RECURSIVE upline_chain AS (
      SELECT
        up.id as upline_id,
        up.contract_level as upline_comp_level,
        1 as depth
      FROM user_profiles up
      WHERE up.id = (
        SELECT upline_id FROM user_profiles WHERE id = NEW.user_id
      )
      AND up.id IS NOT NULL
      AND up.contract_level IS NOT NULL

      UNION

      SELECT
        up.id as upline_id,
        up.contract_level as upline_comp_level,
        uc.depth + 1
      FROM user_profiles up
      JOIN upline_chain uc ON up.id = (
        SELECT upline_id FROM user_profiles WHERE id = uc.upline_id
      )
      WHERE up.id IS NOT NULL
      AND up.contract_level IS NOT NULL
    )
    SELECT * FROM upline_chain
    ORDER BY depth ASC
  ) LOOP
    IF v_upline_record.upline_comp_level <= v_floor_comp_level THEN
      RAISE WARNING 'Upline % has contract_level=% <= floor_level=% - skipping override (no spread)',
        v_upline_record.upline_id, v_upline_record.upline_comp_level, v_floor_comp_level;
      CONTINUE;
    END IF;

    SELECT commission_percentage
    INTO v_upline_commission_rate
    FROM comp_guide
    WHERE carrier_id = NEW.carrier_id
      AND (product_id = NEW.product_id OR product_type = NEW.product)
      AND contract_level = v_upline_record.upline_comp_level
      AND effective_date <= NEW.effective_date
      AND (expiration_date IS NULL OR expiration_date >= NEW.effective_date)
    ORDER BY effective_date DESC
    LIMIT 1;

    IF v_upline_commission_rate IS NULL THEN
      RAISE WARNING 'No comp_guide entry found for upline % at level % - skipping override',
        v_upline_record.upline_id, v_upline_record.upline_comp_level;
      CONTINUE;
    END IF;

    v_upline_commission_amount := NEW.annual_premium * v_upline_commission_rate;
    v_override_amount := v_upline_commission_amount - v_floor_commission_amount;

    IF v_override_amount > 0 THEN
      INSERT INTO override_commissions (
        policy_id,
        base_agent_id,
        override_agent_id,
        hierarchy_depth,
        base_comp_level,
        override_comp_level,
        carrier_id,
        product_id,
        policy_premium,
        base_commission_amount,
        override_commission_amount,
        advance_months,
        months_paid,
        earned_amount,
        unearned_amount,
        status,
        created_at
      ) VALUES (
        NEW.id,
        NEW.user_id,
        v_upline_record.upline_id,
        v_upline_record.depth,
        v_base_comp_level,
        v_upline_record.upline_comp_level,
        NEW.carrier_id,
        NEW.product_id,
        NEW.annual_premium,
        v_base_commission_amount,
        v_override_amount,
        9,
        0,
        0,
        v_override_amount,
        'pending',
        NOW()
      )
      ON CONFLICT (policy_id, override_agent_id) DO NOTHING;

      v_floor_commission_amount := v_upline_commission_amount;
      v_floor_comp_level := v_upline_record.upline_comp_level;
    ELSE
      RAISE WARNING 'Override amount for upline % is <= 0 (%.2f) - skipping',
        v_upline_record.upline_id, v_override_amount;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

NOTIFY pgrst, 'reload schema';
