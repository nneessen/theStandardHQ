import { describe, expect, it } from "vitest";
import {
  buildEligibilitySummary,
  buildSessionRecommendations,
  formatRequestedFaceAmounts,
  getRequestedFaceAmounts,
} from "./session-persistence";
// eslint-disable-next-line no-restricted-imports
import type { DecisionEngineResult } from "@/services/underwriting/workflows/decisionEngine";

const decisionResult: DecisionEngineResult = {
  recommendations: [
    {
      carrierId: "carrier-1",
      carrierName: "Carrier One",
      productId: "product-1",
      productName: "Product One",
      productType: "term_life",
      monthlyPremium: 120,
      maxCoverage: 250000,
      approvalLikelihood: 0.9,
      healthClassResult: "preferred",
      reason: "best_value",
      concerns: [],
      conditionDecisions: [],
      score: 0.91234,
      eligibilityStatus: "eligible",
      eligibilityReasons: ["Eligible"],
      missingFields: [],
      confidence: 1,
      scoreComponents: {
        likelihood: 0.9,
        priceScore: 0.85,
        dataConfidence: 1,
        confidenceMultiplier: 1,
      },
      draftRulesFyi: [],
    },
  ],
  eligibleProducts: [
    {
      carrierId: "carrier-1",
      carrierName: "Carrier One",
      productId: "product-1",
      productName: "Product One",
      productType: "term_life",
      monthlyPremium: 120,
      maxCoverage: 250000,
      approvalLikelihood: 0.9,
      healthClassResult: "preferred",
      reason: null,
      concerns: [],
      conditionDecisions: [],
      score: 0.91234,
      eligibilityStatus: "eligible",
      eligibilityReasons: ["Eligible"],
      missingFields: [],
      confidence: 1,
      scoreComponents: {
        likelihood: 0.9,
        priceScore: 0.85,
        dataConfidence: 1,
        confidenceMultiplier: 1,
      },
      draftRulesFyi: [],
    },
  ],
  unknownEligibility: [
    {
      carrierId: "carrier-2",
      carrierName: "Carrier Two",
      productId: "product-2",
      productName: "Product Two",
      productType: "whole_life",
      monthlyPremium: null,
      maxCoverage: 100000,
      approvalLikelihood: 0.5,
      healthClassResult: "standard",
      reason: null,
      concerns: ["Missing A1C"],
      conditionDecisions: [],
      score: 0.43219,
      eligibilityStatus: "unknown",
      eligibilityReasons: ["Missing labs"],
      missingFields: [
        {
          field: "condition.diabetes.a1c",
          reason: "Required for full evaluation",
        },
      ],
      confidence: 0.4,
      scoreComponents: {
        likelihood: 0.5,
        priceScore: 0,
        dataConfidence: 0.4,
        confidenceMultiplier: 0.5,
      },
      draftRulesFyi: [],
    },
  ],
  filtered: {
    totalProducts: 4,
    passedEligibility: 1,
    unknownEligibility: 1,
    passedAcceptance: 2,
    withPremiums: 1,
    ineligible: 2,
  },
  processingTime: 50,
};

describe("session-persistence", () => {
  it("builds an eligibility summary from the decision engine result", () => {
    expect(buildEligibilitySummary(decisionResult)).toEqual({
      eligible: 1,
      unknown: 1,
      ineligible: 2,
    });
  });

  it("converts ranked decision engine results into persisted session rows", () => {
    expect(buildSessionRecommendations(decisionResult)).toEqual([
      expect.objectContaining({
        productId: "product-1",
        recommendationReason: "best_value",
        recommendationRank: 1,
        annualPremium: 1440,
        costPerThousand: 5.76,
        score: 0.9123,
      }),
      expect.objectContaining({
        productId: "product-2",
        recommendationReason: null,
        recommendationRank: 2,
        annualPremium: null,
        costPerThousand: null,
      }),
    ]);
  });

  it("prefers exact requested face amounts over the legacy scalar value", () => {
    const session = {
      requested_face_amount: 250000,
      requested_face_amounts: [150000, 300000, 450000],
    };

    expect(getRequestedFaceAmounts(session)).toEqual([150000, 300000, 450000]);
    expect(formatRequestedFaceAmounts(session)).toBe(
      "$150,000, $300,000, $450,000",
    );
  });

  it("falls back to the legacy scalar face amount when exact amounts are absent", () => {
    const session = {
      requested_face_amount: 500000,
      requested_face_amounts: [],
    };

    expect(getRequestedFaceAmounts(session)).toEqual([500000]);
    expect(formatRequestedFaceAmounts(session)).toBe("$500,000");
  });
});
