-- get_my_team_leaderboard — per-member production leaderboard for the CALLER's OWN
-- team (the caller + their downline subtree), tenant-scoped.
--
-- WHY: the assistant's "who is leading on my team" / coaching path called
-- get_team_leaderboard_data, which returns EVERY team leader in the IMO (it filters
-- only by imo + HAVING COUNT(downlines) >= N, with NO caller filter) — so "my team"
-- surfaced other teams. This RPC mirrors get_command_center_summary's tenancy EXACTLY
-- (scope derived from auth.uid(); downline subtree intersected with the caller's
-- imo_id), so per-member rows reconcile to that aggregate and never cross a team or
-- IMO boundary. Scope is NEVER a caller argument — the model cannot widen it.
--
-- Semantics match the leaderboard family (see get_leaderboard_data):
--   IP = approved policies by effective_date (tolerant of lifecycle_status = NULL)
--   AP = ALL submitted policies by submit_date
-- The caller is included (they are part of their own team). Output is capped at
-- p_limit top members PLUS the caller's own row, so a large downline never floods
-- the caller / the assistant context.

CREATE OR REPLACE FUNCTION public.get_my_team_leaderboard(
  p_start_date date DEFAULT (date_trunc('month', CURRENT_DATE::timestamptz))::date,
  p_end_date date DEFAULT CURRENT_DATE,
  p_limit integer DEFAULT 25
)
RETURNS TABLE(
  member_id uuid,
  member_name text,
  ip_total numeric,
  ap_total numeric,
  policy_count bigint,
  rank_overall bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '10s'
AS $function$
DECLARE
  v_uid uuid;
  v_path text;
  v_imo uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN; -- no auth context -> no rows
  END IF;

  SELECT up.hierarchy_path, up.imo_id
    INTO v_path, v_imo
  FROM user_profiles up
  WHERE up.id = v_uid;

  RETURN QUERY
  WITH scope_users AS (
    -- Always include the caller; add the downline subtree only when the caller's
    -- hierarchy_path is non-null (NULL || '.%' is NULL -> matches nobody, so guard
    -- it). The subtree is intersected with the caller's imo_id so a path that
    -- crosses an IMO boundary never pulls another tenant's rows. This is the SAME
    -- scope set get_command_center_summary('team') uses, so the per-member rows here
    -- sum to that aggregate.
    SELECT v_uid AS uid
    UNION
    SELECT up.id
    FROM user_profiles up
    WHERE v_path IS NOT NULL
      AND up.hierarchy_path LIKE v_path || '.%'
      AND up.imo_id = v_imo
  ),
  member_agg AS (
    SELECT
      su.uid AS member_id,
      COALESCE(SUM(p.annual_premium) FILTER (
        WHERE p.status = 'approved'
          AND p.effective_date IS NOT NULL
          AND p.effective_date >= p_start_date
          AND p.effective_date <= p_end_date
      ), 0)::numeric AS ip_total,
      COALESCE(SUM(p.annual_premium) FILTER (
        WHERE p.submit_date IS NOT NULL
          AND p.submit_date >= p_start_date
          AND p.submit_date <= p_end_date
      ), 0)::numeric AS ap_total,
      COUNT(p.id) FILTER (
        WHERE p.status = 'approved'
          AND p.effective_date IS NOT NULL
          AND p.effective_date >= p_start_date
          AND p.effective_date <= p_end_date
      )::bigint AS policy_count
    FROM scope_users su
    LEFT JOIN policies p ON p.user_id = su.uid
    GROUP BY su.uid
  ),
  ranked AS (
    SELECT
      ma.member_id,
      COALESCE(
        NULLIF(TRIM(COALESCE(up.first_name, '') || ' ' || COALESCE(up.last_name, '')), ''),
        up.email
      ) AS member_name,
      ma.ip_total,
      ma.ap_total,
      ma.policy_count,
      DENSE_RANK() OVER (
        ORDER BY ma.ip_total DESC, ma.policy_count DESC,
          COALESCE(
            NULLIF(TRIM(COALESCE(up.first_name, '') || ' ' || COALESCE(up.last_name, '')), ''),
            up.email
          ) ASC
      )::bigint AS rank_overall
    FROM member_agg ma
    JOIN user_profiles up ON up.id = ma.member_id
  )
  -- Cap at the top p_limit, but ALWAYS include the caller's own row even if it falls
  -- outside the top N (so "how do I stack up" / coaching always sees the caller).
  SELECT r.member_id, r.member_name, r.ip_total, r.ap_total, r.policy_count, r.rank_overall
  FROM ranked r
  WHERE r.rank_overall <= GREATEST(p_limit, 1)
     OR r.member_id = v_uid
  ORDER BY r.rank_overall ASC, r.member_name ASC;
END;
$function$;

COMMENT ON FUNCTION get_my_team_leaderboard IS 'Per-member production leaderboard for the CALLER''s own team (caller + downline subtree intersected with the caller''s imo_id), derived from auth.uid() — never another team. IP = approved policies by effective_date (tolerant of lifecycle_status=NULL); AP = ALL submitted policies by submit_date. Capped at p_limit top members plus the caller''s own row. Mirrors get_command_center_summary tenancy.';

REVOKE EXECUTE ON FUNCTION public.get_my_team_leaderboard(date, date, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_team_leaderboard(date, date, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_leaderboard(date, date, integer) TO authenticated;

INSERT INTO supabase_migrations.function_versions (function_name, current_version)
VALUES ('get_my_team_leaderboard', '20260601191455')
ON CONFLICT (function_name) DO UPDATE SET
  current_version = EXCLUDED.current_version,
  updated_at = NOW();
