-- Epic Life must never post policy or leaderboard content to Slack.
--
-- This is stricter than the book-duplication session guard. Epic is treated as
-- a Slack-dark tenant at the database layer for Slack-specific trigger / RPC
-- paths even outside duplication mode.

CREATE OR REPLACE FUNCTION public.is_epic_life_imo(p_imo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT p_imo_id = '89514211-f2bd-4440-9527-90a472c5e622'::uuid;
$function$;

COMMENT ON FUNCTION public.is_epic_life_imo(uuid) IS
  'Returns true only for the Epic Life IMO, which is intentionally Slack-dark: no policy posts, no Slack leaderboard posts.';

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
  v_imo_id := NEW.imo_id;

  IF public.is_book_duplication_mode() THEN
    RAISE LOG 'Skipping Slack notification for policy % during book duplication mode', NEW.id;
    RETURN NEW;
  END IF;

  IF public.is_epic_life_imo(v_imo_id) THEN
    RAISE LOG 'Skipping Slack notification for Epic Life policy %', NEW.id;
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.get_slack_leaderboard_with_periods(
  p_imo_id uuid,
  p_agency_id uuid DEFAULT NULL
)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  agent_email text,
  slack_member_id text,
  today_ap numeric,
  today_policies integer,
  wtd_ap numeric,
  wtd_policies integer,
  mtd_ap numeric,
  mtd_policies integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '5s'
AS $function$
DECLARE
  v_today date;
  v_week_start date;
  v_month_start date;
BEGIN
  IF public.is_epic_life_imo(p_imo_id) THEN
    RETURN;
  END IF;

  v_today := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  v_week_start := date_trunc('week', v_today)::DATE;
  v_month_start := date_trunc('month', v_today)::DATE;

  RETURN QUERY
  WITH
  today_sales AS (
    SELECT
      p.user_id,
      COALESCE(SUM(p.annual_premium), 0) AS today_ap,
      COUNT(p.id) AS today_policies
    FROM policies p
    WHERE p.imo_id = p_imo_id
      AND p.submit_date = v_today
      AND (p_agency_id IS NULL OR p.agency_id IN (
        SELECT d.agency_id FROM get_agency_descendants(p_agency_id) d
      ))
    GROUP BY p.user_id
    HAVING COALESCE(SUM(p.annual_premium), 0) > 0
  ),
  wtd_sales AS (
    SELECT
      p.user_id,
      COALESCE(SUM(p.annual_premium), 0) AS wtd_ap,
      COUNT(p.id) AS wtd_policies
    FROM policies p
    WHERE p.imo_id = p_imo_id
      AND p.submit_date >= v_week_start
      AND p.submit_date <= v_today
      AND (p_agency_id IS NULL OR p.agency_id IN (
        SELECT d.agency_id FROM get_agency_descendants(p_agency_id) d
      ))
      AND p.user_id IN (SELECT user_id FROM today_sales)
    GROUP BY p.user_id
  ),
  mtd_sales AS (
    SELECT
      p.user_id,
      COALESCE(SUM(p.annual_premium), 0) AS mtd_ap,
      COUNT(p.id) AS mtd_policies
    FROM policies p
    WHERE p.imo_id = p_imo_id
      AND p.submit_date >= v_month_start
      AND p.submit_date <= v_today
      AND (p_agency_id IS NULL OR p.agency_id IN (
        SELECT d.agency_id FROM get_agency_descendants(p_agency_id) d
      ))
      AND p.user_id IN (SELECT user_id FROM today_sales)
    GROUP BY p.user_id
  )
  SELECT
    ts.user_id AS agent_id,
    COALESCE(
      NULLIF(TRIM(COALESCE(up.first_name, '') || ' ' || COALESCE(up.last_name, '')), ''),
      up.email,
      'Unknown'
    ) AS agent_name,
    up.email AS agent_email,
    usp.slack_member_id,
    ts.today_ap::numeric AS today_ap,
    ts.today_policies::integer AS today_policies,
    COALESCE(ws.wtd_ap, ts.today_ap)::numeric AS wtd_ap,
    COALESCE(ws.wtd_policies, ts.today_policies)::integer AS wtd_policies,
    COALESCE(ms.mtd_ap, ts.today_ap)::numeric AS mtd_ap,
    COALESCE(ms.mtd_policies, ts.today_policies)::integer AS mtd_policies
  FROM today_sales ts
  JOIN user_profiles up ON ts.user_id = up.id
  LEFT JOIN user_slack_preferences usp ON usp.user_id = up.id AND usp.imo_id = p_imo_id
  LEFT JOIN wtd_sales ws ON ws.user_id = ts.user_id
  LEFT JOIN mtd_sales ms ON ms.user_id = ts.user_id
  ORDER BY ts.today_ap DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_imo_submit_totals(p_imo_id uuid)
RETURNS TABLE (
  wtd_ap numeric,
  wtd_policies integer,
  mtd_ap numeric,
  mtd_policies integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today date;
  v_week_start date;
  v_month_start date;
BEGIN
  IF public.is_epic_life_imo(p_imo_id) THEN
    RETURN QUERY
    SELECT 0::numeric, 0::integer, 0::numeric, 0::integer;
    RETURN;
  END IF;

  v_today := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  v_week_start := date_trunc('week', v_today)::DATE;
  v_month_start := date_trunc('month', v_today)::DATE;

  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN p.submit_date >= v_week_start THEN p.annual_premium ELSE 0 END), 0)::NUMERIC,
    COUNT(DISTINCT CASE WHEN p.submit_date >= v_week_start THEN p.id END)::INTEGER,
    COALESCE(SUM(p.annual_premium), 0)::NUMERIC,
    COUNT(DISTINCT p.id)::INTEGER
  FROM policies p
  WHERE p.imo_id = p_imo_id
    AND p.submit_date IS NOT NULL
    AND p.submit_date >= v_month_start
    AND p.submit_date <= v_today;
END;
$function$;

NOTIFY pgrst, 'reload schema';
