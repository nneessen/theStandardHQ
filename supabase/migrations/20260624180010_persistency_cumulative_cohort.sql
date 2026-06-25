-- Persistency buckets: switch from DISJOINT bands to CUMULATIVE cohorts.
--
-- THE BUG (both get_user_persistency_buckets and get_team_persistency_buckets):
-- each policy was placed in exactly one disjoint band by its CURRENT tenure,
-- [N, N+3) months — i.e. the join was
--     ON p.tenure_months >= b.bucket_months
--    AND p.tenure_months <  b.bucket_months + 3
-- Consequences:
--   * The "12-month" milestone only counted policies currently aged 12–15
--     months; everything older was silently excluded. As the book ages this
--     drops a growing share of business from the milestone entirely.
--   * The bands were disjoint slices, NOT the cumulative cohorts the UI copy
--     promises: "Of the policies that have REACHED each age, the share still in
--     force." A policy aged 6 months never appeared in the 3-month cohort even
--     though it has, by definition, reached 3 months.
--
-- THE FIX (cumulative cohort — matches the UI copy):
-- for milestone N, the cohort is EVERY issued policy that has reached N months
-- of tenure (tenure_months >= N). Persistency = active / reached. These cohorts
-- are nested (the 12-mo denominator includes all policies >= 12 months old).
-- Only the join's upper bound is removed; everything else is unchanged.
--
-- NO LAPSE-DATE CAVEAT (intentional, documented): the data has no lapse
-- timestamp, so a currently-lapsed/cancelled policy counts as "not active" at
-- every milestone it has passed. The curve can therefore be slightly
-- non-monotonic and overstates early lapses a touch. This is the honest reading
-- of the available data and is far more correct than the disjoint bands. A true
-- age-at-termination survival curve would require a real lapsed_at column.
--
-- Signatures (name, args, return columns) are unchanged, so the frontend hook
-- and database.types.ts need no change.

-- ── Per-user (own book only) ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_persistency_buckets()
RETURNS TABLE (
  bucket_months    int,
  issued_count     bigint,
  active_count     bigint,
  persistency_rate numeric
)
LANGUAGE sql
SECURITY DEFINER
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
    WHERE user_id = auth.uid()
      AND effective_date IS NOT NULL
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
    ON p.tenure_months >= b.bucket_months   -- cumulative cohort: reached N months
  GROUP BY b.bucket_months
  ORDER BY b.bucket_months;
$$;

COMMENT ON FUNCTION get_user_persistency_buckets() IS
  'Per-user persistency at each milestone N in {3,6,9,12} as a CUMULATIVE cohort: of policies that have reached N months of tenure (active+lapsed+cancelled), the share still active. Returns one row per milestone with issued_count for sample-size transparency.';

GRANT EXECUTE ON FUNCTION get_user_persistency_buckets() TO authenticated;

-- ── Team (own + downline via RLS) ────────────────────────────────────────────
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
    ON p.tenure_months >= b.bucket_months   -- cumulative cohort: reached N months
  GROUP BY b.bucket_months
  ORDER BY b.bucket_months;
$$;

COMMENT ON FUNCTION get_team_persistency_buckets() IS
  'Team-wide persistency (own + downline via policies RLS) at each milestone N in {3,6,9,12} as a CUMULATIVE cohort: of policies that have reached N months of tenure, the share still active. SECURITY INVOKER so RLS does the team scoping. Returns one row per milestone with issued_count.';

GRANT EXECUTE ON FUNCTION get_team_persistency_buckets() TO authenticated;
