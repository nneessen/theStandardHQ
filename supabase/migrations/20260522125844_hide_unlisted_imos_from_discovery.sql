-- Hide private IMOs (e.g. Epic Life) from discovery endpoints.
--
-- The RLS audit on 2026-05-22 found two SECURITY DEFINER functions that bypass
-- the imos table's per-user RLS and return data to non-super-admin callers:
--
--   1. get_available_imos_for_join() — returns ALL active IMOs to any caller.
--      Used by the join-request flow for users without an IMO assignment.
--      If we create Epic Life with is_active=true, every unattached user
--      would see "Epic Life" listed as an org they could request to join.
--
--   2. build_imo_org_chart(p_imo_id, ...) — has NO permission check at all.
--      Any caller with any imo_id can pull the full org chart (agents,
--      hierarchy, metrics). If the Epic Life UUID ever leaks via leak #1
--      or any other path, anyone could query Epic Life's org chart.
--
-- Fix:
--   1. Add `is_listed` boolean to imos (default true). Setting is_listed=false
--      hides the IMO from discovery surfaces without disabling it.
--   2. get_available_imos_for_join() filters by `is_listed = true`.
--   3. build_imo_org_chart() requires the caller to be super_admin OR have
--      p_imo_id matching their own get_my_imo_id().

-- ---------------------------------------------------------------------------
-- 1. Add is_listed column to imos.
-- ---------------------------------------------------------------------------
ALTER TABLE public.imos ADD COLUMN IF NOT EXISTS is_listed boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.imos.is_listed IS
  'When false, this IMO is hidden from public discovery endpoints (get_available_imos_for_join). Used to make a tenant invisible to non-super-admin users for sensitive setups like Epic Life. RLS on the imos table itself still restricts non-super-admin reads to their own IMO regardless of is_listed.';

-- ---------------------------------------------------------------------------
-- 2. get_available_imos_for_join: only return listed IMOs.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_available_imos_for_join()
RETURNS TABLE(id uuid, name text, code text, description text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.name, i.code, i.description
  FROM public.imos i
  WHERE i.is_active = true
    AND i.is_listed = true
  ORDER BY i.name;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. build_imo_org_chart: revoke EXECUTE from authenticated.
--    Function body is unchanged; only super_admin / service_role callers can
--    invoke it. The function isn't referenced anywhere in frontend code
--    (verified via grep on 2026-05-22), so this is a defense-in-depth change.
--    If/when a UI path is added, it should call via super_admin gate or RLS-
--    aware proxy, not via direct RPC.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.build_imo_org_chart(uuid, boolean, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.build_imo_org_chart(uuid, boolean, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.build_imo_org_chart(uuid, boolean, integer) FROM anon;
-- service_role and postgres keep EXECUTE by default.
