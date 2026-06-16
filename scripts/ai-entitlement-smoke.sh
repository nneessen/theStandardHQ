#!/usr/bin/env bash
# ai-entitlement-smoke.sh
# Validates the "collapse billing → one $25 tier + one AI add-on" end-state.
# Asserts the subscription_plans / subscription_addons rows are exactly what the
# migration 20260615194018_collapse_billing_single_tier_ai_addon.sql produced.
#
# Reliable (DB-level; no browser/auth flakiness). Run after applying the
# migration. Exits non-zero if any assertion FAILS.
#
#   ./scripts/ai-entitlement-smoke.sh
set -euo pipefail

cd "$(dirname "$0")/.."

SQL=$(cat <<'EOSQL'
WITH checks AS (
  -- Exactly one active plan, named 'pro', displayed 'Standard', $25/mo.
  SELECT 'single $25 base plan' AS check_name,
         (SELECT count(*) FROM subscription_plans WHERE is_active) = 1
         AND EXISTS (SELECT 1 FROM subscription_plans
                     WHERE is_active AND name = 'pro'
                       AND display_name = 'Standard' AND price_monthly = 2500) AS ok
  UNION ALL
  -- Base plan: AI/Close keys false, all other features true (27 true / 3 false).
  SELECT 'base plan AI+Close keys off',
         EXISTS (SELECT 1 FROM subscription_plans
                 WHERE name='pro'
                   AND (features->>'close_kpi')='false'
                   AND (features->>'close_ai_builder')='false'
                   AND (features->>'slack')='false'
                   AND (SELECT count(*) FROM jsonb_each(features) WHERE value='true') = 27)
  UNION ALL
  -- Predictive Analytics excluded from base sections; 8 non-AI sections present.
  SELECT 'predictive excluded from base sections',
         EXISTS (SELECT 1 FROM subscription_plans
                 WHERE name='pro'
                   AND NOT ('predictive_analytics' = ANY(analytics_sections))
                   AND array_length(analytics_sections,1) = 8)
  UNION ALL
  -- free / team / starter all deactivated.
  SELECT 'legacy plans deactivated',
         NOT EXISTS (SELECT 1 FROM subscription_plans
                     WHERE is_active AND name IN ('free','team','starter'))
  UNION ALL
  -- ai_assistant add-on active at $25/mo.
  SELECT 'ai_assistant add-on active $25',
         EXISTS (SELECT 1 FROM subscription_addons
                 WHERE name='ai_assistant' AND is_active AND price_monthly=2500)
  UNION ALL
  -- chat bot / voice / uw_wizard add-ons deactivated (hidden + unsold).
  SELECT 'old add-ons deactivated',
         NOT EXISTS (SELECT 1 FROM subscription_addons
                     WHERE is_active AND name IN ('ai_chat_bot','premium_voice','uw_wizard'))
)
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS status, check_name FROM checks
ORDER BY status DESC, check_name;
EOSQL
)

echo "── AI entitlement smoke ─────────────────────────────────────────────"
OUT=$(./scripts/migrations/run-sql.sh "$SQL")
echo "$OUT"

if echo "$OUT" | grep -q "FAIL"; then
  echo "❌ ai-entitlement-smoke: one or more assertions FAILED"
  exit 1
fi
echo "✅ ai-entitlement-smoke: all assertions passed"
