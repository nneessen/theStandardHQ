-- supabase/migrations/20260429182026_fix_recruiter_documents_update_delete_rls.sql
-- Migration: Fix UPDATE and DELETE RLS policies for recruiters on user_documents
--
-- Problem: The "Recruiters can update/delete their recruits' documents" policies
-- have the same inverted logic that broke the SELECT policy (fixed Feb 20, 2026).
-- The current USING clause is:
--   auth.uid() IN (
--     SELECT user_documents.user_id
--     FROM user_profiles
--     WHERE user_profiles.id = (SELECT recruiter_id FROM user_profiles WHERE id = user_documents.user_id)
--   )
-- The outer SELECT projects user_documents.user_id (the recruit's id) regardless of
-- the join, so the predicate collapses to auth.uid() = recruit's user_id. Recruiters
-- can never satisfy it, so doc approval/rejection PATCH returns 406 "Cannot coerce
-- the result to a single JSON object".
--
-- Fix: Replace USING with the same shape the SELECT fix used:
--   auth.uid() = (SELECT recruiter_id FROM user_profiles WHERE id = user_documents.user_id)

-- UPDATE policy
DROP POLICY IF EXISTS "Recruiters can update their recruits' documents" ON user_documents;

CREATE POLICY "Recruiters can update their recruits' documents"
ON user_documents
FOR UPDATE
TO authenticated
USING (
  auth.uid() = (
    SELECT recruiter_id
    FROM user_profiles
    WHERE id = user_documents.user_id
  )
)
WITH CHECK (
  auth.uid() = (
    SELECT recruiter_id
    FROM user_profiles
    WHERE id = user_documents.user_id
  )
);

COMMENT ON POLICY "Recruiters can update their recruits' documents" ON user_documents IS
  'Allows recruiters to update (approve/reject/edit notes on) documents uploaded by their recruits';

-- DELETE policy (same broken pattern, same fix)
DROP POLICY IF EXISTS "Recruiters can delete their recruits' documents" ON user_documents;

CREATE POLICY "Recruiters can delete their recruits' documents"
ON user_documents
FOR DELETE
TO authenticated
USING (
  auth.uid() = (
    SELECT recruiter_id
    FROM user_profiles
    WHERE id = user_documents.user_id
  )
);

COMMENT ON POLICY "Recruiters can delete their recruits' documents" ON user_documents IS
  'Allows recruiters to delete documents uploaded by their recruits';
