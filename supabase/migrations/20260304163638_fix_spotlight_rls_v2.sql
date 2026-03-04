-- Fix spotlight RLS: use is_super_admin boolean (not roles array)
-- Matches pattern used by all other policies in this codebase

DROP POLICY IF EXISTS "Super admins can view all spotlights" ON feature_spotlights;
DROP POLICY IF EXISTS "Users can view active spotlights" ON feature_spotlights;
DROP POLICY IF EXISTS "Super admins can insert spotlights" ON feature_spotlights;
DROP POLICY IF EXISTS "Super admins can update spotlights" ON feature_spotlights;
DROP POLICY IF EXISTS "Super admins can delete spotlights" ON feature_spotlights;

-- SELECT: super admins see all, regular users see active only
CREATE POLICY "Super admins can view all spotlights"
  ON feature_spotlights FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "Users can view active spotlights"
  ON feature_spotlights FOR SELECT TO authenticated
  USING (is_active = true);

-- INSERT: super admins only
CREATE POLICY "Super admins can insert spotlights"
  ON feature_spotlights FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true));

-- UPDATE: super admins only
CREATE POLICY "Super admins can update spotlights"
  ON feature_spotlights FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true));

-- DELETE: super admins only
CREATE POLICY "Super admins can delete spotlights"
  ON feature_spotlights FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true));

-- Also fix user_spotlight_views super admin policy
DROP POLICY IF EXISTS "Super admins can view all spotlight views" ON user_spotlight_views;
CREATE POLICY "Super admins can view all spotlight views"
  ON user_spotlight_views FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_admin = true));
