// src/services/underwriting/__tests__/eligibility-filter.test.ts
// Unit tests for eligibility filter functions
// Tests checkEligibility and getMaxFaceAmountForAgeTerm from the extracted module

import { describe, it, expect } from "vitest";

// =============================================================================
// Import from actual production modules
// =============================================================================

import {
  checkEligibility,
  getMaxFaceAmountForAgeTerm,
  getFullUnderwritingThreshold,
} from "../core/eligibility-filter";

import type {
  ProductCandidate,
  ProductMetadata,
  ClientProfile,
  CoverageRequest,
  ExtractedCriteria,
} from "../core/decision-engine.types";

// =============================================================================
// Test Helpers
// =============================================================================

function createProduct(
  overrides: Partial<ProductCandidate> = {},
): ProductCandidate {
  return {
    productId: "test-product-1",
    productName: "Test Term Life",
    carrierId: "carrier-1",
    carrierName: "Test Carrier",
    productType: "term_life",
    minAge: 18,
    maxAge: 75,
    minFaceAmount: 25000,
    maxFaceAmount: 1000000,
    metadata: null,
    buildChartId: null,
    ...overrides,
  };
}

function createClient(overrides: Partial<ClientProfile> = {}): ClientProfile {
  return {
    age: 35,
    gender: "male",
    tobacco: false,
    healthConditions: [],
    ...overrides,
  };
}

function createCoverage(
  overrides: Partial<CoverageRequest> = {},
): CoverageRequest {
  return {
    faceAmount: 250000,
    ...overrides,
  };
}

// =============================================================================
// Tests: getMaxFaceAmountForAgeTerm
// =============================================================================

describe("getMaxFaceAmountForAgeTerm", () => {
  describe("basic behavior", () => {
    it("returns product max when no metadata", () => {
      const result = getMaxFaceAmountForAgeTerm(null, 500000, 40, 20);
      expect(result).toBe(500000);
    });

    it("returns product max when metadata has no age tiers", () => {
      const result = getMaxFaceAmountForAgeTerm({}, 500000, 40, 20);
      expect(result).toBe(500000);
    });

    it("returns MAX_SAFE_INTEGER when both null", () => {
      const result = getMaxFaceAmountForAgeTerm(null, null, 40, 20);
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe("age-tiered restrictions", () => {
    const metadata: ProductMetadata = {
      ageTieredFaceAmounts: {
        tiers: [
          { minAge: 18, maxAge: 50, maxFaceAmount: 500000 },
          { minAge: 51, maxAge: 65, maxFaceAmount: 300000 },
          { minAge: 66, maxAge: 80, maxFaceAmount: 100000 },
        ],
      },
    };

    it("applies correct tier for young client", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 35, 20);
      expect(result).toBe(500000);
    });

    it("applies correct tier for middle-aged client", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 55, 20);
      expect(result).toBe(300000);
    });

    it("applies correct tier for senior client", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 70, 20);
      expect(result).toBe(100000);
    });

    it("uses product max when age outside all tiers", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 15, 20);
      expect(result).toBe(1000000);
    });

    it("handles exact tier boundary (min)", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 51, 20);
      expect(result).toBe(300000);
    });

    it("handles exact tier boundary (max)", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 50, 20);
      expect(result).toBe(500000);
    });
  });

  describe("term-specific restrictions", () => {
    const metadata: ProductMetadata = {
      ageTieredFaceAmounts: {
        tiers: [
          {
            minAge: 18,
            maxAge: 65,
            maxFaceAmount: 500000,
            termRestrictions: [
              { termYears: 10, maxFaceAmount: 500000 },
              { termYears: 20, maxFaceAmount: 300000 },
              { termYears: 30, maxFaceAmount: 150000 },
            ],
          },
        ],
      },
    };

    it("applies 10-year term restriction", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 40, 10);
      expect(result).toBe(500000);
    });

    it("applies 20-year term restriction", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 40, 20);
      expect(result).toBe(300000);
    });

    it("applies 30-year term restriction", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 40, 30);
      expect(result).toBe(150000);
    });

    it("uses base tier max for unlisted term", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 40, 15);
      expect(result).toBe(500000);
    });

    it("ignores term restrictions for null term (permanent product)", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 40, null);
      expect(result).toBe(500000);
    });

    it("ignores term restrictions for undefined term", () => {
      const result = getMaxFaceAmountForAgeTerm(
        metadata,
        1000000,
        40,
        undefined,
      );
      expect(result).toBe(500000);
    });
  });

  describe("combined age and term restrictions", () => {
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

    it("young client with 30-year term", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 40, 30);
      expect(result).toBe(300000);
    });

    it("older client with 30-year term", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 55, 30);
      expect(result).toBe(100000);
    });

    it("young client with 20-year term (no restriction)", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 40, 20);
      expect(result).toBe(500000);
    });

    it("older client with 20-year term (no restriction)", () => {
      const result = getMaxFaceAmountForAgeTerm(metadata, 1000000, 55, 20);
      expect(result).toBe(250000);
    });
  });
});

// =============================================================================
// Tests: getFullUnderwritingThreshold
// =============================================================================

describe("getFullUnderwritingThreshold", () => {
  it("returns null when metadata has no threshold", () => {
    expect(getFullUnderwritingThreshold(null, 45)).toBeNull();
  });

  it("supports legacy numeric threshold metadata", () => {
    expect(
      getFullUnderwritingThreshold({ fullUnderwritingThreshold: 150000 }, 45),
    ).toBe(150000);
  });

  it("uses age band threshold when available", () => {
    expect(
      getFullUnderwritingThreshold(
        {
          fullUnderwritingThreshold: {
            faceAmountThreshold: 250000,
            ageBands: [
              { minAge: 18, maxAge: 50, threshold: 300000 },
              { minAge: 51, maxAge: 80, threshold: 100000 },
            ],
          },
        },
        60,
      ),
    ).toBe(100000);
  });

  it("falls back to base threshold when no age band matches", () => {
    expect(
      getFullUnderwritingThreshold(
        {
          fullUnderwritingThreshold: {
            faceAmountThreshold: 250000,
            ageBands: [{ minAge: 18, maxAge: 50, threshold: 300000 }],
          },
        },
        60,
      ),
    ).toBe(250000);
  });
});

// =============================================================================
// Tests: checkEligibility
// =============================================================================

describe("checkEligibility", () => {
  describe("basic product constraints", () => {
    it("returns eligible for valid client within all limits", () => {
      const product = createProduct();
      const client = createClient({ age: 35 });
      const coverage = createCoverage({ faceAmount: 250000 });

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("eligible");
      expect(result.reasons).toHaveLength(0);
      expect(result.confidence).toBe(1);
    });

    it("returns ineligible when client age below minimum", () => {
      const product = createProduct({ minAge: 25 });
      const client = createClient({ age: 20 });
      const coverage = createCoverage();

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("ineligible");
      expect(result.reasons).toContain("Client age 20 below minimum 25");
    });

    it("returns ineligible when client age above maximum", () => {
      const product = createProduct({ maxAge: 65 });
      const client = createClient({ age: 70 });
      const coverage = createCoverage();

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("ineligible");
      expect(result.reasons).toContain("Client age 70 above maximum 65");
    });

    it("returns ineligible when face amount below minimum", () => {
      const product = createProduct({ minFaceAmount: 50000 });
      const client = createClient();
      const coverage = createCoverage({ faceAmount: 25000 });

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("ineligible");
      expect(result.reasons.some((r) => r.includes("below minimum"))).toBe(
        true,
      );
    });

    it("returns ineligible when face amount above maximum", () => {
      const product = createProduct({ maxFaceAmount: 500000 });
      const client = createClient();
      const coverage = createCoverage({ faceAmount: 750000 });

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("ineligible");
      expect(result.reasons.some((r) => r.includes("exceeds max"))).toBe(true);
    });
  });

  describe("age-tiered face amount limits", () => {
    it("applies age-specific face amount limit", () => {
      const product = createProduct({
        maxFaceAmount: 1000000,
        metadata: {
          ageTieredFaceAmounts: {
            tiers: [{ minAge: 60, maxAge: 80, maxFaceAmount: 250000 }],
          },
        },
      });
      const client = createClient({ age: 65 });
      const coverage = createCoverage({ faceAmount: 500000 });

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("ineligible");
      expect(
        result.reasons.some((r) => r.includes("exceeds max $250,000")),
      ).toBe(true);
    });

    it("allows higher face amount for younger client", () => {
      const product = createProduct({
        maxFaceAmount: 1000000,
        metadata: {
          ageTieredFaceAmounts: {
            tiers: [{ minAge: 60, maxAge: 80, maxFaceAmount: 250000 }],
          },
        },
      });
      const client = createClient({ age: 40 });
      const coverage = createCoverage({ faceAmount: 500000 });

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("eligible");
    });
  });

  describe("term-specific restrictions", () => {
    const productWithTermRestrictions = createProduct({
      maxFaceAmount: 1000000,
      metadata: {
        ageTieredFaceAmounts: {
          tiers: [
            {
              minAge: 18,
              maxAge: 75,
              maxFaceAmount: 500000,
              termRestrictions: [{ termYears: 30, maxFaceAmount: 200000 }],
            },
          ],
        },
      },
    });

    it("allows face amount within term restriction", () => {
      const client = createClient({ age: 50 });
      const coverage = createCoverage({ faceAmount: 150000 });

      const result = checkEligibility(
        productWithTermRestrictions,
        client,
        coverage,
        undefined,
        undefined,
        30,
      );

      expect(result.status).toBe("eligible");
    });

    it("rejects face amount exceeding term restriction", () => {
      const client = createClient({ age: 50 });
      const coverage = createCoverage({ faceAmount: 300000 });

      const result = checkEligibility(
        productWithTermRestrictions,
        client,
        coverage,
        undefined,
        undefined,
        30,
      );

      expect(result.status).toBe("ineligible");
      expect(result.reasons.some((r) => r.includes("for 30yr term"))).toBe(
        true,
      );
    });

    it("uses base limit when term has no restriction", () => {
      const client = createClient({ age: 50 });
      const coverage = createCoverage({ faceAmount: 400000 });

      const result = checkEligibility(
        productWithTermRestrictions,
        client,
        coverage,
        undefined,
        undefined,
        20,
      );

      expect(result.status).toBe("eligible");
    });
  });

  describe("extracted criteria", () => {
    it("applies extracted age limits", () => {
      const product = createProduct({ minAge: 18, maxAge: 85 });
      const client = createClient({ age: 80 });
      const coverage = createCoverage();
      const criteria: ExtractedCriteria = {
        ageLimits: { maxIssueAge: 75 },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("ineligible");
      expect(result.reasons.some((r) => r.includes("above issue age 75"))).toBe(
        true,
      );
    });

    it("applies extracted face amount limits", () => {
      const product = createProduct({ maxFaceAmount: 1000000 });
      const client = createClient();
      const coverage = createCoverage({ faceAmount: 600000 });
      const criteria: ExtractedCriteria = {
        faceAmountLimits: { maximum: 500000 },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("ineligible");
      expect(
        result.reasons.some((r) => r.includes("exceeds age-based max")),
      ).toBe(true);
    });

    it("applies extracted age-tiered face amounts", () => {
      const product = createProduct({ maxFaceAmount: 1000000 });
      const client = createClient({ age: 65 });
      const coverage = createCoverage({ faceAmount: 400000 });
      const criteria: ExtractedCriteria = {
        faceAmountLimits: {
          maximum: 500000,
          ageTiers: [{ minAge: 60, maxAge: 80, maxFaceAmount: 300000 }],
        },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("ineligible");
      expect(
        result.reasons.some((r) =>
          r.includes("exceeds age-based max $300,000"),
        ),
      ).toBe(true);
    });
  });

  describe("knockout conditions", () => {
    it("rejects client with product metadata knockout condition", () => {
      const product = createProduct({
        metadata: {
          knockoutConditions: ["hiv", "als"],
        },
      });
      const client = createClient({ healthConditions: ["HIV", "diabetes"] });
      const coverage = createCoverage();

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("ineligible");
      expect(
        result.reasons.some((r) =>
          r.includes("Product knockout condition: HIV"),
        ),
      ).toBe(true);
    });

    it("rejects client with knockout condition", () => {
      const product = createProduct();
      const client = createClient({ healthConditions: ["hiv", "diabetes"] });
      const coverage = createCoverage();
      const criteria: ExtractedCriteria = {
        knockoutConditions: { conditionCodes: ["hiv", "als"] },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("ineligible");
      expect(
        result.reasons.some((r) => r.includes("Knockout condition: hiv")),
      ).toBe(true);
    });

    it("allows client without knockout conditions", () => {
      const product = createProduct();
      const client = createClient({
        healthConditions: ["diabetes", "hypertension"],
      });
      const coverage = createCoverage();
      const criteria: ExtractedCriteria = {
        knockoutConditions: { conditionCodes: ["hiv", "als"] },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("eligible");
    });

    it("lists multiple knockout conditions", () => {
      const product = createProduct();
      const client = createClient({
        healthConditions: ["hiv", "als", "diabetes"],
      });
      const coverage = createCoverage();
      const criteria: ExtractedCriteria = {
        knockoutConditions: { conditionCodes: ["hiv", "als"] },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("ineligible");
      expect(result.reasons.some((r) => r.includes("hiv, als"))).toBe(true);
    });
  });

  describe("state availability", () => {
    it("rejects client when extracted available states exclude client state", () => {
      const product = createProduct();
      const client = createClient({ state: "TX" });
      const coverage = createCoverage();
      const criteria: ExtractedCriteria = {
        stateAvailability: {
          availableStates: ["FL", "GA"],
          unavailableStates: [],
        },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("ineligible");
      expect(
        result.reasons.some((r) => r.includes("Not available in TX")),
      ).toBe(true);
    });

    it("rejects client in unavailable state", () => {
      const product = createProduct();
      const client = createClient({ state: "NY" });
      const coverage = createCoverage();
      const criteria: ExtractedCriteria = {
        stateAvailability: { unavailableStates: ["NY", "CA"] },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("ineligible");
      expect(
        result.reasons.some((r) => r.includes("Not available in NY")),
      ).toBe(true);
    });

    it("allows client in available state", () => {
      const product = createProduct();
      const client = createClient({ state: "TX" });
      const coverage = createCoverage();
      const criteria: ExtractedCriteria = {
        stateAvailability: { unavailableStates: ["NY", "CA"] },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("eligible");
    });

    it("ignores state check when client state not provided", () => {
      const product = createProduct();
      const client = createClient({ state: undefined });
      const coverage = createCoverage();
      const criteria: ExtractedCriteria = {
        stateAvailability: { unavailableStates: ["NY", "CA"] },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("eligible");
    });
  });

  describe("tri-state eligibility (unknown)", () => {
    it("returns unknown when face amount exceeds full underwriting threshold", () => {
      const product = createProduct({
        metadata: {
          fullUnderwritingThreshold: {
            faceAmountThreshold: 250000,
            ageBands: [{ minAge: 51, maxAge: 80, threshold: 100000 }],
          },
        },
      });
      const client = createClient({ age: 60 });
      const coverage = createCoverage({ faceAmount: 150000 });

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("unknown");
      expect(
        result.reasons.some((r) => r.includes("may require full underwriting")),
      ).toBe(true);
      expect(result.confidence).toBe(1);
    });

    it("returns unknown when condition has no follow-up responses", () => {
      const product = createProduct();
      const client = createClient({
        healthConditions: ["diabetes"],
        conditionResponses: { diabetes: {} },
      });
      const coverage = createCoverage();

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("unknown");
      expect(result.reasons).toContain(
        "Missing required follow-up information",
      );
      expect(result.missingFields).toHaveLength(1);
      expect(result.missingFields[0].conditionCode).toBe("diabetes");
    });

    it("returns eligible when condition has follow-up responses", () => {
      const product = createProduct();
      const client = createClient({
        healthConditions: ["diabetes"],
        conditionResponses: { diabetes: { treatment: "medication", a1c: 6.5 } },
      });
      const coverage = createCoverage();

      const result = checkEligibility(product, client, coverage);

      expect(result.status).toBe("eligible");
      expect(result.missingFields).toHaveLength(0);
    });

    it("returns ineligible over unknown when hard rule violated", () => {
      const product = createProduct({ maxAge: 65 });
      const client = createClient({
        age: 70,
        healthConditions: ["diabetes"],
        conditionResponses: { diabetes: {} },
      });
      const coverage = createCoverage();

      const result = checkEligibility(product, client, coverage);

      // Age violation should take precedence over missing data
      expect(result.status).toBe("ineligible");
      expect(result.reasons.some((r) => r.includes("above maximum"))).toBe(
        true,
      );
    });
  });

  describe("multiple reasons", () => {
    it("collects all ineligibility reasons", () => {
      const product = createProduct({
        minAge: 25,
        maxAge: 65,
        maxFaceAmount: 500000,
      });
      const client = createClient({ age: 70, state: "NY" });
      const coverage = createCoverage({ faceAmount: 750000 });
      const criteria: ExtractedCriteria = {
        stateAvailability: { unavailableStates: ["NY"] },
      };

      const result = checkEligibility(product, client, coverage, criteria);

      expect(result.status).toBe("ineligible");
      expect(result.reasons.length).toBeGreaterThanOrEqual(2);
      expect(result.reasons.some((r) => r.includes("above maximum"))).toBe(
        true,
      );
      expect(result.reasons.some((r) => r.includes("exceeds max"))).toBe(true);
    });
  });
});
