-- ============================================================================
-- Drop 3 byte-identical duplicate indexes on user_profiles
-- ============================================================================
-- WHY: user_profiles carries 3 pairs of indexes with identical definitions.
-- Duplicates add write/VACUUM overhead and bloat without helping any read.
-- Confirmed identical via pg_indexes (normalized defs) and constraint-backing
-- via pg_constraint before dropping.
--
--   DROP idx_user_profiles_email        (keep unique_user_email     -- UNIQUE, constraint-backed)
--   DROP idx_user_profiles_recruiter    (keep idx_user_profiles_recruiter_id)
--   DROP idx_user_profiles_roles        (keep idx_user_profiles_roles_gin)
--
-- All three dropped indexes are plain (NOT constraint-backed), so DROP INDEX is
-- valid. Table is small; the brief ACCESS EXCLUSIVE lock is negligible.
-- No effect on RLS results or generated types. Rollback: recreate via CREATE INDEX.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_user_profiles_email;
DROP INDEX IF EXISTS public.idx_user_profiles_recruiter;
DROP INDEX IF EXISTS public.idx_user_profiles_roles;

COMMIT;
