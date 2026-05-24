-- super_admin_acting_scope_part3.sql
-- ============================================================================
-- Closes remaining IMO-isolation leaks in SECURITY DEFINER RPCs.
--
-- Background
-- ----------
-- The prior 14-migration tenant-isolation effort (commits 3648fb7f / b61e18e4)
-- rewrote 107 RLS policies and 16 RPC functions, but missed a class of
-- SECURITY DEFINER functions that read user_profiles (and adjacent tables)
-- without honoring get_effective_imo_id(). The user-visible symptom was the
-- Add Recruit dialog's "Upline" combobox still showing FFG users when a
-- super-admin acted as Epic Life — because UserSearchCombobox calls
-- search_users_for_assignment, which is SECURITY DEFINER and bypasses RLS.
--
-- Audit categories
-- ----------------
--   Tier 1 (direct list leaks, no IMO scoping at all):
--     search_users_for_assignment, admin_get_allusers,
--     admin_get_pending_users, admin_get_user_profile,
--     lookup_user_by_email, get_eligible_recipients
--
--   Tier 2 (acting-IMO leak via auth.uid() assumption):
--     get_imo_override_summary, get_overrides_by_agency,
--     get_overrides_by_agent, get_teammates_with_close_connected,
--     get_team_pipeline_snapshot, get_team_uw_wizard_seat_usage,
--     get_ip_leaderboard_with_periods, get_agencies_ip_totals
--
-- Strategy
-- --------
-- New helper row_in_acting_scope(uuid) returns true iff the calling user is
-- allowed to see a row stamped with that imo_id. Tier 1 adds it as a WHERE
-- clause. Tier 2 either swaps the auth.uid()-derived v_imo_id for
-- COALESCE(get_effective_imo_id(), home_imo) or scopes the super-admin branch
-- to row_in_acting_scope.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. Helper
-- ============================================================================
CREATE OR REPLACE FUNCTION public.row_in_acting_scope(row_imo_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT
    (NOT public.is_super_admin() AND row_imo_id = public.get_my_imo_id())
    OR (public.is_super_admin() AND public.get_effective_imo_id() IS NULL)
    OR (public.is_super_admin() AND row_imo_id = public.get_effective_imo_id());
$$;

COMMENT ON FUNCTION public.row_in_acting_scope(uuid) IS
  'True iff caller can see a row with the given imo_id, respecting super-admin acting_imo_id override.';

-- ============================================================================
-- TIER 1: Direct list leaks
-- ============================================================================

-- 1.1 search_users_for_assignment (upline selector in Add Recruit / many other dialogs)
CREATE OR REPLACE FUNCTION public.search_users_for_assignment(
  p_search_term text DEFAULT ''::text,
  p_roles text[] DEFAULT NULL::text[],
  p_approval_status text DEFAULT 'approved'::text,
  p_exclude_ids uuid[] DEFAULT NULL::uuid[],
  p_limit integer DEFAULT 15
)
RETURNS TABLE(id uuid, first_name text, last_name text, email text, roles text[], agent_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    up.id,
    up.first_name,
    up.last_name,
    up.email,
    up.roles::TEXT[],
    up.agent_status::TEXT
  FROM user_profiles up
  WHERE (p_approval_status IS NULL OR up.approval_status = p_approval_status)
    AND (p_roles IS NULL OR up.roles && p_roles)
    AND (p_exclude_ids IS NULL OR up.id != ALL(p_exclude_ids))
    AND (
      p_search_term = ''
      OR up.email ILIKE '%' || p_search_term || '%'
      OR (COALESCE(up.first_name, '') || ' ' || COALESCE(up.last_name, '')) ILIKE '%' || p_search_term || '%'
    )
    AND row_in_acting_scope(up.imo_id)
  ORDER BY
    CASE WHEN p_search_term != '' AND up.email ILIKE p_search_term || '%' THEN 0 ELSE 1 END,
    up.first_name NULLS LAST,
    up.last_name NULLS LAST
  LIMIT p_limit;
END;
$function$;

-- 1.2 admin_get_allusers (Admin → Users list)
CREATE OR REPLACE FUNCTION public.admin_get_allusers()
RETURNS TABLE(
  approval_status text, approved_at timestamp with time zone, approved_by uuid, city text,
  contract_level integer, created_at timestamp with time zone, current_onboarding_phase text,
  denial_reason text, denied_at timestamp with time zone, email text, first_name text, full_name text,
  hierarchy_depth integer, hierarchy_path text, id uuid, instagram_url text, is_admin boolean,
  last_name text, license_expiration date, license_number text, npn text, onboarding_status text,
  phone text, resident_state text, roles text[], state text, street_address text,
  updated_at timestamp with time zone, upline_id uuid, zip text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT up.is_admin INTO v_is_admin FROM user_profiles up WHERE up.id = auth.uid();

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Only admins can view all users';
  END IF;

  -- Single branch: row_in_acting_scope handles super-admin / IMO-admin / non-acting cases.
  RETURN QUERY
  SELECT
    up.approval_status, up.approved_at, up.approved_by, up.city, up.contract_level,
    up.created_at, up.current_onboarding_phase, up.denial_reason, up.denied_at,
    up.email, up.first_name,
    TRIM(COALESCE(up.first_name, '') || ' ' || COALESCE(up.last_name, '')) AS full_name,
    up.hierarchy_depth, up.hierarchy_path, up.id, up.instagram_url, up.is_admin,
    up.last_name, up.license_expiration, up.license_number, up.npn, up.onboarding_status,
    up.phone, up.resident_state, up.roles, up.state, up.street_address,
    up.updated_at, up.upline_id, up.zip
  FROM user_profiles up
  WHERE row_in_acting_scope(up.imo_id);
END;
$function$;

-- 1.3 admin_get_pending_users
CREATE OR REPLACE FUNCTION public.admin_get_pending_users()
RETURNS TABLE(
  id uuid, email text, full_name text, roles text[], approval_status text, is_admin boolean,
  approved_by uuid, approved_at timestamp with time zone, denied_at timestamp with time zone,
  denial_reason text, created_at timestamp with time zone, updated_at timestamp with time zone,
  upline_id uuid, hierarchy_path text, hierarchy_depth integer, contract_level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  SELECT COALESCE((raw_user_meta_data->>'is_admin')::BOOLEAN, FALSE) INTO caller_is_admin
  FROM auth.users
  WHERE auth.users.id = auth.uid();

  IF NOT COALESCE(caller_is_admin, FALSE) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    up.id,
    up.email,
    COALESCE(
      CASE
        WHEN up.first_name IS NOT NULL AND up.last_name IS NOT NULL
          THEN up.first_name || ' ' || up.last_name
        WHEN up.first_name IS NOT NULL THEN up.first_name
        WHEN up.last_name IS NOT NULL THEN up.last_name
        ELSE NULL
      END,
      NULL
    ) AS full_name,
    up.roles, up.approval_status, up.is_admin, up.approved_by, up.approved_at,
    up.denied_at, up.denial_reason, up.created_at, up.updated_at, up.upline_id,
    up.hierarchy_path, up.hierarchy_depth, up.contract_level
  FROM user_profiles up
  WHERE up.approval_status = 'pending'
    AND up.is_deleted IS NOT TRUE
    AND row_in_acting_scope(up.imo_id)
  ORDER BY up.created_at DESC;
END;
$function$;

-- 1.4 admin_get_user_profile
CREATE OR REPLACE FUNCTION public.admin_get_user_profile(target_user_id uuid)
RETURNS TABLE(
  id uuid, email text, full_name text, roles text[], approval_status text, is_admin boolean,
  approved_by uuid, approved_at timestamp with time zone, denied_at timestamp with time zone,
  denial_reason text, created_at timestamp with time zone, updated_at timestamp with time zone,
  upline_id uuid, hierarchy_path text, hierarchy_depth integer, contract_level integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  SELECT COALESCE((raw_user_meta_data->>'is_admin')::BOOLEAN, FALSE) INTO caller_is_admin
  FROM auth.users
  WHERE auth.users.id = auth.uid();

  IF NOT COALESCE(caller_is_admin, FALSE) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    up.id,
    up.email,
    COALESCE(
      CASE
        WHEN up.first_name IS NOT NULL AND up.last_name IS NOT NULL
          THEN up.first_name || ' ' || up.last_name
        WHEN up.first_name IS NOT NULL THEN up.first_name
        WHEN up.last_name IS NOT NULL THEN up.last_name
        ELSE NULL
      END,
      NULL
    ) AS full_name,
    up.roles, up.approval_status, up.is_admin, up.approved_by, up.approved_at,
    up.denied_at, up.denial_reason, up.created_at, up.updated_at, up.upline_id,
    up.hierarchy_path, up.hierarchy_depth, up.contract_level
  FROM user_profiles up
  WHERE up.id = target_user_id
    AND up.is_deleted IS NOT TRUE
    AND row_in_acting_scope(up.imo_id);
END;
$function$;

-- 1.5 lookup_user_by_email
CREATE OR REPLACE FUNCTION public.lookup_user_by_email(p_email text)
RETURNS TABLE(id uuid, email text, upline_id uuid, is_approved boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_is_approved BOOLEAN;
BEGIN
  SELECT COALESCE((user_profiles.approval_status = 'approved' OR user_profiles.is_admin = true), FALSE)
    INTO caller_is_approved
  FROM user_profiles
  WHERE user_profiles.id = auth.uid();

  IF NOT COALESCE(caller_is_approved, FALSE) THEN
    RAISE EXCEPTION 'Only approved users can lookup users by email';
  END IF;

  RETURN QUERY
  SELECT
    up.id,
    up.email,
    up.upline_id,
    (up.approval_status = 'approved' OR up.is_admin = true) AS is_approved
  FROM user_profiles up
  WHERE up.email = p_email
    AND row_in_acting_scope(up.imo_id);
END;
$function$;

-- 1.6 get_eligible_recipients — caller passes imo/agency; we now enforce caller scope
CREATE OR REPLACE FUNCTION public.get_eligible_recipients(
  p_imo_id uuid DEFAULT NULL::uuid,
  p_agency_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(user_id uuid, email text, full_name text, role text, agency_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_imo uuid;
BEGIN
  IF p_agency_id IS NOT NULL THEN
    SELECT imo_id INTO v_agency_imo FROM agencies WHERE id = p_agency_id;
    IF v_agency_imo IS NULL OR NOT row_in_acting_scope(v_agency_imo) THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      up.user_id,
      u.email,
      COALESCE(up.first_name || ' ' || up.last_name, u.email) AS full_name,
      up.role::TEXT,
      a.name AS agency_name
    FROM user_profiles up
    JOIN auth.users u ON u.id = up.user_id
    LEFT JOIN agencies a ON a.id = up.agency_id
    WHERE up.agency_id = p_agency_id
      AND up.is_active = true
    ORDER BY full_name;

  ELSIF p_imo_id IS NOT NULL THEN
    IF NOT row_in_acting_scope(p_imo_id) THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      up.user_id,
      u.email,
      COALESCE(up.first_name || ' ' || up.last_name, u.email) AS full_name,
      up.role::TEXT,
      a.name AS agency_name
    FROM user_profiles up
    JOIN auth.users u ON u.id = up.user_id
    LEFT JOIN agencies a ON a.id = up.agency_id
    WHERE up.imo_id = p_imo_id
      AND up.is_active = true
    ORDER BY agency_name NULLS LAST, full_name;

  ELSE
    RETURN;
  END IF;
END;
$function$;

-- ============================================================================
-- TIER 2: Acting-IMO leak via auth.uid() assumption
-- ============================================================================

-- 2.1 get_imo_override_summary — derive v_imo_id from effective scope
CREATE OR REPLACE FUNCTION public.get_imo_override_summary(
  p_start_date date DEFAULT (date_trunc('year'::text, (CURRENT_DATE)::timestamp with time zone))::date,
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  imo_id uuid, imo_name text, total_override_count bigint, total_override_amount numeric,
  pending_amount numeric, earned_amount numeric, paid_amount numeric, chargeback_amount numeric,
  unique_uplines bigint, unique_downlines bigint, avg_override_per_policy numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_imo_id uuid;
  v_is_imo_admin boolean;
BEGIN
  v_imo_id := COALESCE(
    get_effective_imo_id(),
    (SELECT up.imo_id FROM user_profiles up WHERE up.id = auth.uid())
  );

  IF v_imo_id IS NULL THEN
    RAISE EXCEPTION 'User is not assigned to an IMO' USING ERRCODE = 'P0001';
  END IF;

  SELECT is_imo_admin() INTO v_is_imo_admin;
  IF NOT v_is_imo_admin AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: IMO admin role required' USING ERRCODE = 'P0003';
  END IF;

  RETURN QUERY
  WITH filtered_overrides AS (
    SELECT oc.*
    FROM override_commissions oc
    INNER JOIN policies p ON oc.policy_id = p.id
    WHERE oc.imo_id = v_imo_id
      AND p.effective_date >= p_start_date
      AND p.effective_date <= p_end_date
  )
  SELECT
    i.id, i.name,
    COUNT(fo.id),
    COALESCE(SUM(fo.override_commission_amount), 0),
    COALESCE(SUM(CASE WHEN fo.status = 'pending' THEN fo.override_commission_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN fo.status = 'earned'  THEN fo.override_commission_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN fo.status = 'paid'    THEN fo.override_commission_amount ELSE 0 END), 0),
    COALESCE(SUM(fo.chargeback_amount), 0),
    COUNT(DISTINCT fo.override_agent_id),
    COUNT(DISTINCT fo.base_agent_id),
    CASE
      WHEN COUNT(DISTINCT fo.policy_id) > 0
      THEN ROUND(SUM(fo.override_commission_amount) / COUNT(DISTINCT fo.policy_id), 2)
      ELSE 0
    END
  FROM imos i
  LEFT JOIN filtered_overrides fo ON fo.imo_id = i.id
  WHERE i.id = v_imo_id
  GROUP BY i.id, i.name;
END;
$function$;

-- 2.2 get_overrides_by_agency — same derivation fix
CREATE OR REPLACE FUNCTION public.get_overrides_by_agency()
RETURNS TABLE(
  agency_id uuid, agency_name text, agency_code text, override_count bigint, total_amount numeric,
  pending_amount numeric, earned_amount numeric, paid_amount numeric, pct_of_imo_overrides numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_imo_id uuid;
  v_is_imo_admin boolean;
  v_total_imo_overrides numeric;
BEGIN
  v_imo_id := COALESCE(
    get_effective_imo_id(),
    (SELECT up.imo_id FROM user_profiles up WHERE up.id = auth.uid())
  );

  IF v_imo_id IS NULL THEN
    RAISE EXCEPTION 'User is not assigned to an IMO' USING ERRCODE = 'P0001';
  END IF;

  SELECT is_imo_admin() INTO v_is_imo_admin;
  IF NOT v_is_imo_admin AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: IMO admin role required' USING ERRCODE = 'P0003';
  END IF;

  SELECT COALESCE(SUM(override_commission_amount), 0) INTO v_total_imo_overrides
  FROM override_commissions
  WHERE imo_id = v_imo_id;

  RETURN QUERY
  SELECT
    a.id, a.name, a.code,
    COUNT(oc.id),
    COALESCE(SUM(oc.override_commission_amount), 0),
    COALESCE(SUM(CASE WHEN oc.status = 'pending' THEN oc.override_commission_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN oc.status = 'earned'  THEN oc.override_commission_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN oc.status = 'paid'    THEN oc.override_commission_amount ELSE 0 END), 0),
    CASE
      WHEN v_total_imo_overrides > 0
      THEN ROUND((COALESCE(SUM(oc.override_commission_amount), 0) / v_total_imo_overrides) * 100, 1)
      ELSE 0
    END
  FROM agencies a
  LEFT JOIN override_commissions oc ON oc.agency_id = a.id
  WHERE a.imo_id = v_imo_id
    AND a.is_active = true
  GROUP BY a.id, a.name, a.code
  ORDER BY 5 DESC;
END;
$function$;

-- 2.3 get_overrides_by_agent — validate agency is in acting scope
CREATE OR REPLACE FUNCTION public.get_overrides_by_agent(p_agency_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
  agent_id uuid, agent_name text, agent_email text, override_count bigint, total_amount numeric,
  pending_amount numeric, earned_amount numeric, paid_amount numeric, avg_per_override numeric,
  pct_of_agency_overrides numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_agency_id uuid;
  v_user_agency_id uuid;
  v_agency_imo uuid;
  v_is_owner boolean;
  v_is_imo_admin boolean;
  v_total_agency_overrides numeric;
BEGIN
  SELECT up.agency_id INTO v_user_agency_id FROM user_profiles up WHERE up.id = auth.uid();
  v_agency_id := COALESCE(p_agency_id, v_user_agency_id);

  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'No agency specified and user is not assigned to an agency' USING ERRCODE = 'P0001';
  END IF;

  SELECT imo_id INTO v_agency_imo FROM agencies WHERE id = v_agency_id;
  IF v_agency_imo IS NULL OR NOT row_in_acting_scope(v_agency_imo) THEN
    RAISE EXCEPTION 'Access denied: agency not in scope' USING ERRCODE = 'P0003';
  END IF;

  SELECT is_agency_owner(v_agency_id) INTO v_is_owner;
  SELECT is_imo_admin() INTO v_is_imo_admin;

  IF NOT v_is_owner AND NOT v_is_imo_admin AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Agency owner or IMO admin role required' USING ERRCODE = 'P0003';
  END IF;

  SELECT COALESCE(SUM(override_commission_amount), 0) INTO v_total_agency_overrides
  FROM override_commissions
  WHERE agency_id = v_agency_id;

  RETURN QUERY
  SELECT
    up.id,
    COALESCE(up.first_name || ' ' || up.last_name, up.email),
    up.email,
    COUNT(oc.id),
    COALESCE(SUM(oc.override_commission_amount), 0),
    COALESCE(SUM(CASE WHEN oc.status = 'pending' THEN oc.override_commission_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN oc.status = 'earned'  THEN oc.override_commission_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN oc.status = 'paid'    THEN oc.override_commission_amount ELSE 0 END), 0),
    CASE WHEN COUNT(oc.id) > 0
         THEN ROUND(SUM(oc.override_commission_amount) / COUNT(oc.id), 2)
         ELSE 0 END,
    CASE WHEN v_total_agency_overrides > 0
         THEN ROUND((COALESCE(SUM(oc.override_commission_amount), 0) / v_total_agency_overrides) * 100, 1)
         ELSE 0 END
  FROM user_profiles up
  JOIN override_commissions oc ON oc.override_agent_id = up.id AND oc.agency_id = v_agency_id
  WHERE up.agency_id = v_agency_id
    AND up.approval_status = 'approved'
  GROUP BY up.id, up.first_name, up.last_name, up.email
  ORDER BY 5 DESC;
END;
$function$;

-- 2.4 get_teammates_with_close_connected — scope super-admin branch
CREATE OR REPLACE FUNCTION public.get_teammates_with_close_connected()
RETURNS TABLE(user_id uuid, first_name text, last_name text, email text, organization_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller        UUID := auth.uid();
  v_caller_upline UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF is_super_admin() THEN
    RETURN QUERY
      SELECT up.id, up.first_name, up.last_name, up.email, cc.organization_name
        FROM user_profiles up
        JOIN close_config cc ON cc.user_id = up.id
       WHERE cc.is_active = TRUE
         AND up.archived_at IS NULL
         AND up.approval_status = 'approved'
         AND up.id <> v_caller
         AND row_in_acting_scope(up.imo_id)
       ORDER BY up.first_name, up.last_name;
    RETURN;
  END IF;

  SELECT upline_id INTO v_caller_upline FROM user_profiles WHERE id = v_caller;

  RETURN QUERY
    SELECT up.id, up.first_name, up.last_name, up.email, cc.organization_name
      FROM user_profiles up
      JOIN close_config cc ON cc.user_id = up.id
     WHERE cc.is_active = TRUE
       AND up.archived_at IS NULL
       AND up.approval_status = 'approved'
       AND up.id <> v_caller
       AND (
         (up.hierarchy_path IS NOT NULL
          AND up.hierarchy_path LIKE '%' || v_caller::text || '%')
         OR (v_caller_upline IS NOT NULL AND up.upline_id = v_caller_upline)
       )
     ORDER BY up.first_name, up.last_name;
END;
$function$;

-- 2.5 get_team_pipeline_snapshot — scope super-admin branch
CREATE OR REPLACE FUNCTION public.get_team_pipeline_snapshot(p_target_user_ids uuid[] DEFAULT NULL::uuid[])
RETURNS TABLE(
  user_id uuid, first_name text, last_name text, email text, profile_photo_url text,
  is_self boolean, has_close_config boolean, last_scored_at timestamp with time zone,
  total_leads integer, hot_count integer, warming_count integer, neutral_count integer,
  cooling_count integer, cold_count integer, avg_score numeric, total_dials integer,
  total_connects integer, connect_rate numeric, stale_leads_count integer, untouched_active integer,
  no_answer_streak integer, straight_to_vm integer, active_opps_count integer, open_opp_value_usd numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller   UUID := auth.uid();
  v_is_admin BOOLEAN := is_super_admin();
  v_allowed  UUID[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_is_admin THEN
    SELECT array_agg(cc.user_id) INTO v_allowed
      FROM close_config cc
      JOIN user_profiles up ON up.id = cc.user_id
     WHERE cc.is_active = true
       AND up.archived_at IS NULL
       AND row_in_acting_scope(up.imo_id);
  ELSE
    SELECT array_agg(up.id) INTO v_allowed
      FROM user_profiles up
      JOIN close_config cc ON cc.user_id = up.id
     WHERE cc.is_active = true
       AND up.archived_at IS NULL
       AND (
         up.id = v_caller
         OR (up.hierarchy_path IS NOT NULL
             AND up.hierarchy_path LIKE '%' || v_caller::text || '%'
             AND up.id != v_caller)
       );
  END IF;

  IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  IF p_target_user_ids IS NOT NULL THEN
    SELECT array_agg(x) INTO v_allowed
      FROM unnest(v_allowed) x
     WHERE x = ANY (p_target_user_ids);
  END IF;

  IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      lhs.user_id, lhs.score, lhs.heat_level, lhs.scored_at,
      COALESCE((lhs.signals->>'callsOutbound')::int, 0)              AS calls_out,
      COALESCE((lhs.signals->>'callsAnswered')::int, 0)              AS calls_ans,
      COALESCE((lhs.signals->>'consecutiveNoAnswers')::int, 0)       AS no_ans,
      COALESCE((lhs.signals->>'straightToVmCount')::int, 0)          AS vm_cnt,
      NULLIF(lhs.signals->>'hoursSinceLastTouch', '')::numeric       AS hrs_since,
      COALESCE((lhs.signals->>'hasActiveOpportunity')::boolean, false) AS has_active_opp,
      COALESCE((lhs.signals->>'opportunityValueUsd')::numeric, 0)    AS opp_val,
      COALESCE((lhs.signals->>'isPositiveStatus')::boolean, false)   AS is_pos
    FROM lead_heat_scores lhs
    WHERE lhs.user_id = ANY (v_allowed)
  ),
  agg AS (
    SELECT
      base.user_id,
      MAX(base.scored_at) AS last_scored_at,
      COUNT(*)::int AS total_leads,
      COUNT(*) FILTER (WHERE base.heat_level = 'hot')::int     AS hot_count,
      COUNT(*) FILTER (WHERE base.heat_level = 'warming')::int AS warming_count,
      COUNT(*) FILTER (WHERE base.heat_level = 'neutral')::int AS neutral_count,
      COUNT(*) FILTER (WHERE base.heat_level = 'cooling')::int AS cooling_count,
      COUNT(*) FILTER (WHERE base.heat_level = 'cold')::int    AS cold_count,
      ROUND(AVG(base.score)::numeric, 1)                       AS avg_score,
      SUM(base.calls_out)::int AS total_dials,
      SUM(base.calls_ans)::int AS total_connects,
      CASE WHEN SUM(base.calls_out) > 0
           THEN ROUND(SUM(base.calls_ans)::numeric / SUM(base.calls_out)::numeric, 4)
           ELSE NULL END AS connect_rate,
      COUNT(*) FILTER (WHERE base.hrs_since IS NOT NULL AND base.hrs_since > 72)::int AS stale_leads_count,
      COUNT(*) FILTER (WHERE base.is_pos AND (base.hrs_since IS NULL OR base.hrs_since > 48))::int AS untouched_active,
      COUNT(*) FILTER (WHERE base.no_ans >= 3)::int AS no_answer_streak,
      SUM(base.vm_cnt)::int AS straight_to_vm,
      COUNT(*) FILTER (WHERE base.has_active_opp)::int AS active_opps_count,
      COALESCE(SUM(base.opp_val) FILTER (WHERE base.has_active_opp), 0) AS open_opp_value_usd
    FROM base
    GROUP BY base.user_id
  )
  SELECT
    up.id, up.first_name, up.last_name, up.email, up.profile_photo_url,
    (up.id = v_caller) AS is_self,
    TRUE AS has_close_config,
    a.last_scored_at,
    COALESCE(a.total_leads, 0),
    COALESCE(a.hot_count, 0),
    COALESCE(a.warming_count, 0),
    COALESCE(a.neutral_count, 0),
    COALESCE(a.cooling_count, 0),
    COALESCE(a.cold_count, 0),
    a.avg_score,
    COALESCE(a.total_dials, 0),
    COALESCE(a.total_connects, 0),
    a.connect_rate,
    COALESCE(a.stale_leads_count, 0),
    COALESCE(a.untouched_active, 0),
    COALESCE(a.no_answer_streak, 0),
    COALESCE(a.straight_to_vm, 0),
    COALESCE(a.active_opps_count, 0),
    COALESCE(a.open_opp_value_usd, 0)
  FROM unnest(v_allowed) AS uid
  JOIN user_profiles up ON up.id = uid
  LEFT JOIN agg a ON a.user_id = up.id
  ORDER BY up.first_name NULLS LAST, up.last_name NULLS LAST;
END;
$function$;

-- 2.6 get_team_uw_wizard_seat_usage — validate target owner's IMO is in scope
CREATE OR REPLACE FUNCTION public.get_team_uw_wizard_seat_usage(p_owner_id uuid)
RETURNS TABLE(
  seat_id uuid, team_owner_id uuid, agent_id uuid, agent_first_name text, agent_last_name text,
  agent_email text, runs_limit integer, runs_used integer, runs_remaining integer,
  last_run_at timestamp with time zone, created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_super_admin BOOLEAN;
  v_owner_imo uuid;
  v_period_start DATE;
BEGIN
  IF auth.uid() != p_owner_id THEN
    SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true)
      INTO v_is_super_admin;
    IF NOT v_is_super_admin THEN
      RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT imo_id INTO v_owner_imo FROM user_profiles WHERE id = p_owner_id;
  IF v_owner_imo IS NOT NULL AND NOT row_in_acting_scope(v_owner_imo) THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  v_period_start := date_trunc('month', CURRENT_DATE)::DATE;

  RETURN QUERY
  SELECT
    tws.id, tws.team_owner_id, tws.agent_id,
    up.first_name::TEXT, up.last_name::TEXT, up.email::TEXT,
    tws.runs_limit,
    COALESCE(uwu.runs_used, 0)::INTEGER,
    GREATEST(0, tws.runs_limit - COALESCE(uwu.runs_used, 0))::INTEGER,
    uwu.last_run_at,
    tws.created_at
  FROM public.team_uw_wizard_seats tws
  JOIN public.user_profiles up ON up.id = tws.agent_id
  LEFT JOIN public.uw_wizard_usage uwu
    ON uwu.user_id = tws.agent_id
   AND uwu.billing_period_start = v_period_start
  WHERE tws.team_owner_id = p_owner_id
  ORDER BY up.last_name NULLS LAST, up.first_name NULLS LAST, up.email NULLS LAST;
END;
$function$;

-- 2.7 get_ip_leaderboard_with_periods — auth check now permits super-admin in scope
CREATE OR REPLACE FUNCTION public.get_ip_leaderboard_with_periods(
  p_imo_id uuid,
  p_agency_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  agent_id uuid, agent_name text, agent_email text, slack_member_id text,
  wtd_ip numeric, wtd_policies integer, mtd_ip numeric, mtd_policies integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE;
  v_week_end DATE;
  v_week_start DATE;
  v_month_start DATE;
BEGIN
  IF current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND imo_id = p_imo_id
    ) AND NOT row_in_acting_scope(p_imo_id) THEN
      RAISE EXCEPTION 'Access denied: not a member of this IMO';
    END IF;
  END IF;

  v_today := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  v_week_end   := date_trunc('week', v_today)::DATE - INTERVAL '1 day';
  v_week_start := v_week_end - INTERVAL '6 days';
  v_month_start := date_trunc('month', v_week_end)::DATE;

  RETURN QUERY
  WITH mtd_ip AS (
    SELECT p.user_id,
           COALESCE(SUM(p.annual_premium), 0) AS mtd_ip,
           COUNT(p.id) AS mtd_policies
    FROM policies p
    WHERE p.imo_id = p_imo_id
      AND p.status = 'approved'
      AND p.effective_date IS NOT NULL
      AND p.effective_date >= v_month_start
      AND p.effective_date <= v_week_end
      AND (p_agency_id IS NULL OR p.agency_id IN (
        SELECT d.agency_id FROM get_agency_descendants(p_agency_id) d
      ))
    GROUP BY p.user_id
    HAVING COALESCE(SUM(p.annual_premium), 0) > 0
  ),
  wtd_ip AS (
    SELECT p.user_id,
           COALESCE(SUM(p.annual_premium), 0) AS wtd_ip,
           COUNT(p.id) AS wtd_policies
    FROM policies p
    WHERE p.imo_id = p_imo_id
      AND p.status = 'approved'
      AND p.effective_date IS NOT NULL
      AND p.effective_date >= v_week_start
      AND p.effective_date <= v_week_end
      AND (p_agency_id IS NULL OR p.agency_id IN (
        SELECT d.agency_id FROM get_agency_descendants(p_agency_id) d
      ))
      AND p.user_id IN (SELECT user_id FROM mtd_ip)
    GROUP BY p.user_id
  )
  SELECT
    mi.user_id,
    COALESCE(
      NULLIF(TRIM(COALESCE(up.first_name, '') || ' ' || COALESCE(up.last_name, '')), ''),
      up.email,
      'Unknown'
    ) AS agent_name,
    up.email,
    up.slack_member_id,
    COALESCE(wi.wtd_ip, 0),
    COALESCE(wi.wtd_policies, 0)::integer,
    mi.mtd_ip,
    mi.mtd_policies::integer
  FROM mtd_ip mi
  JOIN user_profiles up ON up.id = mi.user_id
  LEFT JOIN wtd_ip wi ON wi.user_id = mi.user_id
  ORDER BY mi.mtd_ip DESC;
END;
$function$;

-- 2.8 get_agencies_ip_totals — auth check now permits super-admin in scope
CREATE OR REPLACE FUNCTION public.get_agencies_ip_totals(p_imo_id uuid)
RETURNS TABLE(
  agency_id uuid, agency_name text, wtd_ip numeric, wtd_policies integer,
  mtd_ip numeric, mtd_policies integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE;
  v_week_end DATE;
  v_week_start DATE;
  v_month_start DATE;
BEGIN
  IF current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND imo_id = p_imo_id
    ) AND NOT row_in_acting_scope(p_imo_id) THEN
      RAISE EXCEPTION 'Access denied: not a member of this IMO';
    END IF;
  END IF;

  v_today := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  v_week_end   := date_trunc('week', v_today)::DATE - INTERVAL '1 day';
  v_week_start := v_week_end - INTERVAL '6 days';
  v_month_start := date_trunc('month', v_week_end)::DATE;

  RETURN QUERY
  WITH active_agencies AS (
    SELECT a.id, a.name, a.owner_id, o.hierarchy_path AS owner_hierarchy_path
    FROM agencies a
    INNER JOIN user_profiles o ON o.id = a.owner_id
    WHERE a.imo_id = p_imo_id
      AND a.is_active = true
      AND o.hierarchy_path IS NOT NULL
  ),
  agency_hierarchy_agents AS (
    SELECT DISTINCT aa.id AS agency_id, u.id AS user_id
    FROM active_agencies aa
    INNER JOIN user_profiles u ON (
      u.hierarchy_path = aa.owner_hierarchy_path
      OR u.hierarchy_path LIKE aa.owner_hierarchy_path || '.%'
      OR u.agency_id IN (SELECT d.agency_id FROM get_agency_descendants(aa.id) d)
    )
    WHERE u.imo_id = p_imo_id
      AND u.approval_status = 'approved'
      AND u.archived_at IS NULL
      AND (u.roles @> ARRAY['agent'] OR u.roles @> ARRAY['active_agent'] OR u.is_admin = true)
      AND NOT (
        u.roles @> ARRAY['recruit']
        AND NOT u.roles @> ARRAY['agent']
        AND NOT u.roles @> ARRAY['active_agent']
      )
  ),
  wtd_totals AS (
    SELECT aha.agency_id,
           COALESCE(SUM(p.annual_premium), 0) AS wtd_ip,
           COUNT(p.id) AS wtd_policies
    FROM agency_hierarchy_agents aha
    LEFT JOIN policies p ON p.user_id = aha.user_id
      AND p.imo_id = p_imo_id
      AND p.status = 'approved'
      AND p.effective_date IS NOT NULL
      AND p.effective_date >= v_week_start
      AND p.effective_date <= v_week_end
    GROUP BY aha.agency_id
  ),
  mtd_totals AS (
    SELECT aha.agency_id,
           COALESCE(SUM(p.annual_premium), 0) AS mtd_ip,
           COUNT(p.id) AS mtd_policies
    FROM agency_hierarchy_agents aha
    LEFT JOIN policies p ON p.user_id = aha.user_id
      AND p.imo_id = p_imo_id
      AND p.status = 'approved'
      AND p.effective_date IS NOT NULL
      AND p.effective_date >= v_month_start
      AND p.effective_date <= v_week_end
    GROUP BY aha.agency_id
  )
  SELECT
    aa.id, aa.name,
    COALESCE(wt.wtd_ip, 0), COALESCE(wt.wtd_policies, 0)::integer,
    COALESCE(mt.mtd_ip, 0), COALESCE(mt.mtd_policies, 0)::integer
  FROM active_agencies aa
  LEFT JOIN wtd_totals wt ON wt.agency_id = aa.id
  LEFT JOIN mtd_totals mt ON mt.agency_id = aa.id
  ORDER BY COALESCE(mt.mtd_ip, 0) DESC, aa.name;
END;
$function$;

COMMIT;
