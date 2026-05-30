// Phase 1.2 — Curated AmAm Term Made Simple condition rules: end-to-end engine
// verification (no deploy). Runs the FULL chain a real turn would:
//   raw intake responses (exact ontology option strings)
//     → transformConditionResponses  (src transformer)
//     → computeApproval               (edge engine, with the seeded predicates)
// and asserts the curated outcomes. The rule-set fixtures below use the EXACT
// predicate JSON seeded in migration 20260530152642_seed_amam_term_condition_rules.sql.
//
// Demonstrates the Phase 1 win: with curated rules, a controlled-hypertension
// client gets a real CURATED "Standard" approval (assessable, not "manual
// review"); AFib and uncontrolled-HBP correctly DECLINE (likelihood 0 → the
// product is dropped downstream, engine.ts:828).
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  computeApproval,
  evaluateProduct,
  type ClientProfile,
  type ProductEvaluationContext,
} from "../engine.ts";
import type { RuleSetWithRules } from "../repositories.ts";
import { transformConditionResponses } from "../../../../../src/services/underwriting/core/conditionResponseTransformer.ts";
import type { ProductCandidate } from "../../../../../src/services/underwriting/core/decision-engine.types.ts";

const CARRIER = "045536d6-c8bc-4d47-81e3-c3831bdc8826"; // American Amicable
const PRODUCT = "65558e24-6499-4fad-9427-7bad63a5cdda"; // Term Made Simple

const product: ProductCandidate = {
  productId: PRODUCT,
  productName: "Term Made Simple",
  carrierId: CARRIER,
  carrierName: "American Amicable",
  productType: "term_life",
  minAge: 18,
  maxAge: 85,
  minFaceAmount: 25000,
  maxFaceAmount: 250000,
  metadata: null,
  buildChartId: null,
};

const now = "2026-01-01T00:00:00.000Z";

function ruleSet(
  id: string,
  conditionCode: string,
  rules: Array<{
    id: string;
    name: string;
    priority: number;
    predicate: unknown;
    outcome_eligibility: string;
    outcome_health_class: string;
  }>,
): RuleSetWithRules {
  return {
    id,
    imo_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    carrier_id: CARRIER,
    product_id: PRODUCT,
    scope: "condition",
    condition_code: conditionCode,
    variant: "default",
    name: conditionCode,
    description: null,
    is_active: true,
    version: 1,
    default_outcome: null,
    source: "manual",
    source_guide_id: null,
    review_status: "approved",
    reviewed_by: null,
    reviewed_at: now,
    review_notes: null,
    created_by: null,
    created_at: now,
    updated_at: now,
    rules: rules.map((r) => ({
      rule_set_id: id,
      description: null,
      age_band_min: null,
      age_band_max: null,
      gender: null,
      predicate_version: 2,
      outcome_table_rating: "none",
      outcome_flat_extra_per_thousand: null,
      outcome_flat_extra_years: null,
      outcome_reason: r.name,
      outcome_concerns: [],
      extraction_confidence: null,
      source_pages: null,
      source_snippet: null,
      created_at: now,
      updated_at: now,
      ...r,
    })),
  } as unknown as RuleSetWithRules;
}

// Predicates verbatim from the migration.
const hbpRuleSet = ruleSet(
  "a1b2c3d4-0001-4000-8000-000000000001",
  "high_blood_pressure",
  [
    {
      id: "a1b2c3d4-0001-4000-8000-000000000011",
      name: "Controlled, two or fewer medications → Standard",
      priority: 1,
      predicate: {
        version: 2,
        root: {
          all: [
            {
              type: "boolean",
              field: "high_blood_pressure.well_controlled",
              operator: "eq",
              value: true,
            },
            {
              type: "boolean",
              field: "high_blood_pressure.is_stage2_or_higher",
              operator: "eq",
              value: false,
            },
            {
              type: "numeric",
              field: "high_blood_pressure.medication_count",
              operator: "lte",
              value: 2,
            },
          ],
        },
      },
      outcome_eligibility: "eligible",
      outcome_health_class: "standard",
    },
    {
      id: "a1b2c3d4-0001-4000-8000-000000000012",
      name: "Uncontrolled or three or more medications → Decline",
      priority: 2,
      predicate: {
        version: 2,
        root: {
          any: [
            {
              type: "boolean",
              field: "high_blood_pressure.poorly_controlled",
              operator: "eq",
              value: true,
            },
            {
              type: "numeric",
              field: "high_blood_pressure.medication_count",
              operator: "gte",
              value: 3,
            },
          ],
        },
      },
      outcome_eligibility: "ineligible",
      outcome_health_class: "decline",
    },
  ],
);

const afibRuleSet = ruleSet(
  "a1b2c3d4-0002-4000-8000-000000000002",
  "atrial_fibrillation",
  [
    {
      id: "a1b2c3d4-0002-4000-8000-000000000021",
      name: "Any medically diagnosed A-Fib → Decline",
      priority: 1,
      predicate: { version: 2, root: { alwaysMatch: true } },
      outcome_eligibility: "ineligible",
      outcome_health_class: "decline",
    },
  ],
);

function clientWith(
  conditionCode: string,
  responses: Record<string, string | number | string[]>,
  age = 55,
): ClientProfile {
  const transformed = transformConditionResponses(
    [{ conditionCode, conditionName: conditionCode, responses }],
    age,
  );
  return {
    age,
    gender: "female",
    tobacco: false,
    healthConditions: [conditionCode],
    conditionResponses: transformed,
  };
}

function approve(client: ClientProfile, sets: RuleSetWithRules[]) {
  return computeApproval({
    product,
    client,
    globalRuleSetsByCarrier: new Map(),
    conditionRuleSetsByCarrier: new Map([[CARRIER, sets]]),
  });
}

Deno.test(
  "controlled hypertension → CURATED Standard approval (the visible win)",
  () => {
    const client = clientWith("high_blood_pressure", {
      controlled: "Yes, consistently normal",
      medication_count: "1",
      current_reading: "120/78",
    });
    const approval = approve(client, [hbpRuleSet]);

    assertEquals(approval.assessable, true);
    assertEquals(approval.healthClass, "standard");
    assert(
      approval.likelihood >= 0.9,
      `expected a confident curated approval, got ${approval.likelihood}`,
    );
    assertEquals(approval.conditionDecisions[0].decision, "approved");
  },
);

Deno.test("uncontrolled hypertension (3+ meds) → curated Decline", () => {
  const client = clientWith("high_blood_pressure", {
    controlled: "Poorly controlled",
    medication_count: "3 or more",
  });
  const approval = approve(client, [hbpRuleSet]);

  // Decline → likelihood 0 (product is dropped downstream as ineligible).
  assertEquals(approval.likelihood, 0);
  assertEquals(approval.assessable, false);
});

Deno.test(
  "any AFib → curated Decline (alwaysMatch marker on a condition-scoped set)",
  () => {
    const client = clientWith("atrial_fibrillation", {
      type: "Permanent",
      rate_controlled: "Yes",
    });
    const approval = approve(client, [afibRuleSet]);

    assertEquals(approval.likelihood, 0);
    assertEquals(approval.assessable, false);
  },
);

// END-TO-END via evaluateProduct: the curated Standard win must actually SURFACE
// through the live product-evaluation path (eligibility filter + term gate +
// approval + premium suppression) — not just at computeApproval. Critically, the
// demo product has ZERO premium_matrix rows AND a term is selected, which
// previously dropped the product before rules ever fired.
Deno.test(
  "controlled-HBP surfaces as Standard end-to-end even with a selected term and empty premium matrix",
  async () => {
    const client = clientWith("high_blood_pressure", {
      controlled: "Yes, consistently normal",
      medication_count: "1",
      current_reading: "120/78",
    });

    const ctx: ProductEvaluationContext = {
      client,
      coverage: { faceAmount: 100000, productTypes: ["term_life"] },
      imoId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      inputTermYears: 20, // a SELECTED term — the regression case
      criteriaMap: new Map(),
      premiumMatrixMap: new Map(), // Term Made Simple has NO rate matrix
      buildChartMap: new Map(),
      globalRuleSetsByCarrier: new Map(),
      conditionRuleSetsByCarrier: new Map([[CARRIER, [hbpRuleSet]]]),
    };

    const { evaluated } = await evaluateProduct(product, ctx);

    assert(
      evaluated !== null,
      "product must NOT be dropped despite a selected term + empty premium matrix",
    );
    assertEquals(evaluated!.eligibility.status, "eligible");
    assertEquals(evaluated!.approval.assessable, true);
    assertEquals(evaluated!.approval.healthClass, "standard");
    // No matrix → no fabricated premium/quote even though it's assessable.
    assertEquals(evaluated!.premium, null);
    assertEquals(evaluated!.healthClassUsed, undefined);
  },
);
