-- Mark v1 and v3 underwriting tables as legacy.
--
-- The UW admin tear-down (May 2026) replaced the v1 acceptance + v3 criteria
-- surfaces with v2 rule sets / rules. The old tables are NOT dropped because
-- historical underwriting_sessions still reference them; we keep the data and
-- mark the schemas so future writers know to leave them alone.

COMMENT ON TABLE public.carrier_condition_acceptance IS
  'LEGACY (v1) — replaced by underwriting_rule_sets + underwriting_rules. No new writes. Retained for historical session references.';

COMMENT ON TABLE public.carrier_underwriting_criteria IS
  'LEGACY (v3) — replaced by v2 rule engine (underwriting_rule_sets + underwriting_rules). No new writes. Retained for historical references.';
