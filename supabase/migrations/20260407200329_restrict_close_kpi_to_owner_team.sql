-- Restrict Close KPIs to the owner (Nick) and his downline hierarchy only.
--
-- Context: Migration 20260326140757 added the `close_kpi` feature flag and
-- enabled it on pro + team plans. That allowed EVERY pro/team customer to see
-- the Close KPIs sidebar item regardless of whether they were in Nick's team.
--
-- New policy (per product owner, 2026-04-07):
--   Close KPIs should only appear in the sidebar for Nick and agents in his
--   downline hierarchy. It is no longer a plan-tier feature.
--
-- How access is enforced going forward:
--   1. `isAdmin` short-circuit in Sidebar.hasFeature() — covers Nick himself.
--   2. `isDirectDownlineOfOwner && isOwnerDownlineGrantedFeature('close_kpi')`
--      — covers anyone in Nick's downline chain (walks hierarchy up to 20 levels
--      via the is_direct_downline_of_owner SQL function).
--   3. The subscription_plans.features JSONB flag is now `false` on every plan
--      so plan tier is no longer a path to access.
--
-- Behavior change to flag: Pro and Team plan customers outside Nick's downline
-- will lose the Close KPIs sidebar item after this migration. The route at
-- /close-kpi itself is not gated by this change — a separate route guard would
-- be needed to hard-block direct URL navigation.

BEGIN;

UPDATE subscription_plans
SET features = features || jsonb_build_object('close_kpi', false);

-- Validation: confirm every plan has close_kpi = false after the update.
DO $$
DECLARE
  leaked_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO leaked_count
    FROM subscription_plans
   WHERE (features->>'close_kpi')::boolean IS DISTINCT FROM FALSE;

  IF leaked_count > 0 THEN
    RAISE EXCEPTION
      'close_kpi feature flag is not false on % plan(s) after the restriction migration — investigate subscription_plans state before re-running',
      leaked_count;
  END IF;
END $$;

COMMIT;
