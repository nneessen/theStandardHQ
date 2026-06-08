-- ============================================================================
-- Benchmark: PolicyRepository JS-side aggregation vs DB-side aggregation
-- ============================================================================
-- Read-only. Safe to run against prod. Invoke via:
--   ./scripts/bench-policy-aggregates.sh [prod|local]
--
-- What it proves:
--   1. Whether any account exceeds PostgREST's 1000-row cap (correctness risk:
--      getAggregateMetrics / getMonthlyMetrics / getTotalAnnualPremiumByCarrier
--      compute sums/counts in JS over the *returned* rows, which PostgREST caps).
--   2. The latency + payload delta between the "fetch every row, reduce in JS"
--      pattern the repo uses today and a single in-DB aggregate (what an RPC
--      would do). \timing on the fetch-all query includes the wire transfer of
--      every row to the client — the cost the repo pays on every page load.
-- ============================================================================

\timing on
\pset pager off

\echo '============================================================'
\echo '1. POLICY COUNT DISTRIBUTION  (does anyone exceed the cap?)'
\echo '============================================================'
SELECT user_id,
       count(*)               AS policy_count,
       count(*) > 1000        AS exceeds_postgrest_cap
FROM policies
GROUP BY user_id
ORDER BY policy_count DESC
LIMIT 5;

\echo '============================================================'
\echo '2. WHOLE-TABLE SCALE  (getMonthlyMetrics & ByCarrier have NO'
\echo '   user filter -> they reduce over RLS-exposed rows in JS)'
\echo '============================================================'
-- "active" lives in lifecycle_status, NOT status (status only holds
-- approved/pending/withdrawn/denied) — same column the methods filter on.
SELECT count(*)                                              AS total_policies,
       count(*) FILTER (WHERE lifecycle_status = 'active')   AS active_rows,
       count(*) FILTER (WHERE lifecycle_status = 'active') > 1000
                                                            AS active_exceeds_cap
FROM policies;

\echo '============================================================'
\echo '3. HEAVIEST CARRIER  (getTotalAnnualPremiumByCarrier target)'
\echo '============================================================'
SELECT carrier_id,
       count(*) FILTER (WHERE lifecycle_status = 'active')   AS active_rows,
       count(*) FILTER (WHERE lifecycle_status = 'active') > 1000
                                                   AS exceeds_cap
FROM policies
WHERE carrier_id IS NOT NULL
GROUP BY carrier_id
ORDER BY active_rows DESC
LIMIT 3;

-- Capture the heaviest single account as a psql variable for the head-to-head.
SELECT user_id AS heavy_user, count(*) AS n
FROM policies
GROUP BY user_id
ORDER BY n DESC
LIMIT 1
\gset
-- An empty policies table leaves :heavy_user unset, which would make every
-- :'heavy_user' interpolation below raise "unset variable". Guard the whole
-- per-account head-to-head so the bench degrades cleanly on an empty DB.
\if :{?heavy_user}
\echo ''
\echo 'Head-to-head subject (heaviest account):' :'heavy_user'
\echo 'Rows that account pulls into the browser per metrics load:' :n
\echo ''

\echo '============================================================'
\echo '4a. CURRENT  -- count:exact head request (totalPolicies)'
\echo '============================================================'
EXPLAIN (ANALYZE, BUFFERS, TIMING ON)
SELECT count(*) FROM policies WHERE user_id = :'heavy_user';

\echo '============================================================'
\echo '4b. CURRENT  -- fetch every matching row (reduced in JS)'
\echo '    plan shows rows + bytes shipped to the client'
\echo '============================================================'
EXPLAIN (ANALYZE, BUFFERS, TIMING ON)
SELECT status, lifecycle_status, annual_premium, effective_date
FROM policies WHERE user_id = :'heavy_user';

\echo '============================================================'
\echo '5. OPTIMIZED -- single-row in-DB aggregate (RPC equivalent)'
\echo '    same numbers getAggregateMetrics computes, one round trip'
\echo '============================================================'
EXPLAIN (ANALYZE, BUFFERS, TIMING ON)
SELECT
  count(*)                                                              AS total_policies,
  count(*) FILTER (WHERE lifecycle_status = 'active')                   AS active_policies,
  count(*) FILTER (WHERE status = 'pending')                           AS pending_policies,
  count(*) FILTER (WHERE lifecycle_status = 'lapsed')                  AS lapsed_policies,
  count(*) FILTER (WHERE lifecycle_status = 'cancelled')               AS cancelled_policies,
  coalesce(sum(annual_premium), 0)                                     AS total_premium,
  -- JS divides by ALL rows (policies.length), not avg()'s non-null count.
  coalesce(sum(annual_premium) / nullif(count(*), 0), 0)               AS avg_premium,
  count(*) FILTER (WHERE date_part('year', effective_date)
                          = date_part('year', now()))                  AS ytd_policies,
  coalesce(sum(annual_premium) FILTER (WHERE date_part('year', effective_date)
                          = date_part('year', now())), 0)              AS ytd_premium
FROM policies
WHERE user_id = :'heavy_user';

\echo '============================================================'
\echo '6. WALL-CLOCK head-to-head (results -> /dev/null, x3 each).'
\echo '   FETCH-ALL transfers every row; AGGREGATE transfers one.'
\echo '   Compare the Time: lines printed by \timing below.'
\echo '============================================================'
\o /dev/null
\echo '--- fetch-all run 1/3 ---'
SELECT status, lifecycle_status, annual_premium, effective_date FROM policies WHERE user_id = :'heavy_user';
\echo '--- fetch-all run 2/3 ---'
SELECT status, lifecycle_status, annual_premium, effective_date FROM policies WHERE user_id = :'heavy_user';
\echo '--- fetch-all run 3/3 ---'
SELECT status, lifecycle_status, annual_premium, effective_date FROM policies WHERE user_id = :'heavy_user';
\echo '--- aggregate run 1/3 ---'
SELECT count(*) FILTER (WHERE lifecycle_status='active'), coalesce(sum(annual_premium),0) FROM policies WHERE user_id = :'heavy_user';
\echo '--- aggregate run 2/3 ---'
SELECT count(*) FILTER (WHERE lifecycle_status='active'), coalesce(sum(annual_premium),0) FROM policies WHERE user_id = :'heavy_user';
\echo '--- aggregate run 3/3 ---'
SELECT count(*) FILTER (WHERE lifecycle_status='active'), coalesce(sum(annual_premium),0) FROM policies WHERE user_id = :'heavy_user';
\o
\else
\echo ''
\echo 'No policies rows found — skipped the per-account head-to-head (steps 4-6).'
\endif
\echo ''
\echo 'Done. Headline = rows shipped (step 4b vs 5) + cap flags (steps 1-3).'
