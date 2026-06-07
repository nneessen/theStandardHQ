// src/services/underwriting/quickQuoteCalculator.ts
// Pure calculation functions for Quick Quote - NO async, NO DB calls
// All calculations work entirely on pre-fetched in-memory data

import type {
  PremiumMatrixWithCarrier,
  GenderType,
  TobaccoClass,
  HealthClass,
  TermYears,
} from "../repositories/premiumMatrixService";
import type {
  ProductUnderwritingConstraints,
  AgeTier,
} from "@/features/underwriting/types/product-constraints.types";

// =============================================================================
// Types
// =============================================================================

export type QuickQuoteProductType =
  | "term_life"
  | "whole_life"
  | "participating_whole_life"
  | "indexed_universal_life";

export interface QuickQuoteInput {
  age: number;
  gender: GenderType;
  tobaccoUse: boolean;
  healthClass: HealthClass;
  productTypes: QuickQuoteProductType[];
  termYears?: TermYears; // Single selection for term products
}

export interface QuoteColumnResult {
  inputValue: number; // Face amount (coverage mode) or budget (budget mode)
  premium: number | null; // Monthly premium
  coverage: number | null; // Face amount (for budget mode)
  costPerThousand: number | null; // Cost per $1k of coverage
}

export interface QuickQuoteResult {
  productId: string;
  productName: string;
  carrierId: string;
  carrierName: string;
  productType: QuickQuoteProductType;
  termYears: TermYears | null;
  columns: [QuoteColumnResult, QuoteColumnResult, QuoteColumnResult];
  // Average cost per $1k across valid columns (for sorting)
  avgCostPerThousand: number | null;
}

// Constraint types for age/face amount validation
interface ProductConstraints {
  minAge: number;
  maxAge: number;
  minFaceAmount: number;
  maxFaceAmount: number;
  /** Age-tiered face amount limits from product metadata */
  ageTiers: AgeTier[];
}

interface TermAgeConstraint {
  minAge: number;
  maxAge: number;
}

interface ProductWithConstraints {
  productId: string;
  productName: string;
  carrierId: string;
  carrierName: string;
  productType: QuickQuoteProductType;
  constraints: ProductConstraints;
  termConstraints?: Map<TermYears, TermAgeConstraint>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Exact-match premium lookup — no interpolation, no estimation.
 * Returns the real imported rate or null.
 */
function lookupPremium(
  matrix: PremiumMatrixWithCarrier[],
  targetAge: number,
  targetFaceAmount: number,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: HealthClass,
  termYears: TermYears | null,
): number | null {
  for (const m of matrix) {
    if (
      m.age === targetAge &&
      m.face_amount === targetFaceAmount &&
      m.gender === gender &&
      m.tobacco_class === tobaccoClass &&
      m.health_class === healthClass &&
      (termYears !== null ? m.term_years === termYears : m.term_years === null)
    ) {
      return Number(m.monthly_premium);
    }
  }
  return null;
}

/**
 * Binary search to find max coverage within a budget
 */
function findMaxCoverageForBudget(
  productMatrix: PremiumMatrixWithCarrier[],
  age: number,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: HealthClass,
  termYears: TermYears | null,
  budget: number,
): { faceAmount: number; premium: number } | null {
  // Filter to matching classification first
  const filtered = productMatrix.filter(
    (m) =>
      m.gender === gender &&
      m.tobacco_class === tobaccoClass &&
      m.health_class === healthClass &&
      (termYears !== null ? m.term_years === termYears : m.term_years === null),
  );

  if (filtered.length === 0) {
    return null;
  }

  // Get face amounts that exist at this exact age
  const faceAmounts = [
    ...new Set(filtered.filter((m) => m.age === age).map((m) => m.face_amount)),
  ].sort((a, b) => a - b);

  if (faceAmounts.length === 0) {
    return null;
  }

  let best: { faceAmount: number; premium: number } | null = null;
  let lo = 0;
  let hi = faceAmounts.length - 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const testFace = faceAmounts[mid];

    const premium = lookupPremium(
      productMatrix,
      age,
      testFace,
      gender,
      tobaccoClass,
      healthClass,
      termYears,
    );

    if (premium !== null && premium <= budget) {
      best = { faceAmount: testFace, premium };
      lo = mid + 1; // Try higher coverage
    } else {
      hi = mid - 1; // Too expensive
    }
  }

  return best;
}

// =============================================================================
// Main Calculation Functions
// =============================================================================

/**
 * Group matrices by product ID
 */
function groupMatricesByProduct(
  matrices: PremiumMatrixWithCarrier[],
): Map<string, PremiumMatrixWithCarrier[]> {
  const grouped = new Map<string, PremiumMatrixWithCarrier[]>();
  for (const m of matrices) {
    const productId = m.product_id;
    if (!grouped.has(productId)) {
      grouped.set(productId, []);
    }
    grouped.get(productId)!.push(m);
  }
  return grouped;
}

// =============================================================================
// Pre-computed Cache for Performance
// =============================================================================

interface PrecomputedProductData {
  productId: string;
  productName: string;
  carrierId: string;
  carrierName: string;
  productType: QuickQuoteProductType;
  constraints: ProductConstraints;
  termConstraints: Map<TermYears, TermAgeConstraint>;
  matrix: PremiumMatrixWithCarrier[];
}

// Cache for pre-computed data (keyed by matrices reference)
let cachedMatricesRef: PremiumMatrixWithCarrier[] | null = null;
let cachedGroupedMatrices: Map<string, PremiumMatrixWithCarrier[]> | null =
  null;
let cachedProductData: Map<string, PrecomputedProductData> | null = null;

/**
 * Pre-compute all product data from matrices (called once, cached)
 */
function getPrecomputedData(matrices: PremiumMatrixWithCarrier[]): {
  grouped: Map<string, PremiumMatrixWithCarrier[]>;
  products: Map<string, PrecomputedProductData>;
} {
  // Return cached if same matrices reference
  if (
    matrices === cachedMatricesRef &&
    cachedGroupedMatrices &&
    cachedProductData
  ) {
    return { grouped: cachedGroupedMatrices, products: cachedProductData };
  }

  // Compute fresh
  const grouped = groupMatricesByProduct(matrices);
  const products = new Map<string, PrecomputedProductData>();

  // Build product data from first matrix entry of each product
  for (const [productId, productMatrix] of grouped.entries()) {
    const firstMatrix = productMatrix[0];
    if (!firstMatrix?.product) continue;

    const productType = firstMatrix.product
      .product_type as QuickQuoteProductType;

    // Only include quotable product types
    const quotableTypes: QuickQuoteProductType[] = [
      "term_life",
      "whole_life",
      "participating_whole_life",
      "indexed_universal_life",
    ];
    if (!quotableTypes.includes(productType)) continue;

    products.set(productId, {
      productId,
      productName: firstMatrix.product.name,
      carrierId: firstMatrix.product.carrier_id,
      carrierName: firstMatrix.product.carrier?.name || "Unknown",
      productType,
      constraints: deriveProductConstraints(productMatrix),
      termConstraints: deriveTermConstraints(productMatrix),
      matrix: productMatrix,
    });
  }

  // Cache
  cachedMatricesRef = matrices;
  cachedGroupedMatrices = grouped;
  cachedProductData = products;

  return { grouped, products };
}

/**
 * Derive product constraints from matrix data and product metadata
 * Age tiers come from product.metadata.ageTieredFaceAmounts (Settings > Products)
 * Fall back to matrix data ranges for min/max
 */
function deriveProductConstraints(
  productMatrix: PremiumMatrixWithCarrier[],
): ProductConstraints {
  const product = productMatrix[0]?.product;

  const ages = productMatrix.map((m) => m.age);
  const faceAmounts = productMatrix.map((m) => m.face_amount);

  const matrixMinAge = Math.min(...ages);
  const matrixMaxAge = Math.max(...ages);
  const matrixMinFace = Math.min(...faceAmounts);
  const matrixMaxFace = Math.max(...faceAmounts);

  // Extract age-tiered face amounts from product metadata
  const metadata = product?.metadata as ProductUnderwritingConstraints | null;
  const ageTiers = metadata?.ageTieredFaceAmounts?.tiers ?? [];

  return {
    minAge:
      product?.min_age && product.min_age > 0 ? product.min_age : matrixMinAge,
    maxAge:
      product?.max_age && product.max_age < 120
        ? product.max_age
        : matrixMaxAge,
    minFaceAmount: product?.min_face_amount ?? matrixMinFace,
    maxFaceAmount: product?.max_face_amount ?? matrixMaxFace,
    ageTiers,
  };
}

/**
 * Get maximum allowed face amount for a specific age based on age-tiered constraints
 * Returns null if no applicable tier found (meaning use product max)
 */
function getMaxFaceAmountForAge(
  ageTiers: AgeTier[],
  age: number,
): number | null {
  if (ageTiers.length === 0) return null;

  // Find the tier that applies to this age
  const applicableTier = ageTiers.find(
    (tier) => age >= tier.minAge && age <= tier.maxAge,
  );

  return applicableTier?.maxFaceAmount ?? null;
}

/**
 * For term products, derive age constraints per term length
 */
function deriveTermConstraints(
  productMatrix: PremiumMatrixWithCarrier[],
): Map<TermYears, TermAgeConstraint> {
  const constraints = new Map<TermYears, TermAgeConstraint>();

  const termYears = [
    ...new Set(
      productMatrix
        .filter((m) => m.term_years !== null)
        .map((m) => m.term_years as TermYears),
    ),
  ];

  for (const term of termYears) {
    const termData = productMatrix.filter((m) => m.term_years === term);
    const ages = termData.map((m) => m.age);
    constraints.set(term, {
      minAge: Math.min(...ages),
      maxAge: Math.max(...ages),
    });
  }

  return constraints;
}

/**
 * Get unique products matching the selected product types
 * Filters out products where user's age is outside valid range
 * OPTIMIZED: Uses pre-computed cache instead of iterating all matrices
 */
function getMatchingProducts(
  matrices: PremiumMatrixWithCarrier[],
  productTypes: QuickQuoteProductType[],
  userAge: number,
  selectedTermYears?: TermYears,
): ProductWithConstraints[] {
  const { products: precomputed } = getPrecomputedData(matrices);
  const results: ProductWithConstraints[] = [];

  for (const product of precomputed.values()) {
    // Filter by product type
    if (!productTypes.includes(product.productType)) continue;

    // Skip if user age is outside product's overall age range
    const { constraints, termConstraints } = product;
    if (userAge < constraints.minAge || userAge > constraints.maxAge) {
      continue;
    }

    const isTermProduct = product.productType === "term_life";

    if (isTermProduct) {
      // If specific term selected, check if user age is valid for that term
      if (selectedTermYears) {
        const termAgeConstraint = termConstraints.get(selectedTermYears);
        if (
          !termAgeConstraint ||
          userAge < termAgeConstraint.minAge ||
          userAge > termAgeConstraint.maxAge
        ) {
          continue;
        }
      } else {
        // No specific term - check if ANY term is valid for this age
        const hasValidTerm = [...termConstraints.values()].some(
          (c) => userAge >= c.minAge && userAge <= c.maxAge,
        );
        if (!hasValidTerm) continue;
      }
    }

    results.push({
      productId: product.productId,
      productName: product.productName,
      carrierId: product.carrierId,
      carrierName: product.carrierName,
      productType: product.productType,
      constraints,
      termConstraints: isTermProduct ? termConstraints : undefined,
    });
  }

  // Sort by carrier name, then product name
  results.sort((a, b) => {
    const carrierCompare = a.carrierName.localeCompare(b.carrierName);
    if (carrierCompare !== 0) return carrierCompare;
    return a.productName.localeCompare(b.productName);
  });

  return results;
}

/**
 * Calculate cost per thousand
 */
function calcCostPerThousand(
  premium: number | null,
  faceAmount: number | null,
): number | null {
  if (premium === null || faceAmount === null || faceAmount === 0) {
    return null;
  }
  return premium / (faceAmount / 1000);
}

/**
 * Main calculation function for COVERAGE mode (3 face amounts → premiums)
 *
 * PURE FUNCTION - No async, no DB calls, instant execution
 */
export function calculateQuotesForCoverage(
  matrices: PremiumMatrixWithCarrier[],
  input: QuickQuoteInput,
  faceAmounts: [number, number, number],
): QuickQuoteResult[] {
  const tobaccoClass: TobaccoClass = input.tobaccoUse
    ? "tobacco"
    : "non_tobacco";
  const { products: precomputed } = getPrecomputedData(matrices);
  const products = getMatchingProducts(
    matrices,
    input.productTypes,
    input.age,
    input.termYears,
  );

  const results: QuickQuoteResult[] = [];

  for (const product of products) {
    const productData = precomputed.get(product.productId);
    if (!productData || productData.matrix.length === 0) continue;

    // Determine term years to use
    const isTermProduct = product.productType === "term_life";
    const termYearsList: (TermYears | null)[] = isTermProduct
      ? input.termYears
        ? [input.termYears]
        : [20] // Default to 20yr if none selected
      : [null];

    // Get max face amount for this age from age-tiered constraints
    const maxFaceForAge = getMaxFaceAmountForAge(
      product.constraints.ageTiers,
      input.age,
    );
    const effectiveMaxFace = maxFaceForAge ?? product.constraints.maxFaceAmount;

    for (const termYears of termYearsList) {
      const columns = faceAmounts.map((faceAmount) => {
        // Check if face amount exceeds max allowed for this age
        if (effectiveMaxFace && faceAmount > effectiveMaxFace) {
          return {
            inputValue: faceAmount,
            premium: null,
            coverage: null,
            costPerThousand: null,
          };
        }

        const premium = lookupPremium(
          productData.matrix,
          input.age,
          faceAmount,
          input.gender,
          tobaccoClass,
          input.healthClass,
          termYears,
        );

        return {
          inputValue: faceAmount,
          premium,
          coverage: premium !== null ? faceAmount : null,
          costPerThousand: calcCostPerThousand(premium, faceAmount),
        };
      }) as [QuoteColumnResult, QuoteColumnResult, QuoteColumnResult];

      // Calculate average cost per thousand for sorting
      const validCosts = columns
        .map((c) => c.costPerThousand)
        .filter((c): c is number => c !== null);
      const avgCostPerThousand =
        validCosts.length > 0
          ? validCosts.reduce((a, b) => a + b, 0) / validCosts.length
          : null;

      results.push({
        productId: product.productId,
        productName: product.productName,
        carrierId: product.carrierId,
        carrierName: product.carrierName,
        productType: product.productType,
        termYears,
        columns,
        avgCostPerThousand,
      });
    }
  }

  // Sort by average cost per thousand (cheapest first)
  results.sort((a, b) => {
    if (a.avgCostPerThousand === null && b.avgCostPerThousand === null)
      return 0;
    if (a.avgCostPerThousand === null) return 1;
    if (b.avgCostPerThousand === null) return -1;
    return a.avgCostPerThousand - b.avgCostPerThousand;
  });

  return results;
}

/**
 * Main calculation function for BUDGET mode (3 budgets → max coverage)
 *
 * PURE FUNCTION - No async, no DB calls, instant execution
 */
export function calculateQuotesForBudget(
  matrices: PremiumMatrixWithCarrier[],
  input: QuickQuoteInput,
  budgets: [number, number, number],
): QuickQuoteResult[] {
  const tobaccoClass: TobaccoClass = input.tobaccoUse
    ? "tobacco"
    : "non_tobacco";
  const { products: precomputed } = getPrecomputedData(matrices);
  const products = getMatchingProducts(
    matrices,
    input.productTypes,
    input.age,
    input.termYears,
  );

  const results: QuickQuoteResult[] = [];

  for (const product of products) {
    const productData = precomputed.get(product.productId);
    if (!productData || productData.matrix.length === 0) continue;

    const isTermProduct = product.productType === "term_life";
    const termYearsList: (TermYears | null)[] = isTermProduct
      ? input.termYears
        ? [input.termYears]
        : [20]
      : [null];

    // Get max face amount for this age from age-tiered constraints
    const maxFaceForAge = getMaxFaceAmountForAge(
      product.constraints.ageTiers,
      input.age,
    );
    const effectiveMaxFace = maxFaceForAge ?? product.constraints.maxFaceAmount;

    for (const termYears of termYearsList) {
      const columns = budgets.map((budget) => {
        const result = findMaxCoverageForBudget(
          productData.matrix,
          input.age,
          input.gender,
          tobaccoClass,
          input.healthClass,
          termYears,
          budget,
        );

        if (!result) {
          return {
            inputValue: budget,
            premium: null,
            coverage: null,
            costPerThousand: null,
          };
        }

        // Cap coverage at max allowed for this age
        let cappedFaceAmount = result.faceAmount;
        let cappedPremium = result.premium;

        if (effectiveMaxFace && result.faceAmount > effectiveMaxFace) {
          cappedFaceAmount = effectiveMaxFace;
          // Recalculate premium for capped face amount
          const recalculatedPremium = lookupPremium(
            productData.matrix,
            input.age,
            cappedFaceAmount,
            input.gender,
            tobaccoClass,
            input.healthClass,
            termYears,
          );
          cappedPremium = recalculatedPremium ?? result.premium;
        }

        return {
          inputValue: budget,
          premium: cappedPremium,
          coverage: cappedFaceAmount,
          costPerThousand: calcCostPerThousand(cappedPremium, cappedFaceAmount),
        };
      }) as [QuoteColumnResult, QuoteColumnResult, QuoteColumnResult];

      const validCosts = columns
        .map((c) => c.costPerThousand)
        .filter((c): c is number => c !== null);
      const avgCostPerThousand =
        validCosts.length > 0
          ? validCosts.reduce((a, b) => a + b, 0) / validCosts.length
          : null;

      results.push({
        productId: product.productId,
        productName: product.productName,
        carrierId: product.carrierId,
        carrierName: product.carrierName,
        productType: product.productType,
        termYears,
        columns,
        avgCostPerThousand,
      });
    }
  }

  // Sort by average cost per thousand (cheapest first)
  results.sort((a, b) => {
    if (a.avgCostPerThousand === null && b.avgCostPerThousand === null)
      return 0;
    if (a.avgCostPerThousand === null) return 1;
    if (b.avgCostPerThousand === null) return -1;
    return a.avgCostPerThousand - b.avgCostPerThousand;
  });

  return results;
}

/**
 * Get available term years from matrix data (for UI term selector)
 */
export function getAvailableTermYears(
  matrices: PremiumMatrixWithCarrier[],
  productTypes: QuickQuoteProductType[],
): TermYears[] {
  const termYearsSet = new Set<TermYears>();

  for (const m of matrices) {
    if (!m.product) continue;
    if (!productTypes.includes(m.product.product_type as QuickQuoteProductType))
      continue;
    if (m.product.product_type !== "term_life") continue;
    if (m.term_years !== null) {
      termYearsSet.add(m.term_years as TermYears);
    }
  }

  return [...termYearsSet].sort((a, b) => a - b);
}

/**
 * Check if any term products are selected
 */
export function hasTermProducts(
  productTypes: QuickQuoteProductType[],
): boolean {
  return productTypes.includes("term_life");
}

/**
 * Get available term years for a given age
 * Used by UI to show only valid term options based on user's age
 * OPTIMIZED: Uses pre-computed cache
 */
export function getAvailableTermYearsForAge(
  matrices: PremiumMatrixWithCarrier[],
  productTypes: QuickQuoteProductType[],
  age: number,
): TermYears[] {
  const { products: precomputed } = getPrecomputedData(matrices);
  const termYearsSet = new Set<TermYears>();

  for (const product of precomputed.values()) {
    if (!productTypes.includes(product.productType)) continue;
    if (product.productType !== "term_life") continue;

    for (const [term, constraint] of product.termConstraints.entries()) {
      if (age >= constraint.minAge && age <= constraint.maxAge) {
        termYearsSet.add(term);
      }
    }
  }

  return [...termYearsSet].sort((a, b) => a - b);
}

/**
 * Get available health classes from the rate data for the selected product types.
 * Returns only health classes that actually have rate entries, sorted best to worst.
 */
export function getAvailableHealthClasses(
  matrices: PremiumMatrixWithCarrier[],
  productTypes: QuickQuoteProductType[],
): HealthClass[] {
  const HEALTH_CLASS_ORDER: HealthClass[] = [
    "preferred_plus",
    "preferred",
    "standard_plus",
    "standard",
    "table_rated",
  ];

  const classSet = new Set<HealthClass>();

  for (const m of matrices) {
    if (!m.product) continue;
    if (!productTypes.includes(m.product.product_type as QuickQuoteProductType))
      continue;
    classSet.add(m.health_class as HealthClass);
  }

  return HEALTH_CLASS_ORDER.filter((c) => classSet.has(c));
}
