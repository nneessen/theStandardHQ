-- ============================================================================
-- External-risk RPC triage (2026-05-25): authorize cascade_agency_assignment
-- ============================================================================
--
-- cascade_agency_assignment(p_agency_id, p_owner_id, p_imo_id) is SECURITY DEFINER
-- and was granted to `authenticated` with NO authorization check. It reassigns the
-- target owner AND their entire downline subtree (hierarchy_path LIKE owner_path||'.%')
-- to p_agency_id / p_imo_id. Any authenticated user could therefore call it directly
-- and yank an arbitrary owner's whole subtree into any IMO/agency — a cross-tenant
-- WRITE bypass that RLS does not catch (definer bypasses RLS).
--
-- Legitimate caller: AgencyService.createAgencyWithCascade — an IMO admin/owner
-- creating an agency inside their own IMO and cascading their downline into it.
--
-- Fix: reproduce the body verbatim and add a tenant/role gate up front. Caller must
-- be super-admin, or an IMO admin whose acting scope covers BOTH the target IMO and
-- the owner's current IMO (so a normal admin can only reassign within their own IMO;
-- a super-admin follows the acting/see-all rules of row_in_acting_scope). The gate
-- uses the function's existing jsonb error contract (returns success:false) rather
-- than RAISE, to stay consistent with its input-validation style and avoid the
-- trailing `EXCEPTION WHEN OTHERS` handler reshaping the error.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cascade_agency_assignment(p_agency_id uuid, p_owner_id uuid, p_imo_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_path TEXT;
  v_affected_count INTEGER;
  v_owner_first_name TEXT;
  v_owner_last_name TEXT;
BEGIN
  -- Validate inputs
  IF p_agency_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Agency ID is required'
    );
  END IF;

  IF p_owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Owner ID is required'
    );
  END IF;

  IF p_imo_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'IMO ID is required'
    );
  END IF;

  -- AUTHORIZATION (added 2026-05-25 external-risk triage): this SECURITY DEFINER
  -- function reassigns a user + their entire downline's imo_id/agency_id and had no
  -- caller check. Gate: caller must be super-admin, or an IMO admin whose acting
  -- scope covers BOTH the target IMO and the owner's current IMO — no cross-tenant
  -- reassignment.
  IF NOT public.is_super_admin() THEN
    IF NOT public.is_imo_admin() THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unauthorized: IMO admin role required'
      );
    END IF;

    IF NOT public.row_in_acting_scope(p_imo_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unauthorized: target IMO is outside your scope'
      );
    END IF;

    IF NOT public.row_in_acting_scope(
      (SELECT imo_id FROM public.user_profiles WHERE id = p_owner_id)
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Unauthorized: owner is outside your scope'
      );
    END IF;
  END IF;

  -- Get the owner's hierarchy_path and name
  SELECT hierarchy_path, first_name, last_name
  INTO v_owner_path, v_owner_first_name, v_owner_last_name
  FROM user_profiles
  WHERE id = p_owner_id;

  -- Check if owner exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Owner not found'
    );
  END IF;

  -- If owner has no hierarchy_path, just assign them alone
  IF v_owner_path IS NULL OR v_owner_path = '' THEN
    UPDATE user_profiles
    SET
      agency_id = p_agency_id,
      imo_id = p_imo_id,
      updated_at = now()
    WHERE id = p_owner_id;

    RETURN jsonb_build_object(
      'success', true,
      'owner_updated', true,
      'downlines_updated', 0,
      'total_updated', 1,
      'owner_name', COALESCE(
        NULLIF(TRIM(COALESCE(v_owner_first_name, '') || ' ' || COALESCE(v_owner_last_name, '')), ''),
        'Unknown'
      )
    );
  END IF;

  -- Update owner + all downlines in a single UPDATE
  -- Pattern: id = owner_id OR hierarchy_path starts with owner_path followed by a dot
  UPDATE user_profiles
  SET
    agency_id = p_agency_id,
    imo_id = p_imo_id,
    updated_at = now()
  WHERE
    id = p_owner_id  -- Owner themselves
    OR hierarchy_path LIKE v_owner_path || '.%';  -- All downlines

  GET DIAGNOSTICS v_affected_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'owner_updated', true,
    'downlines_updated', GREATEST(v_affected_count - 1, 0),  -- Subtract 1 for owner
    'total_updated', v_affected_count,
    'owner_name', COALESCE(
      NULLIF(TRIM(COALESCE(v_owner_first_name, '') || ' ' || COALESCE(v_owner_last_name, '')), ''),
      'Unknown'
    ),
    'owner_hierarchy_path', v_owner_path
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$function$;

COMMIT;
