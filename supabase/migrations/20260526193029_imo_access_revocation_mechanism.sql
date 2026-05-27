-- ============================================================================
-- IMO Access Revocation Mechanism (DORMANT)
-- ============================================================================
-- Adds the backend chokepoint that, when an IMO's `access_revoked_at` is set,
-- denies ALL data access for that IMO's non-super-admin users at the RLS layer,
-- while leaving the export/wipe edge functions (service-role) fully functional.
--
-- SHIPS DORMANT: no IMO has `access_revoked_at` set, so `is_access_revoked()`
-- never matches and `get_effective_imo_id()` returns exactly what it did before.
-- Nothing changes for any user until an owner sets `access_revoked_at` later.
--
-- CRITICAL DESIGN NOTE — why the deny value is a SENTINEL UUID, not NULL:
--   `get_effective_imo_id() IS NULL` is the super-admin "see everything" escape
--   hatch used across ~407 RLS policies (see super_admin_in_scope). Returning
--   NULL for a revoked user would GRANT them universal access. Worse,
--   `get_my_imo_id()` does COALESCE(get_effective_imo_id(), real_imo_id), so a
--   NULL would fall through to the user's REAL imo_id and leak their own IMO's
--   data. The only safe deny value is a sentinel UUID that matches no real row.
-- ============================================================================

-- 1. Config-as-data: per-IMO revocation timestamp (NULL = active, the default).
ALTER TABLE public.imos
  ADD COLUMN IF NOT EXISTS access_revoked_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.imos.access_revoked_at IS
  'When set (<= now), all non-super-admin users in this IMO are denied data access at the RLS layer and routed to the platform-sunset flow. NULL = normal access. Reversible: clear to restore.';

-- 2. Revocation predicate. SECURITY DEFINER + STABLE so it can be used inside
--    RLS policies. Super-admin is NEVER revoked (checked first). Used both by
--    get_effective_imo_id() below and directly by ownership/storage policies.
CREATE OR REPLACE FUNCTION public.is_access_revoked(p_user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT NOT public.is_super_admin()
     AND EXISTS (
       SELECT 1
       FROM public.user_profiles up
       JOIN public.imos i ON i.id = up.imo_id
       WHERE up.id = p_user_id
         AND i.access_revoked_at IS NOT NULL
         AND i.access_revoked_at <= now()
     );
$function$;

GRANT EXECUTE ON FUNCTION public.is_access_revoked(uuid) TO authenticated;

-- 3. The single chokepoint. Same body as before with ONE added branch:
--    revoked non-super-admin -> sentinel UUID (deny). Order matters:
--    super-admin is evaluated FIRST and never reaches the revocation branch.
CREATE OR REPLACE FUNCTION public.get_effective_imo_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $function$
  SELECT CASE
    WHEN public.is_super_admin() THEN
      -- Super-admin: read acting_imo_id from auth.users.raw_user_meta_data
      -- NULL when not acting (= "see all" escape hatch). UNCHANGED.
      (
        SELECT NULLIF(raw_user_meta_data->>'acting_imo_id', '')::uuid
        FROM auth.users
        WHERE id = auth.uid()
      )
    WHEN public.is_access_revoked(auth.uid()) THEN
      -- Revoked IMO, non-super-admin: sentinel that matches no real row -> deny.
      -- (NULL would re-enable the see-all hatch / COALESCE fallback; see header.)
      '00000000-0000-0000-0000-000000000000'::uuid
    ELSE
      -- Non-super-admin: always pinned to their real IMO, ignore claim/metadata.
      (SELECT imo_id FROM public.user_profiles WHERE id = auth.uid())
  END;
$function$;

-- get_my_imo_id() is intentionally NOT modified: its existing
-- COALESCE(get_effective_imo_id(), real_imo_id) now inherits the sentinel
-- (sentinel is non-null, so COALESCE returns it, not the real imo_id).
