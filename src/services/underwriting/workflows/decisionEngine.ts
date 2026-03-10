// src/services/underwriting/decisionEngine.ts
// 4-Stage Recommendation Engine for Product Recommendations
// Stage 1: Eligibility Filter (products table + extracted_criteria) - Now with tri-state
// Stage 2: Approval Scoring (rule engine v2 with compound predicates)
// Stage 3: Premium Calculation (premium_matrix with interpolation)
// Stage 4: Ranking & Explanation - With derived confidence penalty

import pLimit from "p-limit";

// =============================================================================
// Re-exports for backward compatibility
// =============================================================================

// Types
export type {
  GenderType,
  AcceptanceDecision,
  ProductType,
  HealthClass,
  ClientProfile,
  CoverageRequest,
  DecisionEngineInput,
  ProductMetadata,
  ProductCandidate,
  ConditionDecision,
  Recommendation,
  DecisionEngineResult,
  EvaluatedProduct,
  BuildChartInfo,
  ProductEvaluationContext,
  ProductEvaluationResult,
  EligibilityResult,
  ApprovalResult,
  ExtractedCriteria,
} from "../core/decision-engine.types";

// Eligibility filter functions
export {
  checkEligibility,
  getMaxFaceAmountForAgeTerm,
} from "../core/eligibility-filter";

// Approval scoring functions
export {
  applyBuildConstraint,
  determineHealthClass,
  calculateApproval,
  HEALTH_CLASS_SEVERITY,
} from "../core/approval-scoring";

// Premium calculator
export { getPremium } from "../core/premium-calculator";

// Product evaluation functions
export {
  getProducts,
  getExtractedCriteriaMap,
  batchFetchPremiumMatrices,
  batchFetchBuildCharts,
  calculateScore,
  evaluateSingleProduct,
  PARALLEL_PRODUCT_LIMIT,
} from "./product-evaluation";

// Recommendation utilities
export {
  getTobaccoClass,
  formatRecommendationReason,
  getReasonBadgeColor,
  formatCurrency,
  formatPercentage,
} from "../core/recommendation-utils";

// V2 Rule Engine
export {
  evaluateUnderwritingV2,
  hasV2RulesForCarrier,
  type V2EvaluationInput,
  type V2EvaluationResult,
} from "./rule-engine-v2";

// =============================================================================
// Imports for getRecommendations
// =============================================================================

import type {
  DecisionEngineInput,
  DecisionEngineResult,
  Recommendation,
  EvaluatedProduct,
  ProductEvaluationContext,
} from "../core/decision-engine.types";

import {
  getProducts,
  getExtractedCriteriaMap,
  batchFetchPremiumMatrices,
  batchFetchBuildCharts,
  calculateScore,
  evaluateSingleProduct,
  PARALLEL_PRODUCT_LIMIT,
} from "./product-evaluation";

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Main entry point: Get product recommendations.
 * Now supports tri-state eligibility and keeps unknown products in results.
 * Uses parallel product evaluation for improved performance.
 *
 * @param input - The decision engine input
 * @returns Decision engine result with recommendations
 */
export async function getRecommendations(
  input: DecisionEngineInput,
): Promise<DecisionEngineResult> {
  const startTime = Date.now();
  const { client, coverage, imoId } = input;

  // Validate required inputs
  if (!imoId || typeof imoId !== "string" || imoId.length < 10) {
    throw new Error("Invalid imoId: must be a valid UUID string");
  }

  if (
    !client ||
    typeof client.age !== "number" ||
    client.age < 0 ||
    client.age > 120
  ) {
    throw new Error("Invalid client age: must be between 0 and 120");
  }

  if (
    !coverage ||
    typeof coverage.faceAmount !== "number" ||
    coverage.faceAmount <= 0
  ) {
    throw new Error("Invalid coverage amount: must be a positive number");
  }

  const stats = {
    totalProducts: 0,
    passedEligibility: 0,
    unknownEligibility: 0,
    passedAcceptance: 0,
    withPremiums: 0,
    ineligible: 0,
  };

  const products = await getProducts(input);
  stats.totalProducts = products.length;
  const productIds = products.map((p) => p.productId);

  // OPTIMIZATION: Fetch criteria, premium matrices, and build charts in parallel
  const [criteriaMap, premiumMatrixMap, buildChartMap] = await Promise.all([
    getExtractedCriteriaMap(productIds),
    batchFetchPremiumMatrices(productIds, imoId, client.gender, client.tobacco),
    batchFetchBuildCharts(products, imoId),
  ]);

  // Build evaluation context (shared across all product evaluations)
  const evaluationContext: ProductEvaluationContext = {
    client,
    coverage,
    imoId,
    inputTermYears: input.termYears,
    criteriaMap,
    premiumMatrixMap,
    buildChartMap,
  };

  // PARALLEL PRODUCT EVALUATION
  // Use p-limit to evaluate products concurrently (10 at a time)
  const limit = pLimit(PARALLEL_PRODUCT_LIMIT);
  const evaluationPromises = products.map((product) =>
    limit(() => evaluateSingleProduct(product, evaluationContext)),
  );
  const evaluationResults = await Promise.all(evaluationPromises);

  // Aggregate results and stats
  const eligibleProducts: EvaluatedProduct[] = [];
  const unknownProducts: EvaluatedProduct[] = [];

  for (const result of evaluationResults) {
    // Aggregate stats
    if (result.stats.passedEligibility) stats.passedEligibility++;
    if (result.stats.unknownEligibility) stats.unknownEligibility++;
    if (result.stats.passedAcceptance) stats.passedAcceptance++;
    if (result.stats.withPremium) stats.withPremiums++;
    if (result.stats.ineligible) stats.ineligible++;

    // Categorize evaluated products
    if (result.evaluated) {
      if (result.evaluated.eligibility.status === "eligible") {
        eligibleProducts.push(result.evaluated);
      } else {
        unknownProducts.push(result.evaluated);
      }
    }
  }

  // Recalculate scores with proper maxPremium
  const allWithPremiums = [...eligibleProducts, ...unknownProducts].filter(
    (e) => e.premium !== null,
  );
  const maxPremium =
    allWithPremiums.length > 0
      ? Math.max(...allWithPremiums.map((e) => e.premium!))
      : 0;

  // Recalculate with actual maxPremium
  const recalculate = (e: EvaluatedProduct): EvaluatedProduct => {
    const scoreComponents = calculateScore(
      e.approval.likelihood,
      e.premium,
      maxPremium,
      e.eligibility.status,
      e.eligibility.confidence,
    );
    const rawScore =
      e.approval.likelihood * 0.4 + scoreComponents.priceScore * 0.6;
    const finalScore = rawScore * scoreComponents.confidenceMultiplier;
    return { ...e, scoreComponents, finalScore };
  };

  const scoredEligible = eligibleProducts.map(recalculate);
  const scoredUnknown = unknownProducts.map(recalculate);

  // Sort by final score
  scoredEligible.sort((a, b) => b.finalScore - a.finalScore);
  scoredUnknown.sort((a, b) => b.finalScore - a.finalScore);

  // Helper to convert EvaluatedProduct to Recommendation
  const toRecommendation = (
    e: EvaluatedProduct,
    reason: Recommendation["reason"],
  ): Recommendation => ({
    carrierId: e.product.carrierId,
    carrierName: e.product.carrierName,
    productId: e.product.productId,
    productName: e.product.productName,
    productType: e.product.productType,
    monthlyPremium: e.premium,
    maxCoverage: e.maxCoverage,
    approvalLikelihood: e.approval.likelihood,
    healthClassResult: e.approval.healthClass,
    healthClassRequested: e.healthClassRequested,
    healthClassUsed: e.healthClassUsed,
    wasFallback: e.wasFallback,
    availableRateClasses: e.availableRateClasses,
    termYears: e.termYears,
    availableTerms: e.availableTerms,
    alternativeQuotes: e.alternativeQuotes,
    reason,
    concerns: e.approval.concerns,
    conditionDecisions: e.approval.conditionDecisions,
    score: e.finalScore,
    eligibilityStatus: e.eligibility.status,
    eligibilityReasons: e.eligibility.reasons,
    missingFields: e.eligibility.missingFields,
    confidence: e.eligibility.confidence,
    scoreComponents: e.scoreComponents,
    draftRulesFyi: e.approval.draftRules,
    buildRating: e.buildRating,
  });

  // Build recommendations from eligible products (only those with premiums)
  const recommendations: Recommendation[] = [];
  const seen = new Set<string>();
  const scoredEligibleWithPremium = scoredEligible.filter(
    (e) => e.premium !== null,
  );

  // Best value (highest score among eligible)
  if (scoredEligibleWithPremium.length > 0) {
    const best = scoredEligibleWithPremium[0];
    seen.add(best.product.productId);
    recommendations.push(toRecommendation(best, "best_value"));
  }

  // Cheapest (lowest premium among eligible)
  const byPrice = [...scoredEligibleWithPremium]
    .filter((e) => e.premium !== null)
    .sort((a, b) => a.premium! - b.premium!);
  const cheapest = byPrice.find((p) => !seen.has(p.product.productId));
  if (cheapest) {
    seen.add(cheapest.product.productId);
    recommendations.push(toRecommendation(cheapest, "cheapest"));
  }

  // Best approval (highest likelihood among eligible)
  const byApproval = [...scoredEligibleWithPremium].sort(
    (a, b) => b.approval.likelihood - a.approval.likelihood,
  );
  const bestApproval = byApproval.find((p) => !seen.has(p.product.productId));
  if (bestApproval) {
    seen.add(bestApproval.product.productId);
    recommendations.push(toRecommendation(bestApproval, "best_approval"));
  }

  // Highest coverage (max coverage among eligible)
  const byCoverage = [...scoredEligibleWithPremium].sort(
    (a, b) => b.maxCoverage - a.maxCoverage,
  );
  const highestCoverage = byCoverage.find(
    (p) => !seen.has(p.product.productId),
  );
  if (highestCoverage) {
    recommendations.push(toRecommendation(highestCoverage, "highest_coverage"));
  }

  // Build all eligible list (no specific reason, sorted by score)
  const eligibleRecommendations: Recommendation[] = scoredEligible.map((e) =>
    toRecommendation(e, null),
  );

  // Build unknown eligibility list (no specific reason, sorted by score)
  const unknownEligibility: Recommendation[] = scoredUnknown.map((e) =>
    toRecommendation(e, null),
  );

  return {
    recommendations,
    eligibleProducts: eligibleRecommendations,
    unknownEligibility,
    filtered: stats,
    processingTime: Date.now() - startTime,
  };
}
