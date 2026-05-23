-- =============================================================================
-- get_my_imo_id() now honors the super-admin acting_imo_id claim
-- =============================================================================
--
-- ROOT CAUSE OF LAYER 3 LEAK:
-- Many existing RLS policies use the shape `(imo_id = get_my_imo_id())` to
-- grant "regular user can see own-IMO" access. When super-admin Nick acts as
-- Epic Life, get_my_imo_id() still returned his REAL imo (Founders) — so the
-- regular-user branch let him see Founders rows even though the super-admin
-- branch (super_admin_in_scope) only matched Epic. Result: he saw EVERYTHING.
--
-- FIX:
-- Make get_my_imo_id() delegate to get_effective_imo_id() with a fallback.
-- Semantics by caller:
--   - super-admin ACTING:      returns acting_imo_id from JWT claim
--   - super-admin NOT acting:  returns user_profiles.imo_id (unchanged)
--   - non-super-admin:         returns user_profiles.imo_id (unchanged;
--                              claim is ignored by get_effective_imo_id)
--
-- WHY THIS IS SAFE:
-- get_my_imo_id() is used in two ways across the codebase:
--   1. RLS scoping clauses: `imo_id = get_my_imo_id()` — these now correctly
--      scope to the acting IMO when super-admin is acting.
--   2. RPC functions (e.g. lead_vendor_admin_stats): `WHERE imo_id =
--      COALESCE(p_imo_id, get_my_imo_id())` — these also now honor acting,
--      which is the desired behavior.
-- Both call-site semantics ("the IMO this request should operate within")
-- become correct under the new definition.
-- =============================================================================

-- CREATE OR REPLACE preserves the function signature and all dependent policies.
-- Cannot DROP — 135+ RLS policies depend on this function.

CREATE OR REPLACE FUNCTION public.get_my_imo_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.get_effective_imo_id(),
    (SELECT imo_id FROM public.user_profiles WHERE id = auth.uid())
  );
$$;

COMMENT ON FUNCTION public.get_my_imo_id() IS
  'Returns the IMO the current request should operate within. For super-admins with an acting_imo_id JWT claim, returns the acting IMO; otherwise returns the caller''s real user_profiles.imo_id. This drives both RLS scoping clauses (imo_id = get_my_imo_id()) and admin RPC scoping (WHERE imo_id = COALESCE(p_imo_id, get_my_imo_id())).';

GRANT EXECUTE ON FUNCTION public.get_my_imo_id() TO authenticated;
