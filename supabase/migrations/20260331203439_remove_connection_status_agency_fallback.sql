-- Remove agency-owner fallback from get_close_connection_status.
-- Each agent has their own Close CRM account — showing the agency owner's
-- org name when a user hasn't connected is misleading and leaks metadata.
-- Now returns ONLY the calling user's own close_config row.

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
    WHERE cc.user_id = p_user_id
      AND cc.is_active = true
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION get_close_connection_status(UUID) FROM public;
GRANT EXECUTE ON FUNCTION get_close_connection_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_close_connection_status(UUID) TO service_role;
