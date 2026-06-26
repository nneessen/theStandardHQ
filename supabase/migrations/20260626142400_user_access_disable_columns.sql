-- supabase/migrations/20260626142400_user_access_disable_columns.sql
-- Reversible "disable access" state mirror for team-member offboarding.
--
-- WHY: A team leader needs to cut a departed member's sign-in WITHOUT removing
-- them from the hierarchy (their production must still roll up). The real
-- enforcement is a Supabase auth ban (set in the set-member-access edge fn); these
-- columns are the UI/state mirror so the team roster can badge "Access disabled"
-- and offer Re-enable.
--
-- IMPORTANT: we deliberately do NOT reuse `archived_at` — that column is filtered
-- out of downline queries (HierarchyRepository.findDownlinesByHierarchyPath), so
-- using it would drop the member from team & commission rollups, which is exactly
-- what we must preserve. These columns have no effect on any hierarchy query.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS access_disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_disabled_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_disabled_reason TEXT;

COMMENT ON COLUMN user_profiles.access_disabled_at IS
  'When set, the member''s sign-in is reversibly banned (auth ban). UI/state mirror only — does NOT affect hierarchy/commission rollups. Cleared on re-enable.';
