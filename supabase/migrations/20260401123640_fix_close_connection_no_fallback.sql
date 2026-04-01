-- Fix: get_close_connection_status was returning agency owner's close_config
-- as a fallback, making non-owner agents think they were "Connected" when they
-- had no close_config row of their own. This prevented them from ever being
-- prompted to enter their own Close API key.
--
-- Each agent has their own Close CRM account. Connection status must reflect
-- ONLY the user's own row — no agency fallback.

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
