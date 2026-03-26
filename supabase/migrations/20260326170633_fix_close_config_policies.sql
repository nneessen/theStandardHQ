-- Fix close_config RLS policies
-- 1. Service role policy needs WITH CHECK for INSERT/UPDATE
-- 2. GRANT should be SELECT/INSERT/UPDATE/DELETE, not ALL (no DDL)
-- 3. Revoke SELECT on api_key_encrypted from authenticated role (column-level security)

-- Drop and recreate service role policy with WITH CHECK
DROP POLICY IF EXISTS "Service role full access" ON close_config;
CREATE POLICY "Service role full access"
  ON close_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Tighten GRANT (remove DDL-level permissions)
REVOKE ALL ON close_config FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON close_config TO authenticated;

-- Column-level security: prevent authenticated role from reading the encrypted key
-- Only service_role (edge functions) can read it
REVOKE SELECT (api_key_encrypted) ON close_config FROM authenticated;
