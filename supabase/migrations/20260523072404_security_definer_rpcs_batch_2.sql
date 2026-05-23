-- =============================================================================
-- SECURITY DEFINER RPCs honor acting_imo_id — Batch 2 (READ-side stats)
-- =============================================================================
--
-- Continues the work of 20260523071259. Six more SECURITY DEFINER read RPCs
-- bypass RLS and need explicit imo scoping for super-admin acting:
--
--   get_agency_premium_stats        — derives v_imo_id from user_profiles
--                                     (always real imo); replace with effective
--   get_clients_with_stats          — no imo filter at all; gate via owner imo
--   get_module_progress_summary     — no imo filter on training_progress join
--   get_agent_daily_stats           — caller passes p_imo_id; override w/ effective
--   get_templates_for_platform      — same parameter pattern
--   validate_schedule_recipients    — same parameter pattern
--
-- All use the same idiom: `v_scope_imo := COALESCE(get_effective_imo_id(), <orig>)`
-- - super-admin acting → effective = acting imo → scopes to that
-- - super-admin not acting → effective = NULL → falls back to original behavior
-- - non-super-admin → effective = their real imo → same as before
-- =============================================================================

-- ----------------------------------------------------------------------------
-- get_agency_premium_stats
-- Only the v_imo_id derivation needs to change; the rest of the body stays.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_premium_stats(p_user_id uuid)
RETURNS TABLE(
  source text,
  mean_premium numeric,
  median_premium numeric,
  policy_count integer,
  personal_source text,
  personal_mean_premium numeric,
  personal_median_premium numeric,
  personal_policy_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
    v_imo_id uuid;
    v_year_start date := date_trunc('year', CURRENT_DATE);
    v_agency_premiums numeric[];
    v_personal_premiums numeric[];
    v_agency_source text;
    v_personal_source text;
BEGIN
    -- Auth gate: caller must be self or admin
    IF p_user_id != auth.uid() AND NOT is_super_admin() AND NOT is_imo_admin() THEN
        RAISE EXCEPTION 'Unauthorized: cannot read other users premium stats';
    END IF;

    -- Honor super-admin acting_imo_id, else fall back to user's real imo
    v_imo_id := COALESCE(
      public.get_effective_imo_id(),
      (SELECT imo_id FROM user_profiles WHERE id = p_user_id)
    );

    IF v_imo_id IS NULL THEN
        RETURN QUERY SELECT
            'no-data'::text, 0::numeric, 0::numeric, 0::integer,
            'no-data'::text, 0::numeric, 0::numeric, 0::integer;
        RETURN;
    END IF;

    -- Agency cohort: current year first, fall back through active → all
    SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
    INTO v_agency_premiums
    FROM policies p
    INNER JOIN user_profiles up ON up.id = p.user_id
    WHERE up.imo_id = v_imo_id
      AND p.annual_premium > 0
      AND p.effective_date >= v_year_start;
    v_agency_source := 'current-year';

    IF v_agency_premiums IS NULL OR array_length(v_agency_premiums, 1) = 0 THEN
        SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
        INTO v_agency_premiums
        FROM policies p
        INNER JOIN user_profiles up ON up.id = p.user_id
        WHERE up.imo_id = v_imo_id
          AND p.annual_premium > 0
          AND p.status = 'active';
        v_agency_source := 'active-policies-fallback';
    END IF;

    IF v_agency_premiums IS NULL OR array_length(v_agency_premiums, 1) = 0 THEN
        SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
        INTO v_agency_premiums
        FROM policies p
        INNER JOIN user_profiles up ON up.id = p.user_id
        WHERE up.imo_id = v_imo_id
          AND p.annual_premium > 0;
        v_agency_source := 'all-policies-fallback';
    END IF;

    IF v_agency_premiums IS NULL OR array_length(v_agency_premiums, 1) = 0 THEN
        v_agency_source := 'no-data';
        v_agency_premiums := ARRAY[]::numeric[];
    END IF;

    -- Personal cohort: caller's own policies, also gated by effective imo
    SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
    INTO v_personal_premiums
    FROM policies p
    WHERE p.user_id = p_user_id
      AND p.annual_premium > 0
      AND p.effective_date >= v_year_start
      AND (public.get_effective_imo_id() IS NULL OR p.imo_id = public.get_effective_imo_id());
    v_personal_source := 'current-year';

    IF v_personal_premiums IS NULL OR array_length(v_personal_premiums, 1) = 0 THEN
        SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
        INTO v_personal_premiums
        FROM policies p
        WHERE p.user_id = p_user_id
          AND p.annual_premium > 0
          AND p.status = 'active'
          AND (public.get_effective_imo_id() IS NULL OR p.imo_id = public.get_effective_imo_id());
        v_personal_source := 'active-policies-fallback';
    END IF;

    IF v_personal_premiums IS NULL OR array_length(v_personal_premiums, 1) = 0 THEN
        SELECT array_agg(p.annual_premium ORDER BY p.annual_premium)
        INTO v_personal_premiums
        FROM policies p
        WHERE p.user_id = p_user_id
          AND p.annual_premium > 0
          AND (public.get_effective_imo_id() IS NULL OR p.imo_id = public.get_effective_imo_id());
        v_personal_source := 'all-policies-fallback';
    END IF;

    IF v_personal_premiums IS NULL OR array_length(v_personal_premiums, 1) = 0 THEN
        v_personal_source := 'no-data';
        v_personal_premiums := ARRAY[]::numeric[];
    END IF;

    RETURN QUERY
    SELECT
        v_agency_source,
        COALESCE((SELECT AVG(p) FROM unnest(v_agency_premiums) AS p), 0)::numeric AS mean_premium,
        COALESCE((SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY p) FROM unnest(v_agency_premiums) AS p), 0)::numeric AS median_premium,
        COALESCE(array_length(v_agency_premiums, 1), 0)::integer AS policy_count,
        v_personal_source,
        COALESCE((SELECT AVG(p) FROM unnest(v_personal_premiums) AS p), 0)::numeric AS personal_mean_premium,
        COALESCE((SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY p) FROM unnest(v_personal_premiums) AS p), 0)::numeric AS personal_median_premium,
        COALESCE(array_length(v_personal_premiums, 1), 0)::integer AS personal_policy_count;
END;
$function$;

-- ----------------------------------------------------------------------------
-- get_clients_with_stats
-- Clients are user-owned. When acting, hide rows whose owner's imo doesn't
-- match effective. Also gate the joined policies aggregation.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_clients_with_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_clients_with_stats(p_user_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  name text,
  email text,
  phone text,
  address text,
  date_of_birth date,
  notes text,
  status character varying,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  policy_count bigint,
  active_policy_count bigint,
  total_premium numeric,
  avg_premium numeric,
  last_policy_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_effective_imo uuid;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  v_effective_imo := public.get_effective_imo_id();

  RETURN QUERY
  SELECT
    c.id,
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.address,
    c.date_of_birth,
    c.notes,
    c.status,
    c.created_at,
    c.updated_at,
    COUNT(p.id) AS policy_count,
    COUNT(CASE WHEN p.lifecycle_status = 'active' THEN 1 END) AS active_policy_count,
    COALESCE(SUM(p.annual_premium), 0) AS total_premium,
    COALESCE(AVG(p.annual_premium), 0) AS avg_premium,
    MAX(p.effective_date) AS last_policy_date
  FROM clients c
  LEFT JOIN policies p
    ON p.client_id = c.id
    AND (v_effective_imo IS NULL OR p.imo_id = v_effective_imo)
  WHERE c.user_id = v_user_id
    -- Hide clients whose owner is in a different IMO than the effective one
    AND (
      v_effective_imo IS NULL
      OR EXISTS (
        SELECT 1 FROM user_profiles up
         WHERE up.id = c.user_id AND up.imo_id = v_effective_imo
      )
    )
  GROUP BY c.id, c.user_id, c.name, c.email, c.phone, c.address,
           c.date_of_birth, c.notes, c.status, c.created_at, c.updated_at
  ORDER BY c.name;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_clients_with_stats(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- get_module_progress_summary
-- training_progress is imo-scoped; lessons aren't directly, but gate via the
-- progress join so a user acting on another IMO sees no progress.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_module_progress_summary(
  p_module_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_effective_imo uuid;
BEGIN
  v_effective_imo := public.get_effective_imo_id();

  RETURN QUERY
  SELECT json_build_object(
    'lesson_id', l.id,
    'lesson_title', l.title,
    'lesson_type', l.lesson_type,
    'sort_order', l.sort_order,
    'is_required', l.is_required,
    'status', COALESCE(p.status, 'not_started'),
    'completed_at', p.completed_at,
    'time_spent_seconds', COALESCE(p.time_spent_seconds, 0)
  )
  FROM training_lessons l
  LEFT JOIN training_progress p
    ON p.lesson_id = l.id
    AND p.user_id = p_user_id
    AND (v_effective_imo IS NULL OR p.imo_id = v_effective_imo)
  WHERE l.module_id = p_module_id
    -- Also gate the lessons themselves so other-imo modules' lessons don't show
    AND (v_effective_imo IS NULL OR l.imo_id = v_effective_imo)
  ORDER BY l.sort_order;
END;
$function$;

-- ----------------------------------------------------------------------------
-- get_agent_daily_stats — override p_imo_id with effective when acting
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agent_daily_stats(
  p_user_id uuid,
  p_imo_id uuid,
  p_target_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(policy_count integer, total_ap numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_scope_imo uuid;
BEGIN
  v_scope_imo := COALESCE(public.get_effective_imo_id(), p_imo_id);

  RETURN QUERY
  SELECT
    COUNT(p.id)::int AS policy_count,
    COALESCE(SUM(p.annual_premium), 0)::numeric AS total_ap
  FROM policies p
  WHERE p.user_id = p_user_id
    AND p.imo_id = v_scope_imo
    AND COALESCE(p.submit_date, (p.created_at AT TIME ZONE 'America/New_York')::date) = p_target_date
    AND p.status IN ('active', 'pending', 'approved');
END;
$function$;

-- ----------------------------------------------------------------------------
-- get_templates_for_platform — override p_imo_id with effective when acting
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_templates_for_platform(
  p_imo_id uuid,
  p_user_id uuid,
  p_platform text
)
RETURNS SETOF instagram_message_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_scope_imo uuid;
BEGIN
  v_scope_imo := COALESCE(public.get_effective_imo_id(), p_imo_id);

  RETURN QUERY
  SELECT *
  FROM instagram_message_templates
  WHERE imo_id = v_scope_imo
    AND is_active = true
    AND (platform = p_platform OR platform = 'all')
    AND (user_id IS NULL OR user_id = p_user_id)
  ORDER BY
    user_id IS NULL,
    category,
    name;
END;
$function$;

-- ----------------------------------------------------------------------------
-- validate_schedule_recipients — override imo/agency with effective when acting
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_schedule_recipients(
  p_recipients jsonb,
  p_imo_id uuid,
  p_agency_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_recipient jsonb;
  v_user_id uuid;
  v_valid boolean;
  v_scope_imo uuid;
BEGIN
  v_scope_imo := COALESCE(public.get_effective_imo_id(), p_imo_id);

  FOR v_recipient IN SELECT jsonb_array_elements(p_recipients) LOOP
    v_user_id := (v_recipient->>'user_id')::uuid;

    IF v_user_id IS NULL THEN
      RETURN FALSE;
    END IF;

    IF p_agency_id IS NOT NULL AND public.get_effective_imo_id() IS NULL THEN
      -- Agency scope honored only when not acting (no override). When acting,
      -- imo-scope check is more important — agency-scope check might prevent
      -- legitimate visibility of recipients in the acting IMO.
      SELECT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = v_user_id AND agency_id = p_agency_id
      ) INTO v_valid;
    ELSIF v_scope_imo IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = v_user_id AND imo_id = v_scope_imo
      ) INTO v_valid;
    ELSE
      v_valid := FALSE;
    END IF;

    IF NOT v_valid THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$function$;
