-- Phase 2: Engine traceability
--
-- Adds fired_rules JSONB column to underwriting_session_recommendations so
-- the wizard can show "approved/declined because rules X, Y, Z fired."
-- This is the foundation for making the v2 rule engine the authoritative
-- source of eligibility AND rate class — every decision must cite the
-- specific rule(s) that produced it.
--
-- Shape of fired_rules (one entry per matched rule):
-- [
--   {
--     "rule_id": "uuid",
--     "rule_set_id": "uuid",
--     "rule_name": "Type 2 diabetes < 5 years controlled — Standard",
--     "outcome_eligibility": "eligible" | "ineligible" | "refer",
--     "outcome_health_class": "preferred" | "standard" | ... | null,
--     "outcome_table_rating": "table_a" | ... | null,
--     "outcome_reason": "...",
--     "match_score": 0.0-1.0
--   },
--   ...
-- ]
--
-- Backward-compatible: column is nullable. Existing rows stay NULL until
-- next session; readers must handle NULL.

ALTER TABLE underwriting_session_recommendations
  ADD COLUMN IF NOT EXISTS fired_rules JSONB;

COMMENT ON COLUMN underwriting_session_recommendations.fired_rules IS
  'Array of rule citations (rule_id, rule_set_id, name, outcome) that the v2 engine matched when producing this recommendation. NULL for sessions created before Phase 2 traceability landed.';
