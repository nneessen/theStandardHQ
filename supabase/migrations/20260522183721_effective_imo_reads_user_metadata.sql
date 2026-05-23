-- =============================================================================
-- Read acting_imo_id from auth.users.raw_user_meta_data (no JWT claim hook)
-- =============================================================================
--
-- ORIGINAL DESIGN (20260522180340) read acting_imo_id from a JWT custom claim
-- (auth.jwt() #>> '{app_metadata,acting_imo_id}'). That approach needs:
--   1. A Custom Access Token Hook edge function to bake the claim in at login
--   2. A manual Supabase Dashboard registration step
--   3. `supabase.auth.refreshSession()` on every IMO switch to mint a new JWT
--
-- That's heavy when we just need it to work in dev TODAY.
--
-- NEW DESIGN: read directly from `auth.users.raw_user_meta_data`. The frontend
-- calls `supabase.auth.updateUser({ data: { acting_imo_id: <uuid> } })` which
-- writes to that JSONB column. SECURITY DEFINER lets the helper read it
-- without giving authenticated role direct SELECT on auth.users.
--
-- Trade-off: extra index lookup per RLS query. Postgres caches the row within
-- a query plan, and auth.uid() already does similar lookups — net cost is one
-- extra hashjoin per query. Worth it for the simplicity.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_effective_imo_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT CASE
    WHEN public.is_super_admin() THEN
      -- Super-admin: read acting_imo_id from auth.users.raw_user_meta_data
      -- NULL when not acting (= "see all" escape hatch).
      (
        SELECT NULLIF(raw_user_meta_data->>'acting_imo_id', '')::uuid
        FROM auth.users
        WHERE id = auth.uid()
      )
    ELSE
      -- Non-super-admin: always pinned to their real IMO, ignore claim/metadata.
      (SELECT imo_id FROM public.user_profiles WHERE id = auth.uid())
  END;
$$;

COMMENT ON FUNCTION public.get_effective_imo_id() IS
  'Returns the IMO uuid that should scope the current request. For super-admins, reads acting_imo_id from auth.users.raw_user_meta_data (NULL if absent = see-all). For everyone else, returns their real user_profiles.imo_id. Updated by supabase.auth.updateUser() in the frontend — no JWT refresh required.';

-- super_admin_in_scope still uses get_effective_imo_id internally, but it was
-- inlined to read auth.jwt() directly. Redefine it to delegate cleanly.
CREATE OR REPLACE FUNCTION public.super_admin_in_scope(row_imo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() AND (
    public.get_effective_imo_id() IS NULL
    OR row_imo_id = public.get_effective_imo_id()
  );
$$;

COMMENT ON FUNCTION public.super_admin_in_scope(uuid) IS
  'RLS helper: true when caller is super-admin AND (no acting_imo_id set OR row''s imo_id matches acting). Reads acting state from auth.users.raw_user_meta_data via get_effective_imo_id().';

GRANT EXECUTE ON FUNCTION public.get_effective_imo_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_in_scope(uuid) TO authenticated;
