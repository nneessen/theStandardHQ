-- get_team_member_ids — returns the set of user_ids the caller is authorized
-- to monitor in the Close KPIs Team tab.
--
-- Used by the get-team-call-stats edge function to know which agents to fan
-- out Close API calls to. Same access logic as user_can_view_team_tab and
-- get_team_pipeline_snapshot — kept as a separate, narrow function so the
-- edge function only learns the UUIDs (not the aggregated row shape).
--
-- Access:
--   - super-admin: all users with active close_config (excluding archived)
--   - non-admin:   caller (if has close_config) + downlines via hierarchy_path
--                  (downlines must also have active close_config + not archived)
--
-- Granted to authenticated so the frontend can call it directly if it ever
-- needs to know the team set without invoking the edge function.

BEGIN;

CREATE OR REPLACE FUNCTION get_team_member_ids()
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_caller   UUID := auth.uid();
  v_is_admin BOOLEAN := is_super_admin();
  v_ids      UUID[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_is_admin THEN
    SELECT array_agg(cc.user_id) INTO v_ids
      FROM close_config cc
      JOIN user_profiles up ON up.id = cc.user_id
     WHERE cc.is_active = true
       AND up.archived_at IS NULL;
  ELSE
    SELECT array_agg(up.id) INTO v_ids
      FROM user_profiles up
      JOIN close_config cc ON cc.user_id = up.id
     WHERE cc.is_active = true
       AND up.archived_at IS NULL
       AND (
         up.id = v_caller
         OR (up.hierarchy_path IS NOT NULL
             AND up.hierarchy_path LIKE '%' || v_caller::text || '%'
             AND up.id != v_caller)
       );
  END IF;

  RETURN COALESCE(v_ids, ARRAY[]::UUID[]);
END;
$$;

REVOKE ALL ON FUNCTION get_team_member_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_team_member_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION get_team_member_ids() TO service_role;

COMMENT ON FUNCTION get_team_member_ids() IS
  'Returns UUID[] of agents the caller is authorized to monitor (caller + downlines via hierarchy_path; super-admin sees all close-connected users). Used by get-team-call-stats edge function for fan-out.';

COMMIT;
