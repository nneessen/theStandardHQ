-- Dashboard metrics: current-month chargebacks + anniversary-cohort persistency
--
-- WHY (chargebacks):
--   The dashboard "flags" alert was wired to commission_chargeback_summary, an
--   ALL-TIME aggregate over every commission row. That is why the chargeback
--   count never changed month to month. Chargebacks are an event that happens in
--   a given month; the alert should report only the CURRENT calendar month's
--   chargebacks (rows whose chargeback_date falls in this month). We add a new
--   per-user RPC for that and leave the all-time view untouched (it is a
--   legitimate portfolio metric used elsewhere, e.g. edge-function briefings).
--
-- WHY (persistency):
--   Persistency (% of issued policies still in force) had no surface anywhere in
--   the app despite being a core insurance KPI. There is no lapse-date / status
--   transition history in the data (audit_log logs zero lifecycle_status
--   changes), so true "survival to month N" is not computable. We use the
--   ANNIVERSARY-COHORT method the owner selected: for each milestone N in
--   {3,6,9,12}, the cohort is policies whose tenure (full months since
--   effective_date) falls in the bounded band [N, N+3). Among that age-bounded
--   cohort, persistency = currently-active / issued. Bounding the cohort by age
--   keeps "active now" a faithful proxy for "survived to ~N months" and prevents
--   a late lapse (e.g. a policy that lapsed at month 20) from contaminating the
--   shorter-tenure buckets.
--
--   Population matches the existing teamAnalyticsService formula:
--   issued = active + lapsed + cancelled (pending / expired / null excluded).
--   'expired' is natural term-end, not a lapse, so it is excluded.
--
-- Both functions are SECURITY DEFINER + scoped to auth.uid() (per-user), mirroring
-- the other get_user_* report RPCs.

--------------------------------------------------------------------------------
-- 1. Current-month chargebacks (per authenticated user)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_current_month_chargebacks()
RETURNS TABLE (
  chargeback_count  bigint,
  chargeback_amount numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    count(*)                          AS chargeback_count,
    COALESCE(sum(c.chargeback_amount), 0) AS chargeback_amount
  FROM commissions c
  WHERE c.user_id = auth.uid()
    AND c.chargeback_amount > 0
    AND c.chargeback_date IS NOT NULL
    AND date_trunc('month', c.chargeback_date)
        = date_trunc('month', CURRENT_DATE);
$$;

COMMENT ON FUNCTION get_user_current_month_chargebacks() IS
  'Per-user count + summed amount of chargebacks whose chargeback_date is in the current calendar month (not all-time).';

GRANT EXECUTE ON FUNCTION get_user_current_month_chargebacks() TO authenticated;

--------------------------------------------------------------------------------
-- 2. Anniversary-cohort persistency at 3 / 6 / 9 / 12 months (per authenticated user)
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_persistency_cohorts()
RETURNS TABLE (
  bucket_months    int,
  cohort_size      bigint,
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
    count(p.*)                                                       AS cohort_size,
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

COMMENT ON FUNCTION get_user_persistency_cohorts() IS
  'Per-user anniversary-cohort persistency. Each milestone N in {3,6,9,12} uses the age-bounded cohort [N,N+3) months of tenure; persistency = active / issued (active+lapsed+cancelled). Returns one row per milestone with cohort_size for sample-size transparency.';

GRANT EXECUTE ON FUNCTION get_user_persistency_cohorts() TO authenticated;
