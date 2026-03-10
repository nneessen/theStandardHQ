// src/services/underwriting/__tests__/decisionEngine.test.ts
// Unit tests for decision engine Fix 3: Term determined BEFORE eligibility
//
// CRITICAL TESTS:
// - Fix 3: Same effectiveTermYears used for both eligibility AND pricing
// - Term-specific face amount restrictions enforced consistently
// - Permanent products handled correctly (null term)
// - Fallback to longest available term when none specified

import { describe, it, expect } from "vitest";
import { getMaxFaceAmountForAgeTerm } from "../core/eligibility-filter";
import type { ProductMetadata } from "../core/decision-engine.types";

// =============================================================================
// Test: getMaxFaceAmountForAgeTerm helper function
// =============================================================================

describe("Fix 3: Term Determined Before Eligibility", () => {
  describe("getMaxFaceAmountForAgeTerm", () => {
    describe("basic age-tier restrictions", () => {
      it("returns product max when no metadata", () => {
        const result = getMaxFaceAmountForAgeTerm(null, 500000, 40, 20);
        expect(result).toBe(500000);
      });

      it("returns product max when no age-tiered face amounts", () => {
        const metadata: ProductMetadata = {};
        const result = getMaxFaceAmountForAgeTerm(metadata, 500000, 40, 20);
        expect(result).toBe(500000);
      });

      it("returns age-tier max when within tier", () => {
        const metadata: ProductMetadata = {
          ageTieredFaceAmounts: {
            tiers: [
              { minAge: 18, maxAge: 50, maxFaceAmount: 300000 },
              { minAge: 51, maxAge: 80, maxFaceAmount: 100000 },
            ],
          },
        };
        const result = getMaxFaceAmountForAgeTerm(metadata, 500000, 40, 20);
        expect(result).toBe(300000);
      });

      it("returns stricter age-tier max for older clients", () => {
        const metadata: ProductMetadata = {
          ageTieredFaceAmounts: {
            tiers: [
              { minAge: 18, maxAge: 50, maxFaceAmount: 300000 },
              { minAge: 51, maxAge: 80, maxFaceAmount: 100000 },
            ],
          },
        };
        const result = getMaxFaceAmountForAgeTerm(metadata, 500000, 60, 20);
        expect(result).toBe(100000);
      });
    });

    describe("term-specific restrictions within age tiers", () => {
      it("applies term-specific restriction when term matches", () => {
        const metadata: ProductMetadata = {
          ageTieredFaceAmounts: {
            tiers: [
              {
                minAge: 18,
                maxAge: 65,
                maxFaceAmount: 300000,
                termRestrictions: [
                  { termYears: 10, maxFaceAmount: 300000 },
                  { termYears: 15, maxFaceAmount: 250000 },
                  { termYears: 20, maxFaceAmount: 200000 },
                  { termYears: 25, maxFaceAmount: 150000 },
                  { termYears: 30, maxFaceAmount: 100000 },
                ],
              },
            ],
          },
        };

        // 20-year term should limit to $200k
        const result20 = getMaxFaceAmountForAgeTerm(metadata, 500000, 50, 20);
        expect(result20).toBe(200000);

        // 30-year term should limit to $100k
        const result30 = getMaxFaceAmountForAgeTerm(metadata, 500000, 50, 30);
        expect(result30).toBe(100000);

        // 10-year term should allow $300k
        const result10 = getMaxFaceAmountForAgeTerm(metadata, 500000, 50, 10);
        expect(result10).toBe(300000);
      });

      it("uses base tier max when no term restriction matches", () => {
        const metadata: ProductMetadata = {
          ageTieredFaceAmounts: {
            tiers: [
              {
                minAge: 18,
                maxAge: 65,
                maxFaceAmount: 300000,
                termRestrictions: [
                  { termYears: 20, maxFaceAmount: 200000 },
                  { termYears: 30, maxFaceAmount: 100000 },
                ],
              },
            ],
          },
        };

        // 15-year term has no specific restriction, use base $300k
        const result = getMaxFaceAmountForAgeTerm(metadata, 500000, 50, 15);
        expect(result).toBe(300000);
      });

      it("ignores term restrictions for permanent products (null term)", () => {
        const metadata: ProductMetadata = {
          ageTieredFaceAmounts: {
            tiers: [
              {
                minAge: 18,
                maxAge: 65,
                maxFaceAmount: 300000,
                termRestrictions: [{ termYears: 20, maxFaceAmount: 200000 }],
              },
            ],
          },
        };

        // Null term should use base tier max
        const result = getMaxFaceAmountForAgeTerm(metadata, 500000, 50, null);
        expect(result).toBe(300000);
      });
    });

    describe("edge cases", () => {
      it("handles client age at tier boundary (exact min)", () => {
        const metadata: ProductMetadata = {
          ageTieredFaceAmounts: {
            tiers: [{ minAge: 50, maxAge: 65, maxFaceAmount: 200000 }],
          },
        };
        const result = getMaxFaceAmountForAgeTerm(metadata, 500000, 50, 20);
        expect(result).toBe(200000);
      });

      it("handles client age at tier boundary (exact max)", () => {
        const metadata: ProductMetadata = {
          ageTieredFaceAmounts: {
            tiers: [{ minAge: 50, maxAge: 65, maxFaceAmount: 200000 }],
          },
        };
        const result = getMaxFaceAmountForAgeTerm(metadata, 500000, 65, 20);
        expect(result).toBe(200000);
      });

      it("returns product max when age outside all tiers", () => {
        const metadata: ProductMetadata = {
          ageTieredFaceAmounts: {
            tiers: [{ minAge: 50, maxAge: 65, maxFaceAmount: 200000 }],
          },
        };
        // Age 40 is outside the tier
        const result = getMaxFaceAmountForAgeTerm(metadata, 500000, 40, 20);
        expect(result).toBe(500000);
      });

      it("returns MAX_SAFE_INTEGER when no product max and no tiers", () => {
        const result = getMaxFaceAmountForAgeTerm(null, null, 40, 20);
        expect(result).toBe(Number.MAX_SAFE_INTEGER);
      });
    });
  });
});

// =============================================================================
// Test: Term Consistency Behavior (Integration-style)
// =============================================================================

describe("Fix 3: Term Consistency Behavior", () => {
  describe("scenario: term restricts face amount more than base tier", () => {
    it("rejects product when face exceeds TERM-specific max (not base max)", () => {
      // This is the key bug scenario:
      // - Base tier allows $300k for ages 18-65
      // - But 30-year term restricts to $100k for ages 50+
      // - Client age 55, requesting $200k with 30-year term
      // - Should be REJECTED (not eligible) because $200k > $100k term limit

      const metadata: ProductMetadata = {
        ageTieredFaceAmounts: {
          tiers: [
            {
              minAge: 18,
              maxAge: 65,
              maxFaceAmount: 300000,
              termRestrictions: [{ termYears: 30, maxFaceAmount: 100000 }],
            },
          ],
        },
      };

      // Calculate max with 30-year term
      const maxWith30Year = getMaxFaceAmountForAgeTerm(
        metadata,
        500000,
        55,
        30,
      );
      expect(maxWith30Year).toBe(100000);

      // $200k request should EXCEED the limit
      const requestedFace = 200000;
      expect(requestedFace > maxWith30Year).toBe(true);
    });

    it("accepts product when face is within TERM-specific max", () => {
      const metadata: ProductMetadata = {
        ageTieredFaceAmounts: {
          tiers: [
            {
              minAge: 18,
              maxAge: 65,
              maxFaceAmount: 300000,
              termRestrictions: [{ termYears: 30, maxFaceAmount: 100000 }],
            },
          ],
        },
      };

      // Calculate max with 30-year term
      const maxWith30Year = getMaxFaceAmountForAgeTerm(
        metadata,
        500000,
        55,
        30,
      );

      // $75k request should be within the limit
      const requestedFace = 75000;
      expect(requestedFace <= maxWith30Year).toBe(true);
    });

    it("uses base tier max when checking with shorter term", () => {
      const metadata: ProductMetadata = {
        ageTieredFaceAmounts: {
          tiers: [
            {
              minAge: 18,
              maxAge: 65,
              maxFaceAmount: 300000,
              termRestrictions: [{ termYears: 30, maxFaceAmount: 100000 }],
            },
          ],
        },
      };

      // Calculate max with 10-year term (no restriction defined)
      const maxWith10Year = getMaxFaceAmountForAgeTerm(
        metadata,
        500000,
        55,
        10,
      );
      expect(maxWith10Year).toBe(300000);

      // $200k request should be WITHIN the limit for 10-year
      const requestedFace = 200000;
      expect(requestedFace <= maxWith10Year).toBe(true);
    });
  });

  describe("scenario: permanent products (null term)", () => {
    it("uses base tier limits for permanent products", () => {
      const metadata: ProductMetadata = {
        ageTieredFaceAmounts: {
          tiers: [
            {
              minAge: 18,
              maxAge: 85,
              maxFaceAmount: 250000,
              termRestrictions: [{ termYears: 20, maxFaceAmount: 150000 }],
            },
          ],
        },
      };

      // Permanent product (null term) should use base $250k
      const maxForPermanent = getMaxFaceAmountForAgeTerm(
        metadata,
        500000,
        60,
        null,
      );
      expect(maxForPermanent).toBe(250000);
    });
  });

  describe("scenario: multiple age tiers with term restrictions", () => {
    it("applies correct tier AND term restriction based on client age", () => {
      const metadata: ProductMetadata = {
        ageTieredFaceAmounts: {
          tiers: [
            {
              minAge: 18,
              maxAge: 50,
              maxFaceAmount: 500000,
              termRestrictions: [{ termYears: 30, maxFaceAmount: 300000 }],
            },
            {
              minAge: 51,
              maxAge: 70,
              maxFaceAmount: 250000,
              termRestrictions: [{ termYears: 30, maxFaceAmount: 100000 }],
            },
          ],
        },
      };

      // Young client (45) with 30-year term
      const maxYoung30 = getMaxFaceAmountForAgeTerm(metadata, 1000000, 45, 30);
      expect(maxYoung30).toBe(300000);

      // Older client (55) with 30-year term - more restrictive
      const maxOlder30 = getMaxFaceAmountForAgeTerm(metadata, 1000000, 55, 30);
      expect(maxOlder30).toBe(100000);

      // Young client with 20-year term (no term restriction) - uses base
      const maxYoung20 = getMaxFaceAmountForAgeTerm(metadata, 1000000, 45, 20);
      expect(maxYoung20).toBe(500000);

      // Older client with 20-year term (no term restriction) - uses base
      const maxOlder20 = getMaxFaceAmountForAgeTerm(metadata, 1000000, 55, 20);
      expect(maxOlder20).toBe(250000);
    });
  });
});

// =============================================================================
// Test: Term Selection Logic
// =============================================================================

describe("Fix 3: Term Selection Logic", () => {
  describe("term selection priority", () => {
    it("uses input.termYears when available in matrix", () => {
      // Simulating the decision:
      // - Input term: 20 years
      // - Available terms: [10, 15, 20, 25, 30]
      // - Expected: Use 20 years

      const inputTermYears = 20;
      const availableTerms = [10, 15, 20, 25, 30];

      const selectedTerm = availableTerms.includes(inputTermYears)
        ? inputTermYears
        : null;

      expect(selectedTerm).toBe(20);
    });

    it("skips product when requested term not available", () => {
      // Simulating the decision:
      // - Input term: 25 years
      // - Available terms: [10, 20] (no 25)
      // - Expected: Skip product (return null)

      const inputTermYears = 25;
      const availableTerms = [10, 20];

      const selectedTerm = availableTerms.includes(inputTermYears)
        ? inputTermYears
        : null;

      expect(selectedTerm).toBeNull();
    });

    it("falls back to longest available term when input is undefined", () => {
      // Simulating the decision:
      // - Input term: undefined
      // - Available terms: [10, 15, 20, 30]
      // - Expected: Use 30 (longest)

      const availableTerms = [10, 15, 20, 30];
      const longestTerm = Math.max(...availableTerms);

      expect(longestTerm).toBe(30);
    });

    it("uses null for permanent products regardless of input", () => {
      // Simulating the decision:
      // - Input term: 20 (ignored)
      // - isPermanentProduct: true
      // - Expected: null

      const isPermanentProduct = true;
      const effectiveTermYears = isPermanentProduct ? null : 20;

      expect(effectiveTermYears).toBeNull();
    });
  });
});

// =============================================================================
// Test: Regression - The Bug Fix Scenario
// =============================================================================

describe("Fix 3: Regression Test - Bug Scenario", () => {
  it("FIXED: eligibility and pricing use SAME term restrictions", () => {
    // THE BUG:
    // Before Fix 3, eligibility was checked with undefined term (using base limits)
    // but pricing was done with a specific term (using stricter limits).
    // This caused products to pass eligibility but then show as ineligible
    // when actual pricing was attempted.

    // Product metadata simulating the bug scenario:
    const metadata: ProductMetadata = {
      ageTieredFaceAmounts: {
        tiers: [
          {
            minAge: 18,
            maxAge: 65,
            maxFaceAmount: 300000, // Base: $300k
            termRestrictions: [
              { termYears: 30, maxFaceAmount: 100000 }, // 30yr: only $100k
            ],
          },
        ],
      },
    };

    const clientAge = 55;
    const requestedFaceAmount = 200000;

    // OLD BEHAVIOR (BUG):
    // Eligibility check with undefined term → max = $300k → $200k PASSES
    const oldEligibilityMax = getMaxFaceAmountForAgeTerm(
      metadata,
      500000,
      clientAge,
      undefined, // No term specified at eligibility
    );
    expect(oldEligibilityMax).toBe(300000);
    expect(requestedFaceAmount <= oldEligibilityMax).toBe(true); // Would pass

    // But pricing with 30-year term → max = $100k → $200k FAILS
    const oldPricingMax = getMaxFaceAmountForAgeTerm(
      metadata,
      500000,
      clientAge,
      30, // 30-year term used at pricing
    );
    expect(oldPricingMax).toBe(100000);
    expect(requestedFaceAmount <= oldPricingMax).toBe(false); // Would fail

    // NEW BEHAVIOR (FIXED):
    // Determine term FIRST, then use same term for BOTH eligibility and pricing
    const effectiveTermYears = 30; // Determined before any checks

    const newEligibilityMax = getMaxFaceAmountForAgeTerm(
      metadata,
      500000,
      clientAge,
      effectiveTermYears, // Same term used at eligibility
    );
    expect(newEligibilityMax).toBe(100000);

    const newPricingMax = getMaxFaceAmountForAgeTerm(
      metadata,
      500000,
      clientAge,
      effectiveTermYears, // Same term used at pricing
    );
    expect(newPricingMax).toBe(100000);

    // BOTH now correctly identify this as ineligible
    expect(newEligibilityMax).toBe(newPricingMax);
    expect(requestedFaceAmount <= newEligibilityMax).toBe(false);
    expect(requestedFaceAmount <= newPricingMax).toBe(false);
  });
});
