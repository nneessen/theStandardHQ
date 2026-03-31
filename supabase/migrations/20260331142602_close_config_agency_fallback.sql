-- Close KPI: Allow non-owner agency users to share the agency owner's Close API key.
-- Previously, get_close_api_key only matched on the calling user's own close_config row.
-- Now falls back to the agency owner's row via user_profiles.agency_id -> agencies.owner_id.

-- 1. Update get_close_api_key to support agency-level fallback
CREATE OR REPLACE FUNCTION get_close_api_key(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT cc.api_key_encrypted
  FROM close_config cc
  WHERE cc.is_active = true
    AND (
      cc.user_id = p_user_id
      OR
      cc.user_id = (
        SELECT a.owner_id
        FROM user_profiles up
        JOIN agencies a ON a.id = up.agency_id
        WHERE up.id = p_user_id
        LIMIT 1
      )
    )
  ORDER BY (cc.user_id = p_user_id) DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_close_api_key(UUID) FROM public;
REVOKE ALL ON FUNCTION get_close_api_key(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_close_api_key(UUID) TO service_role;

-- 2. New RPC for frontend connection status check (does NOT expose api_key_encrypted)
CREATE OR REPLACE FUNCTION get_close_connection_status(p_user_id UUID)
RETURNS TABLE(id UUID, is_active BOOLEAN, organization_name TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT cc.id, cc.is_active, cc.organization_name
  FROM close_config cc
  WHERE cc.is_active = true
    AND (
      cc.user_id = p_user_id
      OR
      cc.user_id = (
        SELECT a.owner_id
        FROM user_profiles up
        JOIN agencies a ON a.id = up.agency_id
        WHERE up.id = p_user_id
        LIMIT 1
      )
    )
  ORDER BY (cc.user_id = p_user_id) DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_close_connection_status(UUID) FROM public;
GRANT EXECUTE ON FUNCTION get_close_connection_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_close_connection_status(UUID) TO service_role;
