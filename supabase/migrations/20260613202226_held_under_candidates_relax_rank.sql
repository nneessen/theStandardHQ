-- Contracting — relax the held_under candidate filter.
--
-- The first cut only returned agents who OUTRANK the target agent, which left the
-- picker empty for top-level users (nobody outranks them) — and was stricter than the
-- set_contracted_under write guard, which already allows any same-IMO, non-self,
-- non-downline person. "Held under a different upline" is a real-world arrangement that
-- isn't bounded by contract level, so drop the rank filter. Keep the cycle guard
-- (exclude the agent's own downline) and same-IMO scope. Order higher levels first so
-- likely uplines surface at the top.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_held_under_candidates(p_agent_id uuid)
RETURNS TABLE (agent_id uuid, agent_name text, contract_level integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller     uuid := auth.uid();
  v_agent_imo  uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT imo_id INTO v_agent_imo FROM user_profiles WHERE id = p_agent_id;
  IF v_agent_imo IS NULL THEN
    RETURN;  -- unknown agent → empty
  END IF;

  -- Authorization: agent self, their upline, IMO staff, or super-admin.
  IF NOT (
    v_caller = p_agent_id
    OR is_super_admin()
    OR is_upline_of(p_agent_id)
    OR EXISTS (
      SELECT 1 FROM user_profiles caller
      WHERE caller.id = v_caller
        AND caller.imo_id = v_agent_imo
        AND (caller.roles @> ARRAY['trainer']::text[]
             OR caller.roles @> ARRAY['contracting_manager']::text[]
             OR caller.is_admin = true)
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT up.id,
         COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email),
         up.contract_level
  FROM user_profiles up
  WHERE up.imo_id = v_agent_imo
    AND up.id <> p_agent_id
    -- exclude the agent's own downline (would create an override cycle)
    AND NOT (up.hierarchy_path IS NOT NULL
             AND up.hierarchy_path LIKE '%' || p_agent_id::text || '%')
  ORDER BY up.contract_level DESC NULLS LAST, up.last_name, up.first_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_held_under_candidates(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_held_under_candidates(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_held_under_candidates IS
'Candidate "other uplines" for the held_under picker: same-IMO agents other than the agent, excluding the agent''s own downline (cycle guard). NOT rank-limited (matches the set_contracted_under write guard). Caller must be the agent, their upline, or IMO staff/super-admin.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_held_under_candidates', '20260613202226')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
