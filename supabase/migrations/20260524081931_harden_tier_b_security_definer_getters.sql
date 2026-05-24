-- ============================================================================
-- Tier B: tenant-gate / lock down SECURITY DEFINER hierarchy & analytics getters
-- ============================================================================
--
-- Epic Life authenticated-surface audit, part 2 (2026-05-24). These SECURITY
-- DEFINER functions bypass RLS and either (a) had no per-target tenant check or
-- (b) checked only the caller's role, not that the *target* shares the caller's
-- IMO. A normal Epic Life user (imo 89514211-...) could pass an FFG user/agent id
-- (FFG imo = ffffffff-...) and read FFG hierarchy, emails, commission profiles,
-- and full team analytics (policies, commissions, chargebacks, clients, targets).
--
-- Canonical gate: public.row_in_acting_scope(row_imo_id) =
--   (NOT super_admin AND row_imo_id = get_my_imo_id())          -- own IMO only
--   OR (super_admin AND get_effective_imo_id() IS NULL)          -- see-all
--   OR (super_admin AND row_imo_id = get_effective_imo_id());    -- acting IMO
-- For user/agent-keyed functions we resolve the entity's imo_id first.
--
-- Three classes of fix:
--   GATE (user-facing, reproduce body): get_org_chart_data agent-scope branch,
--     get_downline_with_emails, get_upline_chain.
--   RENAME + WRAPPER (large bodies, keep verbatim as _impl): getuser_commission_profile
--     (2-arg, frontend), get_team_analytics_data. Wrapper gates, then calls _impl;
--     _impl revoked from authenticated/anon (callable only by the definer wrapper +
--     service_role).
--   REVOKE (no user-facing caller): getuser_commission_profile(uuid) [1-arg orphan,
--     UNGATED leak], get_user_commission_profile(uuid,int) [orphan], build_agent_org_chart,
--     build_agent_downline_tree, build_agency_org_chart [reached only via the SECURITY
--     DEFINER get_org_chart_data, so the definer keeps access], get_daily_production_by_agent
--     [slack-refresh-leaderboard edge fn, service_role].
--
-- LEFT ALONE deliberately: get_downline_ids / get_user_upline_and_recruiter_ids are
-- referenced by user_profiles RLS policies (user_profiles_select_hierarchy / _upline /
-- _recruiter) — revoking them would break user_profiles reads (outage). build_imo_org_chart
-- is already not granted to authenticated/anon.
-- ============================================================================

-- Applied atomically: RENAME + CREATE wrapper + REVOKE/GRANT must all succeed
-- together, or none persist (Postgres DDL is transactional).
BEGIN;

-- ----------------------------------------------------------------------------
-- GATE: get_org_chart_data — add the missing AGENT-scope authorization check.
-- (imo and agency scopes were already gated; agent scope let any user view any
--  agent's org chart.) Body reproduced verbatim from prod with one block added.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_org_chart_data(p_scope text DEFAULT 'auto'::text, p_scope_id uuid DEFAULT NULL::uuid, p_include_metrics boolean DEFAULT true, p_max_depth integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id uuid;
    v_user_imo_id uuid;
    v_user_agency_id uuid;
    v_is_imo_admin boolean;
    v_is_agency_owner boolean;
    v_result jsonb;
    v_scope text;
    v_scope_id uuid;
BEGIN
    -- Get current user context
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get user's org context
    SELECT
        imo_id,
        agency_id,
        'imo_admin' = ANY(roles) OR is_admin,
        agency_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM agencies WHERE id = user_profiles.agency_id AND owner_id = user_profiles.id
        )
    INTO v_user_imo_id, v_user_agency_id, v_is_imo_admin, v_is_agency_owner
    FROM user_profiles
    WHERE id = v_user_id;

    -- Determine scope automatically if not specified
    IF p_scope = 'auto' OR p_scope IS NULL THEN
        IF v_is_imo_admin THEN
            v_scope := 'imo';
            v_scope_id := v_user_imo_id;
        ELSIF v_is_agency_owner THEN
            v_scope := 'agency';
            v_scope_id := v_user_agency_id;
        ELSE
            v_scope := 'agent';
            v_scope_id := v_user_id;
        END IF;
    ELSE
        v_scope := p_scope;
        v_scope_id := COALESCE(p_scope_id,
            CASE p_scope
                WHEN 'imo' THEN v_user_imo_id
                WHEN 'agency' THEN v_user_agency_id
                ELSE v_user_id
            END
        );
    END IF;

    -- Authorization check
    IF v_scope = 'imo' AND (NOT v_is_imo_admin OR v_scope_id != v_user_imo_id) THEN
        RAISE EXCEPTION 'Not authorized to view this IMO org chart';
    END IF;

    IF v_scope = 'agency' THEN
        -- Check if user can view this agency (is owner or IMO admin)
        IF NOT EXISTS (
            SELECT 1 FROM agencies a
            WHERE a.id = v_scope_id
            AND (a.owner_id = v_user_id OR (a.imo_id = v_user_imo_id AND v_is_imo_admin))
        ) THEN
            RAISE EXCEPTION 'Not authorized to view this agency org chart';
        END IF;
    END IF;

    -- TENANT GATE (added Tier B): agent scope must be in the caller's acting scope.
    -- Resolves the requested agent's imo_id; a normal user only passes when it
    -- equals their own IMO, a super-admin per acting/see-all rules.
    IF v_scope = 'agent' THEN
        IF NOT public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = v_scope_id)) THEN
            RAISE EXCEPTION 'Not authorized to view this agent org chart';
        END IF;
    END IF;

    -- Build org chart based on scope
    IF v_scope = 'imo' THEN
        v_result := build_imo_org_chart(v_scope_id, p_include_metrics, p_max_depth);
    ELSIF v_scope = 'agency' THEN
        v_result := build_agency_org_chart(v_scope_id, p_include_metrics, p_max_depth);
    ELSE
        v_result := build_agent_org_chart(v_scope_id, p_include_metrics, p_max_depth);
    END IF;

    RETURN v_result;
END;
$function$;

-- ----------------------------------------------------------------------------
-- GATE: get_downline_with_emails — caller may only resolve a downline rooted at
-- a user inside their own acting scope.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_downline_with_emails(p_user_id uuid, p_max_count integer DEFAULT 50)
 RETURNS TABLE(id uuid, email text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT up.id, up.email
  FROM user_profiles up
  WHERE public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id))
    AND up.id IN (SELECT downline_id FROM get_downline_ids(p_user_id))
    AND up.id != p_user_id  -- Exclude self
    AND up.archived_at IS NULL  -- active only (was up.is_deleted=false; column dropped in archived_at migration — fixes a latent runtime error)
    AND up.email IS NOT NULL
  LIMIT p_max_count;
$function$;

-- ----------------------------------------------------------------------------
-- GATE: get_upline_chain — caller may only walk an upline rooted at a user
-- inside their own acting scope.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_upline_chain(p_user_id uuid, p_max_depth integer DEFAULT 10)
 RETURNS TABLE(id uuid, email text, depth integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE upline_tree AS (
    -- Base case: start user's direct upline
    SELECT
      up.upline_id as id,
      (SELECT email FROM user_profiles WHERE id = up.upline_id) as email,
      1 as depth
    FROM user_profiles up
    WHERE up.id = p_user_id AND up.upline_id IS NOT NULL

    UNION ALL

    -- Recursive case: go up the chain
    SELECT
      up.upline_id,
      (SELECT email FROM user_profiles WHERE id = up.upline_id),
      ut.depth + 1
    FROM user_profiles up
    INNER JOIN upline_tree ut ON up.id = ut.id
    WHERE up.upline_id IS NOT NULL
      AND ut.depth < p_max_depth
  )
  SELECT * FROM upline_tree
  WHERE id IS NOT NULL
    AND public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = p_user_id));
$function$;

-- ----------------------------------------------------------------------------
-- RENAME + WRAPPER: getuser_commission_profile(uuid, integer)  [2-arg, frontend]
-- The 200-line body is preserved verbatim as _impl; the wrapper adds the IMO
-- tenant gate the original lacked (its inner check allowed any is_imo_admin()
-- caller to read ANY user's profile regardless of IMO).
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.getuser_commission_profile(uuid, integer)
  RENAME TO getuser_commission_profile_impl;
REVOKE EXECUTE ON FUNCTION public.getuser_commission_profile_impl(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.getuser_commission_profile_impl(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.getuser_commission_profile(puser_id uuid, p_lookback_months integer DEFAULT 12)
 RETURNS TABLE(contract_level integer, simple_avg_rate numeric, weighted_avg_rate numeric, product_breakdown jsonb, data_quality text, calculated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Tenant gate: target user must be in caller's acting scope (own IMO / acting / super-admin).
  IF NOT public.row_in_acting_scope((SELECT imo_id FROM user_profiles WHERE id = puser_id)) THEN
    RAISE EXCEPTION 'Unauthorized: cannot access this user''s commission profile'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.getuser_commission_profile_impl(puser_id, p_lookback_months);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.getuser_commission_profile(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.getuser_commission_profile(uuid, integer) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- RENAME + WRAPPER: get_team_analytics_data(uuid[], timestamptz, timestamptz)
-- Body preserved verbatim as _impl (keeps its statement_timeout). Wrapper rejects
-- the call if ANY requested team member is outside the caller's acting scope.
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.get_team_analytics_data(uuid[], timestamptz, timestamptz)
  RENAME TO get_team_analytics_data_impl;
REVOKE EXECUTE ON FUNCTION public.get_team_analytics_data_impl(uuid[], timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_team_analytics_data_impl(uuid[], timestamptz, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.get_team_analytics_data(p_team_user_ids uuid[], p_start_date timestamp with time zone, p_end_date timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '15s'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  -- Tenant gate: every requested team member must be in the caller's acting scope.
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = ANY(p_team_user_ids)
      AND NOT public.row_in_acting_scope(imo_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: team includes users outside your IMO'
      USING ERRCODE = '42501';
  END IF;
  RETURN public.get_team_analytics_data_impl(p_team_user_ids, p_start_date, p_end_date);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_team_analytics_data(uuid[], timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_team_analytics_data(uuid[], timestamp with time zone, timestamp with time zone) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- REVOKE: no user-facing caller. service_role (+ internal SECURITY DEFINER
-- callers, which run as the definer/owner) keep access; direct authenticated/anon
-- access is removed.
-- ----------------------------------------------------------------------------

-- 1-arg orphan: UNGATED (COALESCE(p_user_id, auth.uid()), no auth check) — leaked
-- any user's earnings/chargebacks/policies. Frontend calls the 2-arg (puser_id) only.
REVOKE EXECUTE ON FUNCTION public.getuser_commission_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.getuser_commission_profile(uuid) TO service_role;

-- underscore-named orphan (frontend uses getuser_, not get_user_)
REVOKE EXECUTE ON FUNCTION public.get_user_commission_profile(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_commission_profile(uuid, integer) TO service_role;

-- internal org-chart builders (reached only via SECURITY DEFINER get_org_chart_data)
REVOKE EXECUTE ON FUNCTION public.build_agent_org_chart(uuid, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.build_agent_org_chart(uuid, boolean, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.build_agent_downline_tree(uuid, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.build_agent_downline_tree(uuid, boolean, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.build_agency_org_chart(uuid, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.build_agency_org_chart(uuid, boolean, integer) TO service_role;

-- edge-only (slack-refresh-leaderboard, service_role)
REVOKE EXECUTE ON FUNCTION public.get_daily_production_by_agent(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_daily_production_by_agent(uuid, uuid) TO service_role;

COMMIT;
