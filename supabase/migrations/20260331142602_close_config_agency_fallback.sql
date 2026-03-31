-- Close KPI: Each agent has their own Close account and API key.
-- get_close_api_key returns ONLY the user's own key — never another user's.
-- get_close_connection_status checks the user's own close_config only.

-- 1. get_close_api_key: user's own key only (no agency fallback — agents have individual accounts)
CREATE OR REPLACE FUNCTION get_close_api_key(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT cc.api_key_encrypted
  FROM close_config cc
  WHERE cc.user_id = p_user_id
    AND cc.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_close_api_key(UUID) FROM public;
REVOKE ALL ON FUNCTION get_close_api_key(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_close_api_key(UUID) TO service_role;

-- 2. get_close_connection_status: user's own connection only
CREATE OR REPLACE FUNCTION get_close_connection_status(p_user_id UUID)
RETURNS TABLE(id UUID, is_active BOOLEAN, organization_name TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT cc.id, cc.is_active, cc.organization_name
  FROM close_config cc
  WHERE cc.user_id = p_user_id
    AND cc.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_close_connection_status(UUID) FROM public;
GRANT EXECUTE ON FUNCTION get_close_connection_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_close_connection_status(UUID) TO service_role;
