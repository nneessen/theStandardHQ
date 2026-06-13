-- Rename persistency "cohort" terminology to "bucket" (internal naming only).
--
-- WHY: "cohort" is jargon nobody outside analytics recognizes. The function and
-- its output column are renamed for clarity. This is purely a naming change —
-- the logic (age-bounded persistency at the 3/6/9/12-month anniversaries) is
-- byte-for-byte identical to 20260613161247.
--
-- SAFE TO RENAME: the only caller is the dashboard persistency hook, whose
-- frontend is not yet deployed, so no live client depends on the old name.
--
--   get_user_persistency_cohorts()  ->  get_user_persistency_buckets()
--   output column  cohort_size       ->  issued_count

DROP FUNCTION IF EXISTS get_user_persistency_cohorts();

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
    ON p.tenure_months >= b.bucket_months
   AND p.tenure_months <  b.bucket_months + 3
  GROUP BY b.bucket_months
  ORDER BY b.bucket_months;
$$;

COMMENT ON FUNCTION get_user_persistency_buckets() IS
  'Per-user persistency at each milestone N in {3,6,9,12}, using the age-bounded bucket [N,N+3) months of tenure; persistency = active / issued (active+lapsed+cancelled). Returns one row per milestone with issued_count for sample-size transparency.';

GRANT EXECUTE ON FUNCTION get_user_persistency_buckets() TO authenticated;
