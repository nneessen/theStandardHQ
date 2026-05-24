-- fix_admin_pending_users_archived_col.sql
-- ============================================================================
-- Replaces references to nonexistent `user_profiles.is_deleted` column with the
-- actual soft-delete column `archived_at`. Latent bug carried forward from the
-- pre-existing admin_get_pending_users / admin_get_user_profile bodies. Both
-- functions were silently broken on remote (any call would throw "column
-- up.is_deleted does not exist"); part3 migration faithfully preserved the bug
-- before this patch.
-- ============================================================================

BEGIN;

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
    AND up.archived_at IS NULL
    AND row_in_acting_scope(up.imo_id)
  ORDER BY up.created_at DESC;
END;
$function$;

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
    AND up.archived_at IS NULL
    AND row_in_acting_scope(up.imo_id);
END;
$function$;

COMMIT;
