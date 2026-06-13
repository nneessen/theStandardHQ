-- Drop the dead cohort-retention reporting layer.
--
-- WHY: `mv_cohort_retention` + `get_user_cohort_retention()` backed the old
-- analytics retention heatmap (CohortAnalysis / CohortHeatmap), which has been
-- removed. Nothing references either object anymore — no frontend code, no edge
-- functions, no cron refresh job, and no other DB object depends on the view.
--
-- It was also broken: it filtered `status = 'active'/'lapsed'/'cancelled'`, but
-- `status` is the application enum (pending/approved/denied) — the lifecycle
-- values live in `lifecycle_status`. So `still_active` and `retention_rate`
-- were always 0. Persistency is now served correctly by
-- get_user_persistency_buckets() (see 20260613171831).

DROP FUNCTION IF EXISTS get_user_cohort_retention();
DROP MATERIALIZED VIEW IF EXISTS mv_cohort_retention;
