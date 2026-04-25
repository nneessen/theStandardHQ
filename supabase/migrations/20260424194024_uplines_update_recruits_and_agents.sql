-- supabase/migrations/20260424194024_uplines_update_recruits_and_agents.sql
-- Allow direct uplines/recruiters to UPDATE their own downlines whose role is
-- 'recruit' OR 'agent'. Mirrors the DELETE widening in
-- 20260424181319_uplines_delete_recruits_and_agents.sql.
--
-- Supersedes the recruit-only behavior introduced in:
--   20260209184715_allow_uplines_update_recruits.sql

DROP POLICY IF EXISTS "Uplines can update own recruits" ON public.user_profiles;
DROP POLICY IF EXISTS "Recruiters can update own recruits" ON public.user_profiles;
DROP POLICY IF EXISTS "Uplines can update own recruits or agents" ON public.user_profiles;
DROP POLICY IF EXISTS "Recruiters can update own recruits or agents" ON public.user_profiles;

CREATE POLICY "Uplines can update own recruits or agents"
  ON public.user_profiles
  FOR UPDATE
  USING (
    auth.uid() = upline_id
    AND COALESCE(roles, ARRAY[]::text[]) && ARRAY['recruit', 'agent']::text[]
  )
  WITH CHECK (
    auth.uid() = upline_id
    AND COALESCE(roles, ARRAY[]::text[]) && ARRAY['recruit', 'agent']::text[]
  );

CREATE POLICY "Recruiters can update own recruits or agents"
  ON public.user_profiles
  FOR UPDATE
  USING (
    auth.uid() = recruiter_id
    AND COALESCE(roles, ARRAY[]::text[]) && ARRAY['recruit', 'agent']::text[]
  )
  WITH CHECK (
    auth.uid() = recruiter_id
    AND COALESCE(roles, ARRAY[]::text[]) && ARRAY['recruit', 'agent']::text[]
  );
