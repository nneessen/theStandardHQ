-- RPC function to retrieve Close API key
-- Bypasses PostgREST schema cache (which may not see close_config table yet)
-- SECURITY DEFINER runs as the function owner (postgres), not the caller

CREATE OR REPLACE FUNCTION get_close_api_key(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT api_key_encrypted
  FROM close_config
  WHERE user_id = p_user_id
    AND is_active = true
  LIMIT 1;
$$;

-- Only service_role can call this — never expose to authenticated
REVOKE ALL ON FUNCTION get_close_api_key(UUID) FROM public;
REVOKE ALL ON FUNCTION get_close_api_key(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_close_api_key(UUID) TO service_role;
