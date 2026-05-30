-- Phase 1.2 — Seed + APPROVE the first real American Amicable condition rules,
-- transcribed verbatim from the "Term Made Simple" Medical Impairment Guide
-- (underwriting_guides bed44d0e-3e6c-4bf5-89c9-b30da14477da). These are the first
-- approved condition-scoped rules in the system — they turn the engine's honest
-- "manual review" abstention into a real CURATED verdict for these conditions.
--
-- IMPORTANT — what surfaces vs what doesn't (verified, engine.ts:828):
-- A curated DECLINE makes the engine drop the product entirely (likelihood 0 →
-- ineligible), so a declined product is INVISIBLE in the recommendation output.
-- The visible curated demo is therefore the ACCEPT path: a controlled-hypertension
-- client gets a curated Standard approval. The AFib/uncontrolled DECLINE rules are
-- correct and seeded (they remove the product), but the visible win is the accept.
--
-- Predicate facts reference the TRANSFORMER OUTPUT names (conditionResponseTransformer.ts):
--   high_blood_pressure.well_controlled  (controlled === "Yes, consistently normal")
--   high_blood_pressure.poorly_controlled (controlled === "Poorly controlled")
--   high_blood_pressure.medication_count  (0/1/2/3 from the medication_count option)
-- atrial_fibrillation has NO transformer (pass-through), and the rule is
-- condition-scoped, so an explicit `alwaysMatch:true` predicate = "any diagnosed
-- AFib → Decline" (the guide row is uniformly Decline across all classes).
--
-- IDs are fixed so this is idempotent (ON CONFLICT for sets; delete+insert rules).
-- imo = ffffffff (the sentinel IMO all UW data lives under); carrier = AmAm;
-- product = Term Made Simple; review_status = approved (curated by hand).
--
-- source_guide_id is intentionally NULL: the parsed guide row exists only on the
-- local DB (created out-of-band, never migrated), so referencing it would FK-
-- violate on remote. Provenance is preserved in each rule's source_snippet; the
-- guide link can be restored when the guide is properly ingested (Phase 2).
--
-- TENANCY NOTE (known, deferred — plan §6.7): the engine loader
-- (repositories.ts fetchRuleSets) filters condition rule sets by exact imo_id, so
-- these sentinel-IMO rules are visible to the sentinel/Founders IMO (the only
-- reachable consumer today) but NOT to other IMOs (e.g. Epic Life). Cross-IMO
-- visibility is a deliberate later decision, not a bug to fix here.

-- ── Rule sets ────────────────────────────────────────────────────────────────
INSERT INTO underwriting_rule_sets
  (id, imo_id, carrier_id, product_id, scope, condition_code, name, description,
   is_active, version, variant, review_status, reviewed_at, source, source_guide_id)
VALUES
(
  'a1b2c3d4-0001-4000-8000-000000000001',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '045536d6-c8bc-4d47-81e3-c3831bdc8826',
  '65558e24-6499-4fad-9427-7bad63a5cdda',
  'condition', 'high_blood_pressure',
  'Hypertension (High Blood Pressure) — Term Made Simple',
  'AmAm Term Made Simple Medical Impairment Guide: controlled (<=2 meds, normal readings) is Standard; uncontrolled or 3+ meds is Decline.',
  true, 1, 'default', 'approved', now(), 'manual',
  NULL
),
(
  'a1b2c3d4-0002-4000-8000-000000000002',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '045536d6-c8bc-4d47-81e3-c3831bdc8826',
  '65558e24-6499-4fad-9427-7bad63a5cdda',
  'condition', 'atrial_fibrillation',
  'Atrial Fibrillation / Flutter (A-Fib) — Term Made Simple',
  'AmAm Term Made Simple Medical Impairment Guide: any medically diagnosed/treated AFib is Decline.',
  true, 1, 'default', 'approved', now(), 'manual',
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  condition_code = EXCLUDED.condition_code,
  product_id = EXCLUDED.product_id,
  scope = EXCLUDED.scope,
  is_active = EXCLUDED.is_active,
  review_status = EXCLUDED.review_status,
  reviewed_at = EXCLUDED.reviewed_at,
  source_guide_id = EXCLUDED.source_guide_id,
  updated_at = now();

-- ── Rules (replace any prior rules for these sets) ────────────────────────────
DELETE FROM underwriting_rules
WHERE rule_set_id IN (
  'a1b2c3d4-0001-4000-8000-000000000001',
  'a1b2c3d4-0002-4000-8000-000000000002'
);

INSERT INTO underwriting_rules
  (id, rule_set_id, name, priority, predicate, predicate_version,
   outcome_eligibility, outcome_health_class, outcome_table_rating,
   outcome_reason, source_snippet)
VALUES
-- HBP: controlled (<=2 meds, readings normal) → Standard  [first match wins]
(
  'a1b2c3d4-0001-4000-8000-000000000011',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'Controlled, two or fewer medications → Standard', 1,
  '{"version":2,"root":{"all":[
     {"type":"boolean","field":"high_blood_pressure.well_controlled","operator":"eq","value":true},
     {"type":"boolean","field":"high_blood_pressure.is_stage2_or_higher","operator":"eq","value":false},
     {"type":"numeric","field":"high_blood_pressure.medication_count","operator":"lte","value":2}
   ]}}'::jsonb,
  2, 'eligible', 'standard', 'none',
  'Controlled with two or fewer medications, current BP readings normal — Standard.',
  'Hypertension (High Blood Pressure) Controlled with two or fewer medications, current BP readings normal Standard Standard Standard Standard'
),
-- HBP: uncontrolled OR 3+ meds → Decline
(
  'a1b2c3d4-0001-4000-8000-000000000012',
  'a1b2c3d4-0001-4000-8000-000000000001',
  'Uncontrolled or three or more medications → Decline', 2,
  '{"version":2,"root":{"any":[
     {"type":"boolean","field":"high_blood_pressure.poorly_controlled","operator":"eq","value":true},
     {"type":"numeric","field":"high_blood_pressure.medication_count","operator":"gte","value":3}
   ]}}'::jsonb,
  2, 'ineligible', 'decline', 'none',
  'Uncontrolled or using three or more medications to control — Decline.',
  'Uncontrolled or using three or more medications to control Decline Decline Decline Decline'
),
-- AFib: any diagnosed → Decline (explicit always-match; set is condition-scoped)
(
  'a1b2c3d4-0002-4000-8000-000000000021',
  'a1b2c3d4-0002-4000-8000-000000000002',
  'Any medically diagnosed A-Fib → Decline', 1,
  '{"version":2,"root":{"alwaysMatch":true}}'::jsonb,
  2, 'ineligible', 'decline', 'none',
  'Atrial Fibrillation / Flutter — medically diagnosed, treated, or taken medication — Decline.',
  'Atrial Fibrillation / Flutter (A-Fib) Medically diagnosed, treated, or taken medication Decline Decline Decline Decline'
);
