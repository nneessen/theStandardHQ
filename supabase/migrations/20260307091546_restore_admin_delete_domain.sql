-- Restore admin_delete_domain RPC
-- This function was erroneously dropped in 20260214113000_drop_rpc_batch00_candidates.sql
-- It is still called by the custom-domain-delete Edge Function (line 114)

CREATE OR REPLACE FUNCTION admin_delete_domain(
  p_domain_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  DELETE FROM custom_domains
  WHERE id = p_domain_id AND user_id = p_user_id;

  RETURN FOUND;
END;
$$;

-- Restrict access: only service_role (via Edge Functions) should call this
REVOKE EXECUTE ON FUNCTION admin_delete_domain FROM PUBLIC;
