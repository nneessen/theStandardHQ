-- ============================================================================
-- Tier A: tenant-gate / lock down IMO- and agency-id getters
-- ============================================================================
--
-- Epic Life authenticated-surface audit (2026-05-23). These SECURITY DEFINER
-- functions accept an imo_id/agency_id and return that tenant's data with NO
-- tenant gate. Since Epic Life's IMO id (89514211-...) and its agency
-- "The Standard" (1df3c15a-...) are already disclosed, any authenticated user
-- could pass them and read Epic data.
--
-- Two classes of fix:
--   GATE (user-facing): get_imo_metrics, get_agency_metrics are called from the
--     frontend (ImoService, AgencyService). Add row_in_acting_scope() so a
--     normal user only sees their own IMO and an acting super-admin only sees
--     the acting IMO (NULL acting = see-all escape hatch).
--   REVOKE (edge/internal-only): get_imo_submit_totals, get_agency_users_for_sms,
--     get_agency_hierarchy, get_agency_descendants have NO frontend caller. They
--     are invoked only by the slack-policy-notification edge function (service_role,
--     verified) and internally by other SECURITY DEFINER functions (all 7 internal
--     callers verified SECURITY DEFINER, so they keep access as the definer).
--     Removing the `authenticated`/`anon` grant kills the leak with zero risk.
--
-- Gating would BREAK the edge-only functions (service_role has auth.uid()=NULL →
-- get_my_imo_id()=NULL → row_in_acting_scope=false → empty), so those are revoked,
-- not gated.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- GATE: get_imo_metrics(uuid) — keyed directly by imo_id
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_imo_metrics(p_imo_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
BEGIN
  -- Tenant gate: caller's own IMO only (super-admin: acting IMO, or all if not acting).
  IF NOT public.row_in_acting_scope(p_imo_id) THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'total_agencies', (
      SELECT COUNT(*) FROM agencies
      WHERE imo_id = p_imo_id AND is_active = true
    ),
    'total_agents', (
      SELECT COUNT(*) FROM user_profiles
      WHERE imo_id = p_imo_id
    ),
    'active_agents', (
      SELECT COUNT(*) FROM user_profiles
      WHERE imo_id = p_imo_id AND approval_status = 'approved'
    ),
    'total_policies', (
      SELECT COUNT(*) FROM policies
      WHERE imo_id = p_imo_id
    ),
    'total_premium', (
      SELECT COALESCE(SUM(annual_premium), 0) FROM policies
      WHERE imo_id = p_imo_id
    ),
    'total_commissions', (
      SELECT COALESCE(SUM(amount), 0) FROM commissions
      WHERE imo_id = p_imo_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- ----------------------------------------------------------------------------
-- GATE: get_agency_metrics(uuid) — keyed by agency_id; resolve its IMO first
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_agency_metrics(p_agency_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_imo_id uuid;
BEGIN
  -- Resolve the agency's IMO and gate on it. Unknown agency -> v_imo_id NULL ->
  -- row_in_acting_scope false for normal users -> NULL (safe).
  SELECT imo_id INTO v_imo_id FROM agencies WHERE id = p_agency_id;
  IF NOT public.row_in_acting_scope(v_imo_id) THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'total_agents', (
      SELECT COUNT(*) FROM user_profiles
      WHERE agency_id = p_agency_id
    ),
    'active_agents', (
      SELECT COUNT(*) FROM user_profiles
      WHERE agency_id = p_agency_id AND approval_status = 'approved'
    ),
    'total_policies', (
      SELECT COUNT(*) FROM policies p
      JOIN user_profiles up ON p.user_id = up.id
      WHERE up.agency_id = p_agency_id
    ),
    'total_premium', (
      SELECT COALESCE(SUM(p.annual_premium), 0) FROM policies p
      JOIN user_profiles up ON p.user_id = up.id
      WHERE up.agency_id = p_agency_id
    ),
    'total_commissions', (
      SELECT COALESCE(SUM(c.amount), 0) FROM commissions c
      JOIN user_profiles up ON c.user_id = up.id
      WHERE up.agency_id = p_agency_id
    ),
    'total_override_commissions', (
      SELECT COALESCE(SUM(oc.override_commission_amount), 0) FROM override_commissions oc
      JOIN user_profiles up ON oc.override_agent_id = up.id
      WHERE up.agency_id = p_agency_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- ----------------------------------------------------------------------------
-- REVOKE: edge/internal-only getters. service_role (edge) + internal definer
-- callers keep access; direct authenticated/anon access is removed.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_imo_submit_totals(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_imo_submit_totals(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_agency_users_for_sms(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_agency_users_for_sms(uuid, uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_agency_hierarchy(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_agency_hierarchy(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_agency_descendants(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_agency_descendants(uuid) TO service_role;
