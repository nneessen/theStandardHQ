-- Contracting "Recent activity" (Downline Activity panel) — scope to the caller's downline ONLY.
--
-- REQUEST (owner): the "Recent activity" feed on the Contracting page must show ONLY the
-- viewer's downline/team activity — never agents who aren't on their team.
--
-- ROOT CAUSE: get_contracting_activity() had two whole-org branches in its WHERE clause —
-- super_admin_in_scope(imo_id) and (is_imo_admin() AND imo = get_my_imo_id()) — so any admin
-- (e.g. the owner, a super-admin) saw contracting activity for EVERY agent in the org/IMO,
-- including people outside their hierarchy. The panel is titled "Downline Activity", so this
-- whole-org bleed is wrong for this surface.
--
-- FIX: keep ONLY the subtree predicate is_upline_of(cc.agent_id). This is strictly NARROWING
-- (a SECURITY DEFINER WHERE clause can now only return FEWER rows) so there is no data-leak
-- risk. Verified on real data: is_upline_of's hierarchy_path subtree == the true recursive
-- downline exactly (0 extra / 0 missing) for a mid-level Epic Life manager.
--
-- NOTE: the sibling "Under a different upline" feed (get_downline_sponsorships) intentionally
-- keeps its admin whole-IMO branches — only "Recent activity" was reported.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_contracting_activity(p_limit integer DEFAULT 50)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  upline_id uuid,
  carrier_id uuid,
  carrier_name text,
  status text,
  writing_number text,
  submitted_date date,
  approved_date date,
  updated_at timestamptz,
  activity_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cc.agent_id,
    COALESCE(NULLIF(CONCAT_WS(' ', up.first_name, up.last_name), ''), up.email),
    up.upline_id,
    cc.carrier_id,
    c.name::text,
    cc.status,
    cc.writing_number,
    cc.submitted_date,
    cc.approved_date,
    cc.updated_at,
    GREATEST(
      cc.updated_at,
      cc.created_at,
      cc.submitted_date::timestamptz,
      cc.approved_date::timestamptz
    )
  FROM carrier_contracts cc
  JOIN user_profiles up ON up.id = cc.agent_id
  JOIN carriers c ON c.id = cc.carrier_id
  WHERE is_upline_of(cc.agent_id)
  ORDER BY 11 DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_contracting_activity(integer) TO authenticated;

COMMENT ON FUNCTION public.get_contracting_activity IS
  'Current-state recent contracting activity across the caller''s downline subtree ONLY (is_upline_of). No whole-org admin branch: the "Downline Activity" panel must show team activity only. Ordered by most-recent change. No history table — derives from carrier_contracts current state.';

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_contracting_activity', '20260619135313')
ON CONFLICT (function_name) DO UPDATE SET current_version = EXCLUDED.current_version, updated_at = NOW();

NOTIFY pgrst, 'reload schema';

COMMIT;
