// src/services/underwriting/__tests__/product-evaluation.test.ts
// Unit tests for product evaluation functions
// Tests calculateScore from the extracted module

import { describe, it, expect } from "vitest";

// =============================================================================
// Import from actual production module
// =============================================================================

import {
  applyRecommendationSafetyGate,
  buildApprovalClientProfile,
  calculateScore,
  requiresManualReviewForRecommendation,
} from "../workflows/product-evaluation";

import type { ScoreComponents } from "@/features/underwriting";

// =============================================================================
// Test Helper: Calculate final score from components
// This is intentionally local since it's not exported from production code
// but represents the formula documented in the production code
// =============================================================================

/**
 * Calculate final score from components.
 * rawScore = likelihood * 0.4 + priceScore * 0.6
 * finalScore = rawScore * confidenceMultiplier
 */
function calculateFinalScore(components: ScoreComponents): number {
  const rawScore = components.likelihood * 0.4 + components.priceScore * 0.6;
  return rawScore * components.confidenceMultiplier;
}

// =============================================================================
// Tests: calculateScore
// =============================================================================

describe("calculateScore", () => {
  describe("price score calculation", () => {
    it("returns 1.0 for cheapest product (0 premium)", () => {
      const result = calculateScore(0.9, 0, 100, "eligible", 1);
      expect(result.priceScore).toBe(1);
    });

    it("returns 0.0 for most expensive product (max premium)", () => {
      const result = calculateScore(0.9, 100, 100, "eligible", 1);
      expect(result.priceScore).toBe(0);
    });

    it("returns 0.5 for mid-priced product", () => {
      const result = calculateScore(0.9, 50, 100, "eligible", 1);
      expect(result.priceScore).toBe(0.5);
    });

    it("returns 0.75 for lower-priced product", () => {
      const result = calculateScore(0.9, 25, 100, "eligible", 1);
      expect(result.priceScore).toBe(0.75);
    });

    it("returns 0.5 when maxPremium is 0", () => {
      const result = calculateScore(0.9, 50, 0, "eligible", 1);
      expect(result.priceScore).toBe(0.5);
    });

    it("returns 0.5 when premium is null", () => {
      const result = calculateScore(0.9, null, 100, "eligible", 1);
      expect(result.priceScore).toBe(0.5);
    });
  });

  describe("confidence multiplier for eligible products", () => {
    it("returns 1.0 for eligible products regardless of dataConfidence", () => {
      const result1 = calculateScore(0.9, 50, 100, "eligible", 1.0);
      expect(result1.confidenceMultiplier).toBe(1.0);

      const result2 = calculateScore(0.9, 50, 100, "eligible", 0.5);
      expect(result2.confidenceMultiplier).toBe(1.0);

      const result3 = calculateScore(0.9, 50, 100, "eligible", 0.0);
      expect(result3.confidenceMultiplier).toBe(1.0);
    });
  });

  describe("confidence multiplier for unknown eligibility", () => {
    it("returns 1.0 when dataConfidence is 1.0", () => {
      const result = calculateScore(0.9, 50, 100, "unknown", 1.0);
      expect(result.confidenceMultiplier).toBe(1.0);
    });

    it("returns 0.5 when dataConfidence is 0.0", () => {
      const result = calculateScore(0.9, 50, 100, "unknown", 0.0);
      expect(result.confidenceMultiplier).toBe(0.5);
    });

    it("returns 0.75 when dataConfidence is 0.5", () => {
      const result = calculateScore(0.9, 50, 100, "unknown", 0.5);
      expect(result.confidenceMultiplier).toBe(0.75);
    });

    it("returns 0.6 when dataConfidence is 0.2", () => {
      const result = calculateScore(0.9, 50, 100, "unknown", 0.2);
      expect(result.confidenceMultiplier).toBe(0.6);
    });

    it("returns 0.9 when dataConfidence is 0.8", () => {
      const result = calculateScore(0.9, 50, 100, "unknown", 0.8);
      expect(result.confidenceMultiplier).toBe(0.9);
    });
  });

  describe("likelihood passthrough", () => {
    it("passes through likelihood value unchanged", () => {
      const result = calculateScore(0.85, 50, 100, "eligible", 1);
      expect(result.likelihood).toBe(0.85);
    });

    it("handles 0 likelihood", () => {
      const result = calculateScore(0, 50, 100, "eligible", 1);
      expect(result.likelihood).toBe(0);
    });

    it("handles 1.0 likelihood", () => {
      const result = calculateScore(1.0, 50, 100, "eligible", 1);
      expect(result.likelihood).toBe(1.0);
    });
  });

  describe("dataConfidence passthrough", () => {
    it("passes through dataConfidence value unchanged", () => {
      const result = calculateScore(0.9, 50, 100, "eligible", 0.75);
      expect(result.dataConfidence).toBe(0.75);
    });
  });
});

describe("buildApprovalClientProfile", () => {
  it("preserves medication signals for approval evaluation", () => {
    const profile = buildApprovalClientProfile({
      age: 44,
      gender: "female",
      state: "TX",
      bmi: 29.4,
      heightFeet: 5,
      heightInches: 6,
      weight: 182,
      tobacco: false,
      healthConditions: ["diabetes"],
      medications: {
        bpMedCount: 0,
        bloodThinners: false,
        heartMeds: false,
        cholesterolMedCount: 0,
        insulinUse: true,
        oralDiabetesMeds: false,
        antidepressants: false,
        antianxiety: false,
        antipsychotics: false,
        moodStabilizers: false,
        sleepAids: false,
        adhdMeds: false,
        painMedications: "none",
        seizureMeds: false,
        migraineMeds: false,
        inhalers: false,
        copdMeds: false,
        thyroidMeds: false,
        hormonalTherapy: false,
        steroids: false,
        immunosuppressants: false,
        biologics: false,
        dmards: false,
        cancerTreatment: false,
        antivirals: false,
        osteoporosisMeds: false,
        kidneyMeds: false,
        liverMeds: false,
      },
      conditionResponses: {
        diabetes: {
          insulin_use: true,
          good_control: false,
        },
      },
    });

    expect(profile.medications?.insulinUse).toBe(true);
    expect(profile.conditionResponses?.diabetes).toEqual({
      insulin_use: true,
      good_control: false,
    });
  });
});

describe("recommendation safety gate", () => {
  it("treats case-by-case approval outcomes as manual review", () => {
    expect(
      requiresManualReviewForRecommendation({
        conditionDecisions: [
          {
            conditionCode: "diabetes",
            decision: "case_by_case",
            likelihood: 0.5,
            healthClassResult: null,
            isApproved: true,
          },
        ],
      }),
    ).toBe(true);
  });

  it("downgrades otherwise-eligible products to unknown when manual review is required", () => {
    const gated = applyRecommendationSafetyGate(
      {
        status: "eligible",
        reasons: [],
        missingFields: [],
        confidence: 1,
      },
      {
        conditionDecisions: [
          {
            conditionCode: "copd",
            decision: "case_by_case",
            likelihood: 0.6,
            healthClassResult: null,
            isApproved: true,
          },
        ],
      },
    );

    expect(gated.status).toBe("unknown");
    expect(gated.reasons).toEqual(
      expect.arrayContaining([
        "Carrier/product requires manual underwriting review for one or more reported medical conditions or medications.",
      ]),
    );
    expect(gated.confidence).toBe(0.75);
  });

  it("leaves eligible products alone when all condition decisions are approved", () => {
    const eligibility = {
      status: "eligible" as const,
      reasons: [],
      missingFields: [],
      confidence: 1,
    };

    const gated = applyRecommendationSafetyGate(eligibility, {
      conditionDecisions: [
        {
          conditionCode: "hypertension",
          decision: "approved",
          likelihood: 0.9,
          healthClassResult: "standard",
          isApproved: true,
        },
      ],
    });

    expect(gated).toBe(eligibility);
  });
});

// =============================================================================
// Tests: calculateFinalScore (composite calculation)
// =============================================================================

describe("calculateFinalScore", () => {
  describe("basic scoring formula", () => {
    it("calculates rawScore = likelihood * 0.4 + priceScore * 0.6", () => {
      const components: ScoreComponents = {
        likelihood: 1.0,
        priceScore: 1.0,
        dataConfidence: 1.0,
        confidenceMultiplier: 1.0,
      };
      const result = calculateFinalScore(components);
      // rawScore = 1.0 * 0.4 + 1.0 * 0.6 = 1.0
      expect(result).toBe(1.0);
    });

    it("weights price more than likelihood", () => {
      // High price score, low likelihood
      const components1: ScoreComponents = {
        likelihood: 0.0,
        priceScore: 1.0,
        dataConfidence: 1.0,
        confidenceMultiplier: 1.0,
      };
      const result1 = calculateFinalScore(components1);
      // rawScore = 0.0 * 0.4 + 1.0 * 0.6 = 0.6
      expect(result1).toBe(0.6);

      // Low price score, high likelihood
      const components2: ScoreComponents = {
        likelihood: 1.0,
        priceScore: 0.0,
        dataConfidence: 1.0,
        confidenceMultiplier: 1.0,
      };
      const result2 = calculateFinalScore(components2);
      // rawScore = 1.0 * 0.4 + 0.0 * 0.6 = 0.4
      expect(result2).toBe(0.4);

      expect(result1).toBeGreaterThan(result2);
    });

    it("calculates mid-range score correctly", () => {
      const components: ScoreComponents = {
        likelihood: 0.8,
        priceScore: 0.5,
        dataConfidence: 1.0,
        confidenceMultiplier: 1.0,
      };
      const result = calculateFinalScore(components);
      // rawScore = 0.8 * 0.4 + 0.5 * 0.6 = 0.32 + 0.3 = 0.62
      expect(result).toBeCloseTo(0.62);
    });
  });

  describe("confidence multiplier effect", () => {
    it("applies confidence multiplier to final score", () => {
      const components: ScoreComponents = {
        likelihood: 0.8,
        priceScore: 0.5,
        dataConfidence: 0.5,
        confidenceMultiplier: 0.75, // unknown eligibility, 50% confidence
      };
      const result = calculateFinalScore(components);
      // rawScore = 0.8 * 0.4 + 0.5 * 0.6 = 0.62
      // finalScore = 0.62 * 0.75 = 0.465
      expect(result).toBeCloseTo(0.465);
    });

    it("penalizes unknown eligibility products", () => {
      const eligibleComponents: ScoreComponents = {
        likelihood: 0.8,
        priceScore: 0.5,
        dataConfidence: 1.0,
        confidenceMultiplier: 1.0,
      };
      const eligibleScore = calculateFinalScore(eligibleComponents);

      const unknownComponents: ScoreComponents = {
        likelihood: 0.8,
        priceScore: 0.5,
        dataConfidence: 0.5,
        confidenceMultiplier: 0.75,
      };
      const unknownScore = calculateFinalScore(unknownComponents);

      expect(eligibleScore).toBeGreaterThan(unknownScore);
    });

    it("minimum multiplier is 0.5 (50% penalty)", () => {
      const components: ScoreComponents = {
        likelihood: 1.0,
        priceScore: 1.0,
        dataConfidence: 0.0,
        confidenceMultiplier: 0.5,
      };
      const result = calculateFinalScore(components);
      // rawScore = 1.0
      // finalScore = 1.0 * 0.5 = 0.5
      expect(result).toBe(0.5);
    });
  });

  describe("edge cases", () => {
    it("handles all zeros", () => {
      const components: ScoreComponents = {
        likelihood: 0,
        priceScore: 0,
        dataConfidence: 0,
        confidenceMultiplier: 0.5,
      };
      const result = calculateFinalScore(components);
      expect(result).toBe(0);
    });

    it("handles all ones", () => {
      const components: ScoreComponents = {
        likelihood: 1.0,
        priceScore: 1.0,
        dataConfidence: 1.0,
        confidenceMultiplier: 1.0,
      };
      const result = calculateFinalScore(components);
      expect(result).toBe(1.0);
    });
  });
});

// =============================================================================
// Tests: Score comparison scenarios
// =============================================================================

describe("Score Comparison Scenarios", () => {
  describe("ranking products correctly", () => {
    it("ranks cheap high-approval product above expensive low-approval", () => {
      // Cheap product with high approval
      const cheap = calculateScore(0.9, 30, 100, "eligible", 1);
      const cheapFinal = calculateFinalScore(cheap);

      // Expensive product with low approval
      const expensive = calculateScore(0.5, 80, 100, "eligible", 1);
      const expensiveFinal = calculateFinalScore(expensive);

      expect(cheapFinal).toBeGreaterThan(expensiveFinal);
    });

    it("ranks eligible product above unknown with same metrics", () => {
      const eligible = calculateScore(0.9, 50, 100, "eligible", 1);
      const eligibleFinal = calculateFinalScore(eligible);

      const unknown = calculateScore(0.9, 50, 100, "unknown", 0.5);
      const unknownFinal = calculateFinalScore(unknown);

      expect(eligibleFinal).toBeGreaterThan(unknownFinal);
    });

    it("ranks unknown with high confidence above unknown with low confidence", () => {
      const highConfidence = calculateScore(0.9, 50, 100, "unknown", 0.9);
      const highConfidenceFinal = calculateFinalScore(highConfidence);

      const lowConfidence = calculateScore(0.9, 50, 100, "unknown", 0.2);
      const lowConfidenceFinal = calculateFinalScore(lowConfidence);

      expect(highConfidenceFinal).toBeGreaterThan(lowConfidenceFinal);
    });

    it("can have unknown product beat eligible if much cheaper", () => {
      // Unknown but very cheap
      const unknown = calculateScore(0.9, 10, 100, "unknown", 0.8);
      const unknownFinal = calculateFinalScore(unknown);
      // rawScore = 0.9 * 0.4 + 0.9 * 0.6 = 0.36 + 0.54 = 0.9
      // finalScore = 0.9 * 0.9 = 0.81

      // Eligible but very expensive
      const eligible = calculateScore(0.7, 95, 100, "eligible", 1.0);
      const eligibleFinal = calculateFinalScore(eligible);
      // rawScore = 0.7 * 0.4 + 0.05 * 0.6 = 0.28 + 0.03 = 0.31
      // finalScore = 0.31 * 1.0 = 0.31

      expect(unknownFinal).toBeGreaterThan(eligibleFinal);
    });
  });
});
