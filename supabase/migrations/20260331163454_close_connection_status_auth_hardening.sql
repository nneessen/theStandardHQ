-- Fix: get_close_connection_status cross-tenant metadata leak
-- Previously, any authenticated user could query another user's Close connection status
-- by passing an arbitrary p_user_id. Now enforces auth.uid() = p_user_id.
-- Pattern matches the fix in 20260330100310_fix_avg_score_rpc_security.sql.

CREATE OR REPLACE FUNCTION get_close_connection_status(p_user_id UUID)
RETURNS TABLE(id UUID, is_active BOOLEAN, organization_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Enforce caller can only query their own connection status
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied: cannot query another user''s connection status';
  END IF;

  RETURN QUERY
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
END;
$$;

REVOKE ALL ON FUNCTION get_close_connection_status(UUID) FROM public;
GRANT EXECUTE ON FUNCTION get_close_connection_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_close_connection_status(UUID) TO service_role;
