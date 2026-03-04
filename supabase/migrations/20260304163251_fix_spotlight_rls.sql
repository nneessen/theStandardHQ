-- Fix spotlight RLS: replace FOR ALL with explicit per-operation policies
-- The FOR ALL policy wasn't properly granting UPDATE/DELETE to super_admins

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view active spotlights" ON feature_spotlights;
DROP POLICY IF EXISTS "Super admins full access to spotlights" ON feature_spotlights;

-- Super admins: SELECT all (including inactive)
CREATE POLICY "Super admins can view all spotlights"
  ON feature_spotlights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND 'super_admin'::text = ANY(user_profiles.roles)
    )
  );

-- Regular users: SELECT active only
CREATE POLICY "Users can view active spotlights"
  ON feature_spotlights FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Super admins: INSERT
CREATE POLICY "Super admins can insert spotlights"
  ON feature_spotlights FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND 'super_admin'::text = ANY(user_profiles.roles)
    )
  );

-- Super admins: UPDATE
CREATE POLICY "Super admins can update spotlights"
  ON feature_spotlights FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND 'super_admin'::text = ANY(user_profiles.roles)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND 'super_admin'::text = ANY(user_profiles.roles)
    )
  );

-- Super admins: DELETE
CREATE POLICY "Super admins can delete spotlights"
  ON feature_spotlights FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND 'super_admin'::text = ANY(user_profiles.roles)
    )
  );
