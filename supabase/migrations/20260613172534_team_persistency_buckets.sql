-- Team-wide persistency at the 3/6/9/12-month milestones (manager view).
--
-- Companion to get_user_persistency_buckets() (which is per-user, scoped to
-- auth.uid()). This one is for the Analytics page, where a manager wants to see
-- their whole team's retention — their own book PLUS their downline's.
--
-- HOW THE TEAM SCOPING WORKS — it leans entirely on existing RLS:
--   The `policies` table already has SELECT RLS that returns own rows + any row
--   where is_upline_of(user_id) (downline) + IMO-admin rows, all IMO-scoped
--   (see 20260521213701_harden_imo_scoped_operational.sql). So this function is
--   SECURITY INVOKER (NOT definer) and simply omits the user_id filter: RLS then
--   returns exactly the set of policies the caller is allowed to see — own +
--   downline. No hierarchy_path / imo_id logic is re-implemented here, so it
--   cannot drift from the canonical RLS rules. For a solo agent (no downline)
--   this naturally returns the same numbers as the per-user function.
--
-- The bucket math is byte-for-byte identical to get_user_persistency_buckets:
-- milestone N in {3,6,9,12} -> age-bounded band [N, N+3) months of tenure;
-- persistency = active / issued (active+lapsed+cancelled; pending/expired/null
-- excluded).

CREATE OR REPLACE FUNCTION get_team_persistency_buckets()
RETURNS TABLE (
  bucket_months    int,
  issued_count     bigint,
  active_count     bigint,
  persistency_rate numeric
)
LANGUAGE sql
SECURITY INVOKER          -- run as the caller so policies RLS (own + downline) applies
SET search_path = public
STABLE
AS $$
  WITH buckets(bucket_months) AS (
    VALUES (3), (6), (9), (12)
  ),
  pol AS (
    SELECT
      lifecycle_status,
      ( EXTRACT(year  FROM age(CURRENT_DATE, effective_date)) * 12
      + EXTRACT(month FROM age(CURRENT_DATE, effective_date)) )::int AS tenure_months
    FROM policies
    -- No user_id filter: RLS returns own + downline (+ IMO admin) rows only.
    WHERE effective_date IS NOT NULL
      AND effective_date <= CURRENT_DATE
      AND lifecycle_status IN ('active', 'lapsed', 'cancelled')
  )
  SELECT
    b.bucket_months,
    count(p.*)                                                       AS issued_count,
    count(p.*) FILTER (WHERE p.lifecycle_status = 'active')          AS active_count,
    round(
      100.0 * count(p.*) FILTER (WHERE p.lifecycle_status = 'active')
            / NULLIF(count(p.*), 0),
      1
    )                                                                AS persistency_rate
  FROM buckets b
  LEFT JOIN pol p
    ON p.tenure_months >= b.bucket_months
   AND p.tenure_months <  b.bucket_months + 3
  GROUP BY b.bucket_months
  ORDER BY b.bucket_months;
$$;

COMMENT ON FUNCTION get_team_persistency_buckets() IS
  'Team-wide persistency (own + downline via policies RLS) at each milestone N in {3,6,9,12}, age-bounded band [N,N+3) months; persistency = active / issued. SECURITY INVOKER so RLS does the team scoping. Returns one row per milestone with issued_count.';

GRANT EXECUTE ON FUNCTION get_team_persistency_buckets() TO authenticated;
