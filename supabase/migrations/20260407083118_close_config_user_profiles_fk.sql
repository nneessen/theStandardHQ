-- Add FK from close_config.user_id to user_profiles.id
--
-- Required for PostgREST embedded-resource joins like:
--   .from("close_config").select("..., user_profiles!inner(...)")
-- which the get-team-call-stats edge function uses.
--
-- Without this FK, PostgREST cannot resolve the relationship and the embedded
-- join fails, causing the function to return HTTP 500. The Daily Calls tab on
-- the Close KPI page has been broken in production since the V4 refactor
-- (commit 6b44b10b) introduced the !inner syntax without adding the matching
-- database constraint.
--
-- Safe to apply: every existing close_config.user_id already maps to a
-- user_profiles.id (verified Apr 7 2026 — zero orphans on remote).
--
-- Note: this is in addition to the existing FK to auth.users(id). Both parents
-- share the same UUID space (user_profiles.id mirrors auth.users.id via the
-- handle_new_user() trigger), so there is no conflict — both FKs guard the
-- same value against different parent tables.

ALTER TABLE close_config
  ADD CONSTRAINT close_config_user_profiles_fkey
  FOREIGN KEY (user_id)
  REFERENCES user_profiles(id)
  ON DELETE CASCADE;

-- Force PostgREST to reload its schema cache so the new relationship is
-- visible to embedded-resource queries immediately (without waiting for the
-- periodic introspection poll).
NOTIFY pgrst, 'reload schema';
