// src/services/underwriting/quotingService.ts
// Service for generating insurance quotes across carriers/products

import { supabase } from "@/services/base/supabase";
import {
  type GenderType,
  type TobaccoClass,
  type HealthClass,
  type TermYears,
  interpolatePremium,
  getPremiumMatrixForProduct,
  getFaceAmountsForProductType,
} from "../repositories/premiumMatrixService";
import {
  lookupAcceptance,
  type AcceptanceDecision,
} from "../repositories/acceptanceService";

// ============================================================================
// Types
// ============================================================================

export type ProductType =
  | "term_life"
  | "whole_life"
  | "universal_life"
  | "indexed_universal_life"
  | "participating_whole_life"
  | "final_expense";

export type QuoteMode = "budget" | "coverage";

export type EligibilityStatus = "eligible" | "knockout" | "rating_adjusted";

export interface QuoteInput {
  age: number;
  gender: GenderType;
  tobaccoUse: boolean;
  state?: string;
  healthClass: HealthClass;
  healthConditions: string[];
  mode: QuoteMode;
  monthlyBudget?: number; // when mode='budget'
  faceAmount?: number; // when mode='coverage'
  productTypes: ProductType[];
  termYears?: TermYears[]; // optional filter for term products
}

export interface QuoteResult {
  carrierId: string;
  carrierName: string;
  productId: string;
  productName: string;
  productType: ProductType;
  termYears: number | null;
  faceAmount: number;
  monthlyPremium: number;
  costPerThousand: number; // annual premium / (faceAmount / 1000)
  approvalLikelihood: number;
  healthClassResult: HealthClass;
  eligibilityStatus: EligibilityStatus;
  ineligibilityReason?: string;
  ratingAdjustedFrom?: HealthClass;
  score: number;
}

export interface ConditionDecision {
  conditionCode: string;
  decision: AcceptanceDecision;
  likelihood: number;
  healthClassResult: string | null;
}

interface ProductCandidate {
  productId: string;
  productName: string;
  carrierId: string;
  carrierName: string;
  productType: ProductType;
  minAge: number | null;
  maxAge: number | null;
  minFaceAmount: number | null;
  maxFaceAmount: number | null;
  metadata?: {
    knockoutConditions?: string[];
    ageTieredFaceAmounts?: {
      tiers: Array<{ minAge: number; maxAge: number; maxFaceAmount: number }>;
    };
  };
}

interface EligibilityResult {
  eligible: boolean;
  status: EligibilityStatus;
  reason?: string;
}

interface ApprovalResult {
  likelihood: number;
  healthClass: HealthClass;
  adjustedFrom?: HealthClass;
  conditionDecisions: ConditionDecision[];
  concerns: string[];
}

// ============================================================================
// Constants
// ============================================================================

const HEALTH_CLASS_PRIORITY: Record<HealthClass, number> = {
  preferred_plus: 0,
  preferred: 1,
  standard_plus: 2,
  standard: 3,
  table_rated: 4,
  graded: 5,
  modified: 6,
  guaranteed_issue: 7,
};

// ============================================================================
// Scoring Algorithm
// ============================================================================

/**
 * Calculate quote score for ranking.
 * Higher score = better quote.
 * Priority: lowest cost per $1k coverage, term products preferred, shorter terms better.
 */
export function calculateQuoteScore(
  monthlyPremium: number,
  faceAmount: number,
  approvalLikelihood: number,
  _productType: ProductType,
  termYears: number | null,
): number {
  // Cost per $1k coverage (annual)
  const costPerThousand = (monthlyPremium * 12) / (faceAmount / 1000);

  // Term preference: shorter terms score higher (stickier policies)
  // 10yr=1.10, 15yr=1.075, 20yr=1.05, 25yr=1.025, 30yr=1.0, WL=0.95
  const termBonus = termYears !== null ? 1 + (30 - termYears) * 0.005 : 0.95;

  // Score: higher is better
  // Invert cost (lower cost = higher score), multiply by term bonus and approval
  // Using 1000 as a scaling factor to get reasonable numbers
  return (1000 / costPerThousand) * termBonus * approvalLikelihood;
}

/**
 * Calculate cost per $1k of coverage (annual basis)
 */
function calculateCostPerThousand(
  monthlyPremium: number,
  faceAmount: number,
): number {
  return (monthlyPremium * 12) / (faceAmount / 1000);
}

// ============================================================================
// Eligibility & Approval Functions
// ============================================================================

/**
 * Check if client is eligible for a product
 */
function checkEligibility(
  product: ProductCandidate,
  input: QuoteInput,
  faceAmount: number,
): EligibilityResult {
  // Age check
  const minAge = product.minAge ?? 0;
  const maxAge = product.maxAge ?? 100;

  if (input.age < minAge) {
    return {
      eligible: false,
      status: "knockout",
      reason: `Age ${input.age} below minimum ${minAge}`,
    };
  }
  if (input.age > maxAge) {
    return {
      eligible: false,
      status: "knockout",
      reason: `Age ${input.age} above maximum ${maxAge}`,
    };
  }

  // Face amount check (basic)
  const minFace = product.minFaceAmount ?? 0;
  let maxFace = product.maxFaceAmount ?? Number.MAX_SAFE_INTEGER;

  // Check age-tiered face amount limits from metadata
  if (product.metadata?.ageTieredFaceAmounts?.tiers) {
    for (const tier of product.metadata.ageTieredFaceAmounts.tiers) {
      if (input.age >= tier.minAge && input.age <= tier.maxAge) {
        maxFace = Math.min(maxFace, tier.maxFaceAmount);
      }
    }
  }

  if (faceAmount < minFace) {
    return {
      eligible: false,
      status: "knockout",
      reason: `Amount $${faceAmount.toLocaleString()} below minimum`,
    };
  }
  if (faceAmount > maxFace && maxFace < Number.MAX_SAFE_INTEGER) {
    return {
      eligible: false,
      status: "knockout",
      reason: `Amount $${faceAmount.toLocaleString()} exceeds max $${maxFace.toLocaleString()} for age ${input.age}`,
    };
  }

  // Knockout conditions from metadata
  if (
    product.metadata?.knockoutConditions &&
    product.metadata.knockoutConditions.length > 0
  ) {
    const knockouts = input.healthConditions.filter((c) =>
      product.metadata!.knockoutConditions!.some(
        (ko) => ko.toLowerCase() === c.toLowerCase(),
      ),
    );
    if (knockouts.length > 0) {
      return {
        eligible: false,
        status: "knockout",
        reason: `Knockout condition: ${knockouts.join(", ")}`,
      };
    }
  }

  return { eligible: true, status: "eligible" };
}

/**
 * Calculate approval likelihood and effective health class based on conditions
 */
async function calculateApproval(
  carrierId: string,
  productType: ProductType,
  healthConditions: string[],
  requestedHealthClass: HealthClass,
  imoId: string,
): Promise<ApprovalResult> {
  const conditionDecisions: ConditionDecision[] = [];
  const concerns: string[] = [];

  // No conditions = healthy client
  if (healthConditions.length === 0) {
    return {
      likelihood: 0.95,
      healthClass: requestedHealthClass,
      conditionDecisions: [],
      concerns: [],
    };
  }

  // Evaluate each condition
  let effectiveHealthClass = requestedHealthClass;
  let adjustedFrom: HealthClass | undefined;

  for (const conditionCode of healthConditions) {
    const acceptance = await lookupAcceptance(
      carrierId,
      conditionCode,
      imoId,
      productType,
    );

    if (acceptance) {
      conditionDecisions.push({
        conditionCode,
        decision: acceptance.acceptance as AcceptanceDecision,
        likelihood: acceptance.approval_likelihood ?? 0.5,
        healthClassResult: acceptance.health_class_result,
      });

      // Track concerns
      if (acceptance.acceptance === "declined") {
        concerns.push(`${conditionCode}: declined`);
      } else if (acceptance.acceptance === "case_by_case") {
        concerns.push(`${conditionCode}: requires review`);
      } else if (acceptance.acceptance === "table_rated") {
        concerns.push(`${conditionCode}: table rated`);
      }

      // Apply rating class adjustment if worse than current
      if (acceptance.health_class_result) {
        const conditionClass = acceptance.health_class_result as HealthClass;
        if (isWorseHealthClass(conditionClass, effectiveHealthClass)) {
          if (!adjustedFrom) {
            adjustedFrom = requestedHealthClass;
          }
          effectiveHealthClass = conditionClass;
        }
      }
    } else {
      // No rule found - assume case_by_case
      conditionDecisions.push({
        conditionCode,
        decision: "case_by_case",
        likelihood: 0.5,
        healthClassResult: null,
      });
      concerns.push(`${conditionCode}: no rule found`);
    }
  }

  // Check for declined
  if (conditionDecisions.some((d) => d.decision === "declined")) {
    return {
      likelihood: 0,
      healthClass: "standard",
      conditionDecisions,
      concerns,
    };
  }

  // Calculate overall likelihood (minimum)
  const likelihood = Math.min(...conditionDecisions.map((d) => d.likelihood));

  return {
    likelihood,
    healthClass: effectiveHealthClass,
    adjustedFrom:
      adjustedFrom !== effectiveHealthClass ? adjustedFrom : undefined,
    conditionDecisions,
    concerns,
  };
}

/**
 * Check if classA is worse than classB
 */
function isWorseHealthClass(classA: HealthClass, classB: HealthClass): boolean {
  return (
    (HEALTH_CLASS_PRIORITY[classA] ?? 4) > (HEALTH_CLASS_PRIORITY[classB] ?? 4)
  );
}

// ============================================================================
// Product Fetching
// ============================================================================

/**
 * Fetch eligible products for quoting
 */
async function getEligibleProducts(
  input: QuoteInput,
  imoId: string,
): Promise<ProductCandidate[]> {
  let query = supabase
    .from("products")
    .select(
      `
      id, name, product_type, min_age, max_age,
      min_face_amount, max_face_amount, carrier_id, metadata,
      carriers!inner(id, name)
    `,
    )
    .eq("is_active", true);

  if (input.productTypes && input.productTypes.length > 0) {
    query = query.in("product_type", input.productTypes);
  }

  query = query.or(`imo_id.eq.${imoId},imo_id.is.null`);

  const { data: products, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return (products || []).map((p) => {
    const carrier = p.carriers as unknown as {
      id: string;
      name: string;
    } | null;
    return {
      productId: p.id,
      productName: p.name,
      carrierId: p.carrier_id,
      carrierName: carrier?.name || "Unknown",
      productType: p.product_type as ProductType,
      minAge: p.min_age,
      maxAge: p.max_age,
      minFaceAmount: p.min_face_amount,
      maxFaceAmount: p.max_face_amount,
      metadata: p.metadata as ProductCandidate["metadata"],
    };
  });
}

// ============================================================================
// Premium Lookup
// ============================================================================

/**
 * Get premium for a product at given parameters
 */
async function getPremiumForProduct(
  productId: string,
  age: number,
  gender: GenderType,
  tobaccoUse: boolean,
  healthClass: HealthClass,
  faceAmount: number,
  termYears: TermYears | null,
  imoId: string,
): Promise<number | null> {
  const matrix = await getPremiumMatrixForProduct(productId, imoId);

  if (matrix.length === 0) {
    return null;
  }

  const tobaccoClass: TobaccoClass = tobaccoUse ? "tobacco" : "non_tobacco";

  const result = interpolatePremium(
    matrix,
    age,
    faceAmount,
    gender,
    tobaccoClass,
    healthClass,
    termYears,
  );

  // Extract premium from result (health class fallback is handled internally)
  return result.premium;
}

// ============================================================================
// Main Quoting Functions
// ============================================================================

/**
 * Get quotes for a fixed coverage amount (coverage-first mode).
 * Returns quotes for all eligible products sorted by score.
 */
export async function getQuotesForCoverage(
  input: QuoteInput,
  imoId: string,
): Promise<QuoteResult[]> {
  if (!input.faceAmount || input.faceAmount <= 0) {
    throw new Error("Face amount is required for coverage mode");
  }

  const products = await getEligibleProducts(input, imoId);
  const quotes: QuoteResult[] = [];

  for (const product of products) {
    // Determine term years for this product
    const termYearsList = getTermYearsForProduct(
      product.productType,
      input.termYears,
    );

    for (const termYears of termYearsList) {
      // Check eligibility
      const eligibility = checkEligibility(product, input, input.faceAmount);

      if (!eligibility.eligible) {
        // Add ineligible product to results for visibility
        quotes.push({
          carrierId: product.carrierId,
          carrierName: product.carrierName,
          productId: product.productId,
          productName: product.productName,
          productType: product.productType,
          termYears,
          faceAmount: input.faceAmount,
          monthlyPremium: 0,
          costPerThousand: 0,
          approvalLikelihood: 0,
          healthClassResult: input.healthClass,
          eligibilityStatus: eligibility.status,
          ineligibilityReason: eligibility.reason,
          score: 0,
        });
        continue;
      }

      // Calculate approval and effective health class
      const approval = await calculateApproval(
        product.carrierId,
        product.productType,
        input.healthConditions,
        input.healthClass,
        imoId,
      );

      if (approval.likelihood === 0) {
        quotes.push({
          carrierId: product.carrierId,
          carrierName: product.carrierName,
          productId: product.productId,
          productName: product.productName,
          productType: product.productType,
          termYears,
          faceAmount: input.faceAmount,
          monthlyPremium: 0,
          costPerThousand: 0,
          approvalLikelihood: 0,
          healthClassResult: approval.healthClass,
          eligibilityStatus: "knockout",
          ineligibilityReason: approval.concerns.join("; "),
          score: 0,
        });
        continue;
      }

      // Get premium using adjusted health class
      const premium = await getPremiumForProduct(
        product.productId,
        input.age,
        input.gender,
        input.tobaccoUse,
        approval.healthClass,
        input.faceAmount,
        termYears,
        imoId,
      );

      if (premium === null) {
        // No rate data available
        continue;
      }

      const costPerThousand = calculateCostPerThousand(
        premium,
        input.faceAmount,
      );
      const score = calculateQuoteScore(
        premium,
        input.faceAmount,
        approval.likelihood,
        product.productType,
        termYears,
      );

      quotes.push({
        carrierId: product.carrierId,
        carrierName: product.carrierName,
        productId: product.productId,
        productName: product.productName,
        productType: product.productType,
        termYears,
        faceAmount: input.faceAmount,
        monthlyPremium: premium,
        costPerThousand,
        approvalLikelihood: approval.likelihood,
        healthClassResult: approval.healthClass,
        eligibilityStatus: approval.adjustedFrom
          ? "rating_adjusted"
          : "eligible",
        ratingAdjustedFrom: approval.adjustedFrom,
        score,
      });
    }
  }

  // Sort by score descending (best quotes first)
  return quotes.sort((a, b) => b.score - a.score);
}

/**
 * Get quotes for a budget constraint (budget-first mode).
 * For each product, finds the maximum coverage within the budget.
 */
export async function getQuotesForBudget(
  input: QuoteInput,
  imoId: string,
): Promise<QuoteResult[]> {
  if (!input.monthlyBudget || input.monthlyBudget <= 0) {
    throw new Error("Monthly budget is required for budget mode");
  }

  const products = await getEligibleProducts(input, imoId);
  const quotes: QuoteResult[] = [];

  for (const product of products) {
    // Get face amounts for this product type
    const faceAmounts = [...getFaceAmountsForProductType(product.productType)];

    // Determine term years for this product
    const termYearsList = getTermYearsForProduct(
      product.productType,
      input.termYears,
    );

    for (const termYears of termYearsList) {
      // Calculate approval and effective health class first
      const approval = await calculateApproval(
        product.carrierId,
        product.productType,
        input.healthConditions,
        input.healthClass,
        imoId,
      );

      if (approval.likelihood === 0) {
        continue; // Skip declined products in budget mode
      }

      // Binary search for max coverage within budget
      let lo = 0;
      let hi = faceAmounts.length - 1;
      let maxFaceAmount = 0;
      let maxPremium = 0;

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const testFaceAmount = faceAmounts[mid];

        // Check eligibility at this face amount
        const eligibility = checkEligibility(product, input, testFaceAmount);
        if (!eligibility.eligible) {
          hi = mid - 1;
          continue;
        }

        // Get premium at this face amount
        const premium = await getPremiumForProduct(
          product.productId,
          input.age,
          input.gender,
          input.tobaccoUse,
          approval.healthClass,
          testFaceAmount,
          termYears,
          imoId,
        );

        if (premium !== null && premium <= input.monthlyBudget) {
          // This coverage fits the budget - try higher
          maxFaceAmount = testFaceAmount;
          maxPremium = premium;
          lo = mid + 1;
        } else {
          // Too expensive or no data - try lower
          hi = mid - 1;
        }
      }

      // Only add if we found a valid coverage amount
      if (maxFaceAmount > 0 && maxPremium > 0) {
        const costPerThousand = calculateCostPerThousand(
          maxPremium,
          maxFaceAmount,
        );
        const score = calculateQuoteScore(
          maxPremium,
          maxFaceAmount,
          approval.likelihood,
          product.productType,
          termYears,
        );

        quotes.push({
          carrierId: product.carrierId,
          carrierName: product.carrierName,
          productId: product.productId,
          productName: product.productName,
          productType: product.productType,
          termYears,
          faceAmount: maxFaceAmount,
          monthlyPremium: maxPremium,
          costPerThousand,
          approvalLikelihood: approval.likelihood,
          healthClassResult: approval.healthClass,
          eligibilityStatus: approval.adjustedFrom
            ? "rating_adjusted"
            : "eligible",
          ratingAdjustedFrom: approval.adjustedFrom,
          score,
        });
      }
    }
  }

  // Sort by score descending (best quotes first - highest coverage at lowest cost)
  return quotes.sort((a, b) => b.score - a.score);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get term years options for a product type
 */
function getTermYearsForProduct(
  productType: ProductType,
  requestedTermYears?: TermYears[],
): (TermYears | null)[] {
  // Non-term products have null term years
  if (productType !== "term_life") {
    return [null];
  }

  // Term products
  const allTermYears: TermYears[] = [10, 15, 20, 25, 30];

  if (requestedTermYears && requestedTermYears.length > 0) {
    return requestedTermYears;
  }

  return allTermYears;
}

/**
 * Get top N quotes by different criteria
 */
export function getTopQuotes(
  quotes: QuoteResult[],
  count: number = 3,
): {
  byScore: QuoteResult[];
  byPrice: QuoteResult[];
  byCoverage: QuoteResult[];
} {
  const eligible = quotes.filter(
    (q) =>
      q.eligibilityStatus === "eligible" ||
      q.eligibilityStatus === "rating_adjusted",
  );

  return {
    // Best overall score (our ranking algorithm)
    byScore: eligible.slice(0, count),
    // Cheapest monthly premium
    byPrice: [...eligible]
      .sort((a, b) => a.monthlyPremium - b.monthlyPremium)
      .slice(0, count),
    // Highest coverage (for budget mode)
    byCoverage: [...eligible]
      .sort((a, b) => b.faceAmount - a.faceAmount)
      .slice(0, count),
  };
}
