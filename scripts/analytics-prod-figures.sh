#!/usr/bin/env bash
#
# scripts/analytics-prod-figures.sh
#
# Read-only snapshot of the key /analytics figures straight from PRODUCTION,
# so you can eyeball the live page against database ground truth after the
# period-scope fix (full-book scoping). SELECT-only — it makes no changes.
#
# Usage:
#   ./scripts/analytics-prod-figures.sh
#
# NOTE: this queries the FULL book (the service-role connection bypasses RLS).
# The /analytics page is scoped to the logged-in user's visibility, so a regular
# agent sees a subset; for an owner / top-of-hierarchy these should line up
# closely. Compare the live panel below to the matching figure here.

set -euo pipefail
cd "$(dirname "$0")/.."

# run-sql.sh defaults to LOCAL, so point it at prod explicitly.
set -a
source .env 2>/dev/null || true
set +a
if [ -z "${REMOTE_DATABASE_URL:-}" ]; then
  echo "✗ REMOTE_DATABASE_URL not found in .env" >&2
  exit 1
fi

echo "▶ /analytics ground-truth figures — PRODUCTION (read-only, full book)"
echo

DATABASE_URL="$REMOTE_DATABASE_URL" ./scripts/migrations/run-sql.sh "
SELECT '== Policy Status snapshot  (Trend panel tiles: Active/Lapsed/Cancelled/Pending) ==' AS section;
SELECT
  count(*) FILTER (WHERE lifecycle_status = 'active')                     AS active,
  count(*) FILTER (WHERE lifecycle_status = 'lapsed')                     AS lapsed,
  count(*) FILTER (WHERE lifecycle_status = 'cancelled')                  AS cancelled,
  count(*) FILTER (WHERE lifecycle_status IS NULL AND status = 'pending') AS pending
FROM policies;

SELECT '== Policies written per month  (Trend panel bars: last 12 months) ==' AS section;
SELECT to_char(date_trunc('month', COALESCE(submit_date, effective_date)), 'Mon YYYY') AS month,
       count(*) AS written
FROM policies
WHERE COALESCE(submit_date, effective_date) >= date_trunc('month', CURRENT_DATE) - interval '11 months'
GROUP BY date_trunc('month', COALESCE(submit_date, effective_date))
ORDER BY date_trunc('month', COALESCE(submit_date, effective_date));

SELECT '== Book premium  (Hero MTD written rolls up from these; totals) ==' AS section;
SELECT count(*)                              AS policies,
       round(sum(annual_premium))::bigint    AS total_annual_premium,
       round(avg(annual_premium))::bigint    AS avg_annual_premium
FROM policies
WHERE annual_premium IS NOT NULL;

SELECT '== Commission pipeline  (Pipeline panel: Total Pending + Last-90-day paid) ==' AS section;
SELECT
  round(sum(amount) FILTER (WHERE status = 'pending'))::bigint AS total_pending,
  round(sum(amount) FILTER (WHERE status = 'paid'
        AND COALESCE(payment_date, created_at::date) >= CURRENT_DATE - interval '90 days'))::bigint AS paid_last_90d
FROM commissions;
"
