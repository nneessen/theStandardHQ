// Phase 0 — "make the engine honest" unit tests for the authoritative edge
// underwriting engine (the only live verdict path).
//
// Golden case: a 55-year-old woman with AFib, a heart attack 3 years ago, and
// type-2 diabetes. With ZERO curated condition rules, the engine must ABSTAIN
// ("insufficient carrier data — manual review") instead of silently mapping the
// missing data to a favorable Standard/Preferred class — even when the carrier
// carries administrative GLOBAL rules (American Amicable's real shape), which
// must never mask the missing medical data.
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  computeApproval,
  type ClientProfile,
  INSUFFICIENT_DATA_REASON,
  toRateTableRecommendation,
} from "../engine.ts";
import type { RuleSetWithRules } from "../repositories.ts";
import type {
  ProductCandidate,
  Recommendation,
} from "../../../../src/services/underwriting/core/decision-engine.types.ts";

const product: ProductCandidate = {
  productId: "11111111-1111-1111-1111-111111111111",
  productName: "Term Made Simple",
  carrierId: "22222222-2222-2222-2222-222222222222",
  carrierName: "American Amicable",
  productType: "term_life",
  minAge: 18,
  maxAge: 85,
  minFaceAmount: 10000,
  maxFaceAmount: 500000,
  metadata: null,
  buildChartId: null,
};

// The owner's north-star profile.
const client55F: ClientProfile = {
  age: 55,
  gender: "female",
  tobacco: false,
  healthConditions: ["atrial_fibrillation", "heart_attack", "diabetes_type_2"],
  conditionResponses: {},
};

/**
 * Build a carrier GLOBAL rule set with a single always-match administrative
 * rule that resolves to eligible/standard — mirroring American Amicable's real
 * shape (17 administrative globals, no medical-condition rules). This is the
 * case that must NOT mask the missing condition data.
 */
function adminGlobalRuleSet(): RuleSetWithRules {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "33333333-3333-3333-3333-333333333333",
    imo_id: "44444444-4444-4444-4444-444444444444",
    carrier_id: product.carrierId,
    product_id: null,
    scope: "global",
    condition_code: null,
    variant: "default",
    name: "AmAm administrative global",
    description: null,
    is_active: true,
    version: 1,
    default_outcome: null,
    source: "manual",
    source_guide_id: null,
    review_status: "approved",
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    created_by: null,
    created_at: now,
    updated_at: now,
    rules: [
      {
        id: "55555555-5555-5555-5555-555555555555",
        rule_set_id: "33333333-3333-3333-3333-333333333333",
        priority: 1,
        name: "Issue-age window",
        description: null,
        age_band_min: 18,
        age_band_max: 85,
        gender: null,
        predicate: { version: 2, root: { alwaysMatch: true } },
        predicate_version: 2,
        outcome_eligibility: "eligible",
        outcome_health_class: "standard",
        outcome_table_rating: "none",
        outcome_flat_extra_per_thousand: null,
        outcome_flat_extra_years: null,
        outcome_reason: "Within issue-age window",
        outcome_concerns: [],
        extraction_confidence: 0.95,
        source_pages: [3],
        source_snippet: "Issue ages 18-85.",
        created_at: now,
        updated_at: now,
      },
    ],
    // Cast through unknown: the fixture is shaped for the evaluator, not the
    // full generated DB Row type.
  } as unknown as RuleSetWithRules;
}

Deno.test(
  "55F with AFib/MI/diabetes and ZERO condition rules → abstains (not Standard/Preferred)",
  () => {
    const approval = computeApproval({
      product,
      client: client55F,
      globalRuleSetsByCarrier: new Map(),
      conditionRuleSetsByCarrier: new Map(),
    });

    assertEquals(approval.assessable, false);
    assert(
      approval.likelihood <= 0.5,
      `expected a non-confident likelihood, got ${approval.likelihood}`,
    );
  },
);

Deno.test(
  "55F abstains EVEN WITH American Amicable administrative globals present (globals must not mask missing medical data)",
  () => {
    const approval = computeApproval({
      product,
      client: client55F,
      globalRuleSetsByCarrier: new Map([
        [product.carrierId, [adminGlobalRuleSet()]],
      ]),
      conditionRuleSetsByCarrier: new Map(),
    });

    // The administrative global resolves to eligible/standard, but the three
    // unmatched medical conditions must still force abstention.
    assertEquals(approval.assessable, false);
  },
);

Deno.test(
  "no conditions entered → does NOT score Preferred 0.95 (abstain, never average)",
  () => {
    const healthyish: ClientProfile = {
      age: 40,
      gender: "male",
      tobacco: false,
      healthConditions: [],
      conditionResponses: {},
    };

    const approval = computeApproval({
      product,
      client: healthyish,
      globalRuleSetsByCarrier: new Map(),
      conditionRuleSetsByCarrier: new Map(),
    });

    assertEquals(approval.assessable, false);
    assert(
      approval.likelihood < 0.95,
      `expected no fabricated Preferred confidence, got ${approval.likelihood}`,
    );
    assert(
      approval.healthClass !== "preferred",
      "must not fabricate a Preferred class for an unknown person",
    );
  },
);

Deno.test("INSUFFICIENT_DATA_REASON is the honest abstain string", () => {
  assertEquals(
    INSUFFICIENT_DATA_REASON,
    "Insufficient carrier data — manual review",
  );
});

Deno.test(
  "toRateTableRecommendation suppresses fabricated class/premium for a non-assessable record (leak via healthClassUsed/monthlyPremium)",
  () => {
    // A non-assessable recommendation that — if rendered naively — would have
    // leaked a favorable Standard class + a real premium through the
    // healthClassUsed / monthlyPremium fields (NOT healthClassResult).
    const leaky = {
      carrierId: product.carrierId,
      carrierName: "American Amicable",
      productId: product.productId,
      productName: "Term Made Simple",
      productType: "term_life",
      monthlyPremium: 42.5,
      maxCoverage: 250000,
      approvalLikelihood: 0.5,
      assessable: false,
      healthClassResult: "unknown",
      healthClassUsed: "standard",
      healthClassRequested: "standard",
      wasFallback: false,
      termYears: 20,
      reason: null,
      concerns: [],
      conditionDecisions: [],
      score: 0,
      eligibilityStatus: "unknown",
      eligibilityReasons: [INSUFFICIENT_DATA_REASON],
      missingFields: [],
      confidence: 0.5,
      scoreComponents: {
        likelihood: 0.5,
        priceScore: 0,
        dataConfidence: 0.5,
        confidenceMultiplier: 1,
      },
      draftRulesFyi: [],
    } as unknown as Recommendation;

    const rate = toRateTableRecommendation(leaky);

    assertEquals(rate.healthClass, "unknown");
    assertEquals(rate.quotedHealthClass, undefined);
    assertEquals(rate.underwritingHealthClass, null);
    assertEquals(rate.monthlyPremium, null);
    assertEquals(rate.reason, INSUFFICIENT_DATA_REASON);
  },
);
