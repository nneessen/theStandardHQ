-- supabase/migrations/20260429182119_contracting_manager_user_documents_rls.sql
-- Migration: Allow contracting managers to manage recruit documents within their IMO
--
-- Context: After fixing the recruiter UPDATE/DELETE policies (prior migration),
-- contracting managers also need access to approve/reject/upload documents for
-- recruits in their IMO — they staff the contracting pipeline alongside recruiters.
--
-- Scope follows the existing `contracting_managers_view_imo_recruits` pattern on
-- user_profiles: actor must have role `contracting_manager`, document owner must
-- be a `recruit` inside the actor's IMO.

-- SELECT: contracting managers see documents for recruits in their IMO
CREATE POLICY "Contracting managers can view recruit documents in IMO"
ON user_documents
FOR SELECT
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'contracting_manager')
  AND EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = user_documents.user_id
      AND up.imo_id = public.get_my_imo_id()
      AND up.imo_id IS NOT NULL
      AND 'recruit' = ANY(up.roles)
  )
);

COMMENT ON POLICY "Contracting managers can view recruit documents in IMO" ON user_documents IS
  'Allows users with the contracting_manager role to view documents belonging to recruits in their IMO.';

-- INSERT: contracting managers can upload documents on behalf of recruits in their IMO
CREATE POLICY "Contracting managers can insert recruit documents in IMO"
ON user_documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'contracting_manager')
  AND EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = user_documents.user_id
      AND up.imo_id = public.get_my_imo_id()
      AND up.imo_id IS NOT NULL
      AND 'recruit' = ANY(up.roles)
  )
);

COMMENT ON POLICY "Contracting managers can insert recruit documents in IMO" ON user_documents IS
  'Allows users with the contracting_manager role to upload documents for recruits in their IMO.';

-- UPDATE: contracting managers can approve/reject/edit recruit documents in their IMO
CREATE POLICY "Contracting managers can update recruit documents in IMO"
ON user_documents
FOR UPDATE
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'contracting_manager')
  AND EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = user_documents.user_id
      AND up.imo_id = public.get_my_imo_id()
      AND up.imo_id IS NOT NULL
      AND 'recruit' = ANY(up.roles)
  )
)
WITH CHECK (
  public.has_role((SELECT auth.uid()), 'contracting_manager')
  AND EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = user_documents.user_id
      AND up.imo_id = public.get_my_imo_id()
      AND up.imo_id IS NOT NULL
      AND 'recruit' = ANY(up.roles)
  )
);

COMMENT ON POLICY "Contracting managers can update recruit documents in IMO" ON user_documents IS
  'Allows users with the contracting_manager role to approve/reject/edit documents for recruits in their IMO.';

-- DELETE: contracting managers can remove recruit documents in their IMO
CREATE POLICY "Contracting managers can delete recruit documents in IMO"
ON user_documents
FOR DELETE
TO authenticated
USING (
  public.has_role((SELECT auth.uid()), 'contracting_manager')
  AND EXISTS (
    SELECT 1
    FROM user_profiles up
    WHERE up.id = user_documents.user_id
      AND up.imo_id = public.get_my_imo_id()
      AND up.imo_id IS NOT NULL
      AND 'recruit' = ANY(up.roles)
  )
);

COMMENT ON POLICY "Contracting managers can delete recruit documents in IMO" ON user_documents IS
  'Allows users with the contracting_manager role to delete documents for recruits in their IMO.';
