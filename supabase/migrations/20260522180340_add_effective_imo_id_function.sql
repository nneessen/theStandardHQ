-- =============================================================================
-- get_effective_imo_id() and super_admin_in_scope() helper functions
-- =============================================================================
--
-- PURPOSE:
-- Implements the database half of the super-admin acting-as-IMO override.
-- The frontend writes `acting_imo_id` into a JWT custom claim
-- (via the custom-access-token-hook edge function). These functions read that
-- claim and turn it into a row-scoping decision that EVERY super-admin RLS
-- policy can consult, so a single switch in the sidebar re-scopes reads
-- across all 76 tables — not just writes.
--
-- BACKGROUND:
-- Migration 20260521213701 closed cross-IMO leaks for non-super-admins. But
-- every super-admin RLS policy still says "if you're super-admin, return TRUE"
-- unconditionally — so when Nick toggles "Act as Epic Life" in the sidebar,
-- writes route correctly to Epic Life but reads still show every IMO's data.
-- These helpers fix that without breaking the "no override = see all" escape
-- hatch super-admins need for cross-IMO operations.
--
-- SEMANTICS:
--   get_effective_imo_id():
--     - super-admin WITH acting_imo_id claim: returns the acting IMO uuid
--     - super-admin WITHOUT claim:            returns NULL = "no override"
--     - non-super-admin:                      returns their real user_profiles.imo_id
--   super_admin_in_scope(row_imo_id):
--     - true iff caller is super-admin AND (no override OR row matches override)
-- =============================================================================

-- Drop legacy definitions if present (idempotent re-run support)
DROP FUNCTION IF EXISTS public.get_effective_imo_id();
DROP FUNCTION IF EXISTS public.super_admin_in_scope(uuid);

-- ----------------------------------------------------------------------------
-- get_effective_imo_id()
-- ----------------------------------------------------------------------------
-- Reads acting_imo_id ONLY for super-admins. For everyone else, returns the
-- caller's real user_profiles.imo_id — making the function safe even if a
-- compromised non-super-admin somehow set the claim in their JWT.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_effective_imo_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_super_admin() THEN
      -- super-admin: claim or NULL (NULL = "no scope override = see all IMOs")
      NULLIF(auth.jwt() #>> '{app_metadata,acting_imo_id}', '')::uuid
    ELSE
      -- everyone else: ignore claim, always pinned to real IMO
      (SELECT imo_id FROM public.user_profiles WHERE id = auth.uid())
  END;
$$;

COMMENT ON FUNCTION public.get_effective_imo_id() IS
  'Returns the IMO uuid that should scope the current request. For super-admins, prefers the acting_imo_id JWT claim (NULL if absent = see-all escape hatch). For everyone else, returns the caller''s real user_profiles.imo_id, ignoring any claim. Used by super-admin RLS policies to enforce tenant isolation while preserving cross-IMO operations.';

-- ----------------------------------------------------------------------------
-- super_admin_in_scope(row_imo_id uuid)
-- ----------------------------------------------------------------------------
-- The predicate every super-admin RLS policy on an imo-scoped table calls.
-- Returns true when the caller is super-admin AND either the override is
-- unset (see all) or the row's imo_id matches the override.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.super_admin_in_scope(row_imo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() AND (
    NULLIF(auth.jwt() #>> '{app_metadata,acting_imo_id}', '') IS NULL
    OR row_imo_id = (auth.jwt() #>> '{app_metadata,acting_imo_id}')::uuid
  );
$$;

COMMENT ON FUNCTION public.super_admin_in_scope(uuid) IS
  'RLS helper: true when caller is super-admin AND (no acting_imo_id override OR row''s imo_id matches override). Use in super-admin policies on tables with a direct imo_id column. For join-scoped tables, expand to an EXISTS clause that checks the parent row''s imo_id against get_effective_imo_id().';

-- Grant execute to authenticated role (RLS will call these on every query)
GRANT EXECUTE ON FUNCTION public.get_effective_imo_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_in_scope(uuid) TO authenticated;

-- function_versions tracking is handled automatically by the migration runner.
