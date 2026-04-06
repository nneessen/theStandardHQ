-- Hardening follow-up to 20260406082654_lead_heat_status_config.sql
--
-- Three fixes from the production-grade code review:
--
-- 1) Add WITH CHECK clause to the UPDATE policy on lead_heat_status_config.
--    The original policy had only USING, which lets a malicious client
--    UPDATE their own row and pivot user_id to another tenant — Postgres
--    accepts the post-image because there's no WITH CHECK constraint.
--    With WITH CHECK present, the new row must ALSO satisfy the predicate,
--    closing the cross-tenant write hole.
--
-- 2) Drop the CHECK constraint on classification_source. CLAUDE.md states
--    "No CHECK constraints on enums; enforce via TypeScript." The constraint
--    creates migration friction whenever a new source is added (e.g.
--    'ai_classified', 'imported_from_close'). Validation is enforced at the
--    application boundary via the TypeScript union type in
--    status-classification.ts.
--
-- 3) Add a functional index on (user_id, (signals->>'currentStatusId'),
--    score DESC) for lead_heat_scores so the new
--    .in("signals->>currentStatusId", rankableStatusIds) filter doesn't
--    sequentially scan every row in a user's slice. Without this, the Hot
--    100 query evaluates the JSONB extract per row at query time — fine for
--    ~6000 leads, costly at 50000+.

-- ─── Fix 1: WITH CHECK on UPDATE policy ─────────────────────────────

DROP POLICY IF EXISTS "Users update own status config"
  ON lead_heat_status_config;

CREATE POLICY "Users update own status config"
  ON lead_heat_status_config FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Fix 2: Drop CHECK constraint on classification_source ──────────

ALTER TABLE lead_heat_status_config
  DROP CONSTRAINT IF EXISTS lead_heat_status_config_classification_source_check;

-- ─── Fix 3: Functional index on lead_heat_scores for the JSONB filter ──

-- Composite index supports the hot path:
--   WHERE user_id = ?
--     AND signals->>'currentStatusId' IN (...)
--   ORDER BY score DESC
--   LIMIT 100
--
-- The leading user_id matches all consumers; the JSONB extract enables index
-- usage for the IN filter; the trailing score DESC supports the order/limit.
CREATE INDEX IF NOT EXISTS idx_lhs_user_status_id_score
  ON lead_heat_scores (
    user_id,
    ((signals->>'currentStatusId')),
    score DESC
  );

COMMENT ON INDEX idx_lhs_user_status_id_score IS
'Hot path for AI Top 100 filtering: user_id + immutable Close status_id +
score DESC. Required by closeKpiService.getLeadHeatList and
close-ai-smart-view.syncSmartViewForUser to avoid per-row JSONB extraction.';
