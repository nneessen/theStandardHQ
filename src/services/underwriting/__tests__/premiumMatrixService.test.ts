// src/services/underwriting/__tests__/premiumMatrixService.test.ts
// Unit tests for premium matrix interpolation security and correctness fixes
//
// CRITICAL TESTS:
// - Fix 1: Out-of-range bounds checking (no fake rates for out-of-matrix inputs)
// - Fix 2: Single-face CPT scaling safety (no extrapolation without explicit flag)
// - Fix 5: Premium validation (reject NaN, Infinity, negative, unreasonably high)

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  interpolatePremium,
  getAvailableRateClassesForQuote,
  type PremiumMatrix,
  type GenderType,
  type TobaccoClass,
  type RateableHealthClass,
  type TermYears,
} from "../repositories/premiumMatrixService";

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Helper to create a PremiumMatrix row for testing.
 * Minimal fields needed for interpolation testing.
 */
function createMatrixRow(
  age: number,
  faceAmount: number,
  premium: number,
  options: {
    gender?: GenderType;
    tobaccoClass?: TobaccoClass;
    healthClass?: RateableHealthClass;
    termYears?: TermYears | null;
  } = {},
): PremiumMatrix {
  return {
    id: `test-${age}-${faceAmount}`,
    product_id: "test-product-id",
    imo_id: "test-imo-id",
    age,
    face_amount: faceAmount,
    monthly_premium: premium,
    gender: options.gender ?? "male",
    tobacco_class: options.tobaccoClass ?? "non_tobacco",
    health_class: options.healthClass ?? "standard",
    term_years: options.termYears ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null, // Optional field for test fixtures
  };
}

// =============================================================================
// Available quoteable rate class detection
// =============================================================================

describe("getAvailableRateClassesForQuote", () => {
  it("returns only the single actual class for a single-class term product", () => {
    const matrix = [
      createMatrixRow(45, 100000, 42, {
        healthClass: "standard",
        termYears: 20,
      }),
      createMatrixRow(50, 100000, 49, {
        healthClass: "standard",
        termYears: 20,
      }),
    ];

    expect(
      getAvailableRateClassesForQuote(matrix, "male", "non_tobacco", 20),
    ).toEqual(["standard"]);
  });

  it("returns multiple classes in best-to-worst order for multi-class products", () => {
    const matrix = [
      createMatrixRow(45, 100000, 30, {
        healthClass: "preferred_plus",
        termYears: 20,
      }),
      createMatrixRow(45, 100000, 34, {
        healthClass: "preferred",
        termYears: 20,
      }),
      createMatrixRow(45, 100000, 40, {
        healthClass: "standard_plus",
        termYears: 20,
      }),
      createMatrixRow(45, 100000, 48, {
        healthClass: "standard",
        termYears: 20,
      }),
    ];

    expect(
      getAvailableRateClassesForQuote(matrix, "male", "non_tobacco", 20),
    ).toEqual(["preferred_plus", "preferred", "standard_plus", "standard"]);
  });
});

/**
 * Create a standard 2D matrix for testing interpolation.
 * Ages: 30, 40, 50, 60
 * Face amounts: 100000, 250000, 500000
 */
function createStandardMatrix(
  healthClass: RateableHealthClass = "standard",
  termYears: TermYears | null = null,
): PremiumMatrix[] {
  const ages = [30, 40, 50, 60];
  const faceAmounts = [100000, 250000, 500000];
  const matrix: PremiumMatrix[] = [];

  for (const age of ages) {
    for (const faceAmount of faceAmounts) {
      // Premium formula: base + age factor + face factor
      // This creates realistic-ish premiums that increase with age and face amount
      const basePremium = 10 + age * 0.5 + (faceAmount / 1000) * 0.1;
      matrix.push(
        createMatrixRow(age, faceAmount, basePremium, {
          healthClass,
          termYears,
        }),
      );
    }
  }

  return matrix;
}

/**
 * Create a single-face-amount matrix for CPT scaling tests.
 * Only has rates at $100,000 face amount.
 */
function createSingleFaceMatrix(
  healthClass: RateableHealthClass = "standard",
): PremiumMatrix[] {
  const ages = [30, 40, 50, 60];
  return ages.map((age) =>
    createMatrixRow(
      age,
      100000, // Single face amount
      10 + age * 0.5 + 10, // $100k at various ages
      { healthClass },
    ),
  );
}

// =============================================================================
// Fix 1: Out-of-Range Bounds Checking Tests
// =============================================================================

describe("Fix 1: Out-of-Range Bounds Checking", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("age out of range", () => {
    it("returns null when age is BELOW matrix minimum", () => {
      const matrix = createStandardMatrix(); // Ages 30-60

      const result = interpolatePremium(
        matrix,
        25, // Below min age (30)
        250000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Age 25 out of matrix range"),
      );
    });

    it("returns null when age is ABOVE matrix maximum", () => {
      const matrix = createStandardMatrix(); // Ages 30-60

      const result = interpolatePremium(
        matrix,
        65, // Above max age (60)
        250000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Age 65 out of matrix range"),
      );
    });

    it("returns premium when age is at matrix boundary (exact min)", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        30, // Exact min age
        250000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
    });

    it("returns premium when age is at matrix boundary (exact max)", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        60, // Exact max age
        250000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
    });

    it("returns premium when age is within range (interpolation)", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        45, // Between 40 and 50 (needs interpolation)
        250000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
      if (result.premium !== null) {
        expect(result.premium).toBeGreaterThan(0);
      }
    });
  });

  describe("face amount out of range", () => {
    it("returns null when face amount is BELOW matrix minimum", () => {
      const matrix = createStandardMatrix(); // Face amounts 100k-500k

      const result = interpolatePremium(
        matrix,
        40,
        50000, // Below min face (100000)
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Face $50000 out of matrix range"),
      );
    });

    it("returns null when face amount is ABOVE matrix maximum", () => {
      const matrix = createStandardMatrix(); // Face amounts 100k-500k

      const result = interpolatePremium(
        matrix,
        40,
        1000000, // Above max face (500000)
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Face $1000000 out of matrix range"),
      );
    });

    it("returns premium when face amount is at matrix boundary (exact min)", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        40,
        100000, // Exact min face
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
    });

    it("returns premium when face amount is at matrix boundary (exact max)", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        40,
        500000, // Exact max face
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
    });

    it("returns premium when face amount is within range (interpolation)", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        40,
        175000, // Between 100k and 250k (needs interpolation)
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
      if (result.premium !== null) {
        expect(result.premium).toBeGreaterThan(0);
      }
    });
  });

  describe("both dimensions out of range", () => {
    it("returns null when both age AND face amount are out of range", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        75, // Above max age
        750000, // Above max face
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      // Should warn about at least one dimension being out of range
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("edge case: extremely out of range values", () => {
    it("handles age far below range (newborn)", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        0, // Newborn age
        250000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
    });

    it("handles age far above range (centenarian)", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        100, // 100 years old
        250000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
    });

    it("handles very small face amount", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        40,
        1000, // Only $1,000
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
    });

    it("handles very large face amount", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        40,
        10000000, // $10 million
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
    });
  });
});

// =============================================================================
// Fix 2: Single-Face CPT Scaling Safety Tests
// =============================================================================

describe("Fix 2: Single-Face CPT Scaling Safety", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("single face amount matrix", () => {
    it("returns premium for EXACT face amount match", () => {
      const matrix = createSingleFaceMatrix(); // Only $100k face amount

      const result = interpolatePremium(
        matrix,
        40,
        100000, // Exact match to the only face amount
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
      if (result.premium !== null) {
        expect(result.premium).toBeGreaterThan(0);
      }
    });

    it("returns null for non-matching face amount (NO extrapolation)", () => {
      const matrix = createSingleFaceMatrix(); // Only $100k face amount

      const result = interpolatePremium(
        matrix,
        40,
        250000, // Different from the single available face amount
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      // Fix 1 (bounds checking) catches this first since $250k is outside
      // the single-face matrix range of [$100k - $100k]
      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("out of matrix range"),
      );
    });

    it("returns null even for face amounts below the single available amount", () => {
      const matrix = createSingleFaceMatrix(); // Only $100k

      const result = interpolatePremium(
        matrix,
        40,
        50000, // Below the single face amount
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
    });

    it("returns null even for face amounts above the single available amount", () => {
      const matrix = createSingleFaceMatrix(); // Only $100k

      const result = interpolatePremium(
        matrix,
        40,
        500000, // Above the single face amount
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
    });

    it("allows age interpolation within single-face matrix", () => {
      const matrix = createSingleFaceMatrix(); // Ages 30-60, only $100k

      const result = interpolatePremium(
        matrix,
        45, // Between 40 and 50 (needs age interpolation)
        100000, // Exact face amount match
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
      if (result.premium !== null) {
        // Premium should be between age 40 and age 50 premiums
        expect(result.premium).toBeGreaterThan(0);
      }
    });
  });

  describe("multi-face amount matrix (interpolation allowed)", () => {
    it("allows face amount interpolation in multi-face matrix", () => {
      const matrix = createStandardMatrix(); // Multiple face amounts

      const result = interpolatePremium(
        matrix,
        40,
        175000, // Between 100k and 250k
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
      if (result.premium !== null) {
        expect(result.premium).toBeGreaterThan(0);
      }
    });

    it("allows bilinear interpolation (both age and face)", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        45, // Between 40 and 50
        175000, // Between 100k and 250k
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
      if (result.premium !== null) {
        expect(result.premium).toBeGreaterThan(0);
      }
    });
  });
});

// =============================================================================
// Fix 5: Premium Validation Tests (NaN, Infinity, Negative Guard)
// =============================================================================

describe("Fix 5: Premium Validation", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("negative premium rejection", () => {
    it("returns null for negative premium values in matrix", () => {
      // Create a matrix with a negative premium (malformed data)
      const matrix: PremiumMatrix[] = [
        createMatrixRow(40, 100000, -50), // Negative premium
        createMatrixRow(40, 250000, 30),
      ];

      const result = interpolatePremium(
        matrix,
        40,
        100000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Non-positive premium"),
      );
    });

    it("returns null for zero premium values", () => {
      const matrix: PremiumMatrix[] = [
        createMatrixRow(40, 100000, 0), // Zero premium
        createMatrixRow(40, 250000, 30),
      ];

      const result = interpolatePremium(
        matrix,
        40,
        100000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Non-positive premium"),
      );
    });
  });

  describe("NaN premium rejection", () => {
    it("returns null for NaN premium values in matrix", () => {
      const matrix: PremiumMatrix[] = [
        createMatrixRow(40, 100000, NaN), // NaN premium
        createMatrixRow(40, 250000, 30),
      ];

      const result = interpolatePremium(
        matrix,
        40,
        100000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("not finite"),
      );
    });
  });

  describe("Infinity premium rejection", () => {
    it("returns null for positive Infinity premium", () => {
      const matrix: PremiumMatrix[] = [
        createMatrixRow(40, 100000, Infinity), // Positive Infinity
        createMatrixRow(40, 250000, 30),
      ];

      const result = interpolatePremium(
        matrix,
        40,
        100000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("not finite"),
      );
    });

    it("returns null for negative Infinity premium", () => {
      const matrix: PremiumMatrix[] = [
        createMatrixRow(40, 100000, -Infinity), // Negative Infinity
        createMatrixRow(40, 250000, 30),
      ];

      const result = interpolatePremium(
        matrix,
        40,
        100000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("not finite"),
      );
    });
  });

  describe("unreasonably high premium guardrail", () => {
    it("returns null for premium exceeding $100,000/month guardrail", () => {
      const matrix: PremiumMatrix[] = [
        createMatrixRow(40, 100000, 150000), // $150k/month (unreasonable)
        createMatrixRow(40, 250000, 30),
      ];

      const result = interpolatePremium(
        matrix,
        40,
        100000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("exceeds guardrail"),
      );
    });

    it("accepts premium just under the guardrail", () => {
      const matrix: PremiumMatrix[] = [
        createMatrixRow(40, 100000, 99999), // Just under $100k
        createMatrixRow(40, 250000, 30),
      ];

      const result = interpolatePremium(
        matrix,
        40,
        100000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
      if (result.premium !== null) {
        expect(result.premium).toBe(99999);
      }
    });
  });

  describe("valid premium values pass through", () => {
    it("accepts normal positive premium values", () => {
      const matrix = createStandardMatrix();

      const result = interpolatePremium(
        matrix,
        40,
        250000,
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
      if (result.premium !== null) {
        expect(result.premium).toBeGreaterThan(0);
        expect(Number.isFinite(result.premium)).toBe(true);
      }
    });

    it("validates interpolated premium values", () => {
      const matrix = createStandardMatrix();

      // Interpolation should produce valid premiums
      const result = interpolatePremium(
        matrix,
        45, // Interpolated age
        175000, // Interpolated face
        "male",
        "non_tobacco",
        "standard",
        null,
      );

      expect(result.premium).not.toBeNull();
      if (result.premium !== null) {
        expect(result.premium).toBeGreaterThan(0);
        expect(Number.isFinite(result.premium)).toBe(true);
      }
    });
  });
});

// =============================================================================
// Health Class Fallback Tests (Existing Functionality)
// =============================================================================

describe("Health Class Fallback", () => {
  it("falls back to next health class when requested class has no rates", () => {
    // Matrix only has standard_plus rates
    const matrix = createStandardMatrix("standard_plus");

    const result = interpolatePremium(
      matrix,
      40,
      250000,
      "male",
      "non_tobacco",
      "preferred_plus", // Request preferred_plus, but matrix only has standard_plus
      null,
    );

    expect(result.premium).not.toBeNull();
    if (result.premium !== null) {
      expect(result).toHaveProperty("wasExact", false);
      expect(result).toHaveProperty("used", "standard_plus");
      expect(result).toHaveProperty("requested", "preferred_plus");
    }
  });

  it("returns null for non-rateable health classes", () => {
    const matrix = createStandardMatrix();

    const result = interpolatePremium(
      matrix,
      40,
      250000,
      "male",
      "non_tobacco",
      "decline", // Non-rateable class
      null,
    );

    expect(result.premium).toBeNull();
    if (result.premium === null) {
      expect(result.reason).toBe("NON_RATEABLE_CLASS");
    }
  });

  it("returns null for refer health class", () => {
    const matrix = createStandardMatrix();

    const result = interpolatePremium(
      matrix,
      40,
      250000,
      "male",
      "non_tobacco",
      "refer", // Non-rateable class
      null,
    );

    expect(result.premium).toBeNull();
    if (result.premium === null) {
      expect(result.reason).toBe("NON_RATEABLE_CLASS");
    }
  });
});

// =============================================================================
// Term Years Tests
// =============================================================================

describe("Term Years Handling", () => {
  it("filters by term years when provided", () => {
    // Create matrices for different terms
    const matrix: PremiumMatrix[] = [
      ...createStandardMatrix("standard", 10),
      ...createStandardMatrix("standard", 20),
      ...createStandardMatrix("standard", 30),
    ];

    const result = interpolatePremium(
      matrix,
      40,
      250000,
      "male",
      "non_tobacco",
      "standard",
      20, // Specific term
    );

    expect(result.premium).not.toBeNull();
    if (result.premium !== null) {
      expect(result.termYears).toBe(20);
    }
  });

  it("returns null when requested term is not available", () => {
    // Matrix only has 10 and 20 year terms
    const matrix: PremiumMatrix[] = [
      ...createStandardMatrix("standard", 10),
      ...createStandardMatrix("standard", 20),
    ];

    const result = interpolatePremium(
      matrix,
      40,
      250000,
      "male",
      "non_tobacco",
      "standard",
      30, // Requested term not in matrix
    );

    expect(result.premium).toBeNull();
  });

  it("handles permanent products (null term)", () => {
    const matrix = createStandardMatrix("standard", null); // Permanent product

    const result = interpolatePremium(
      matrix,
      40,
      250000,
      "male",
      "non_tobacco",
      "standard",
      null, // Permanent - no term
    );

    expect(result.premium).not.toBeNull();
    if (result.premium !== null) {
      expect(result.termYears).toBeNull();
    }
  });
});

// =============================================================================
// Empty Matrix Edge Cases
// =============================================================================

describe("Empty Matrix Handling", () => {
  it("returns NO_MATRIX for empty array", () => {
    const result = interpolatePremium(
      [],
      40,
      250000,
      "male",
      "non_tobacco",
      "standard",
      null,
    );

    expect(result.premium).toBeNull();
    if (result.premium === null) {
      expect(result.reason).toBe("NO_MATRIX");
    }
  });

  it("returns NO_MATRIX for null-ish input", () => {
    const result = interpolatePremium(
      null as unknown as PremiumMatrix[],
      40,
      250000,
      "male",
      "non_tobacco",
      "standard",
      null,
    );

    expect(result.premium).toBeNull();
    if (result.premium === null) {
      expect(result.reason).toBe("NO_MATRIX");
    }
  });
});

// =============================================================================
// Kansas City Life Regression Test
// (Simulates the bug scenario where out-of-range face amounts got priced)
// =============================================================================

describe("Kansas City Life Regression", () => {
  it("does NOT produce premium for face amount exceeding matrix max", () => {
    // Simulate a matrix with max $500k face amount
    const matrix = createStandardMatrix();

    // Request $750k - should NOT be priced
    const result = interpolatePremium(
      matrix,
      40,
      750000, // Above matrix max of $500k
      "male",
      "non_tobacco",
      "standard",
      null,
    );

    // CRITICAL: This should return null, not a "fake" premium
    expect(result.premium).toBeNull();
  });

  it("does NOT produce premium for age exceeding matrix max", () => {
    // Simulate a matrix with max age 60
    const matrix = createStandardMatrix();

    // Request age 65 - should NOT be priced
    const result = interpolatePremium(
      matrix,
      65, // Above matrix max of 60
      250000,
      "male",
      "non_tobacco",
      "standard",
      null,
    );

    // CRITICAL: This should return null, not a "fake" premium
    expect(result.premium).toBeNull();
  });

  it("does NOT extrapolate for single-face matrix at different face amounts", () => {
    // Simulate a product with only $100k rates
    const matrix = createSingleFaceMatrix();

    // Request $250k - should NOT scale/extrapolate
    const result = interpolatePremium(
      matrix,
      40,
      250000, // Different from the single $100k face amount
      "male",
      "non_tobacco",
      "standard",
      null,
    );

    // CRITICAL: This should return null, not a scaled premium
    expect(result.premium).toBeNull();
  });
});
