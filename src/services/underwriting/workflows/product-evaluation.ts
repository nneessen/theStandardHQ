// src/services/underwriting/product-evaluation.ts
// Stage 4: Product Evaluation
// Handles product fetching, batch optimization, scoring, and single product evaluation.

import { supabase } from "@/services/base";
import type {
  ProductCandidate,
  ProductMetadata,
  DecisionEngineInput,
  EvaluatedProduct,
  BuildChartInfo,
  ProductEvaluationContext,
  ProductEvaluationResult,
  ExtractedCriteria,
  HealthClass,
  ApprovalResult,
} from "../core/decision-engine.types";
import type { EligibilityStatus } from "@/features/underwriting";
import type {
  ScoreComponents,
  BuildTableType,
  BuildTableData,
  BmiTableData,
  BuildRatingClass,
} from "@/features/underwriting";
import { lookupBuildRatingUnified } from "@/features/underwriting";
import {
  getPremiumMatrixForProduct,
  getAvailableTermsForAge,
  getLongestAvailableTermForAge,
  getAvailableRateClassesForQuote,
  calculateAlternativeQuotes,
  getComparisonFaceAmounts,
  type GenderType,
  type TobaccoClass,
  type TermYears,
  type PremiumMatrix,
  type AlternativeQuote,
} from "../repositories/premiumMatrixService";
import {
  checkEligibility,
  getMaxFaceAmountForAgeTerm,
} from "../core/eligibility-filter";
import { applyBuildConstraint } from "../core/approval-scoring";
import { getPremium } from "../core/premium-calculator";
import {
  calculateApprovalV2,
  type ClientProfileV2,
} from "./ruleEngineV2Adapter";

// Debug flag - set to false in production to suppress verbose logging
const DEBUG_DECISION_ENGINE =
  import.meta.env.DEV && import.meta.env.VITE_DEBUG_DECISION_ENGINE === "true";

// Concurrency limit for parallel product evaluation (10 concurrent products)
export const PARALLEL_PRODUCT_LIMIT = 10;

// =============================================================================
// Product Fetching
// =============================================================================

/**
 * Get all products that match the input criteria.
 *
 * @param input - The decision engine input
 * @returns Array of product candidates
 */
export async function getProducts(
  input: DecisionEngineInput,
): Promise<ProductCandidate[]> {
  const { coverage, imoId } = input;

  let query = supabase
    .from("products")
    .select(
      `
      id, name, product_type, min_age, max_age,
      min_face_amount, max_face_amount, carrier_id, metadata,
      build_chart_id,
      carriers!inner(id, name)
    `,
    )
    .eq("is_active", true);

  if (coverage.productTypes && coverage.productTypes.length > 0) {
    query = query.in("product_type", coverage.productTypes);
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
      productType: p.product_type,
      minAge: p.min_age,
      maxAge: p.max_age,
      minFaceAmount: p.min_face_amount,
      maxFaceAmount: p.max_face_amount,
      metadata: (p.metadata as ProductMetadata) || null,
      buildChartId: p.build_chart_id ?? null,
    };
  });
}

// =============================================================================
// Batch Data Fetching
// =============================================================================

/**
 * Get extracted criteria for multiple products (latest approved per product).
 *
 * @param productIds - Array of product IDs
 * @returns Map of productId to ExtractedCriteria
 */
export async function getExtractedCriteriaMap(
  productIds: string[],
): Promise<Map<string, ExtractedCriteria>> {
  const criteriaMap = new Map<string, ExtractedCriteria>();
  if (productIds.length === 0) return criteriaMap;

  const { data, error } = await supabase
    .from("carrier_underwriting_criteria")
    .select("product_id, criteria, updated_at")
    .in("product_id", productIds)
    .eq("review_status", "approved")
    .order("product_id", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching extracted criteria:", error);
    return criteriaMap;
  }

  for (const row of data || []) {
    if (!criteriaMap.has(row.product_id)) {
      criteriaMap.set(
        row.product_id,
        row.criteria as unknown as ExtractedCriteria,
      );
    }
  }

  return criteriaMap;
}

/**
 * Batch fetch premium matrices for all products in a single query.
 * This is a major performance optimization - instead of N queries (one per product),
 * we fetch all matrices with a single query using an IN clause.
 *
 * Filters by gender + tobacco_class to reduce payload ~75%. These filters are safe
 * because interpolatePremium and getAvailableRateClassesForQuote already filter to
 * a single gender + tobacco combination internally.
 *
 * @param productIds - Array of product IDs
 * @param imoId - IMO ID for filtering
 * @param gender - Client gender to filter matrix rows
 * @param tobaccoUse - Client tobacco usage to filter matrix rows
 * @returns Map of productId to PremiumMatrix array
 */
export async function batchFetchPremiumMatrices(
  productIds: string[],
  imoId: string,
  gender: GenderType,
  tobaccoUse: boolean,
): Promise<Map<string, PremiumMatrix[]>> {
  const matrixMap = new Map<string, PremiumMatrix[]>();
  if (productIds.length === 0) return matrixMap;

  // Supabase project caps at 5000 rows per request (PostgREST db_max_rows).
  // We paginate with .range() to fetch everything.
  const PAGE_SIZE = 5000;
  const tobaccoClass: TobaccoClass = tobaccoUse ? "tobacco" : "non_tobacco";

  const selectQuery = `
    *,
    product:products(id, name, product_type, carrier_id)
  `;

  // First page + exact count to know total rows
  const {
    data: firstPage,
    error,
    count,
  } = await supabase
    .from("premium_matrix")
    .select(selectQuery, { count: "exact" })
    .in("product_id", productIds)
    .eq("imo_id", imoId)
    .eq("gender", gender)
    .eq("tobacco_class", tobaccoClass)
    .order("product_id", { ascending: true })
    .order("age", { ascending: true })
    .order("face_amount", { ascending: true })
    .range(0, PAGE_SIZE - 1);

  if (error) {
    console.error("Error batch fetching premium matrices:", error);
    return matrixMap;
  }

  let allData = (firstPage || []) as PremiumMatrix[];
  const totalRows = count ?? allData.length;

  // Fetch remaining pages in parallel if we hit the page limit
  if (allData.length >= PAGE_SIZE && totalRows > PAGE_SIZE) {
    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    const remainingPromises = Array.from({ length: totalPages - 1 }, (_, i) =>
      supabase
        .from("premium_matrix")
        .select(selectQuery)
        .in("product_id", productIds)
        .eq("imo_id", imoId)
        .eq("gender", gender)
        .eq("tobacco_class", tobaccoClass)
        .order("product_id", { ascending: true })
        .order("age", { ascending: true })
        .order("face_amount", { ascending: true })
        .range((i + 1) * PAGE_SIZE, (i + 2) * PAGE_SIZE - 1),
    );

    const remainingResults = await Promise.all(remainingPromises);
    for (const result of remainingResults) {
      if (result.error) {
        console.error("Error fetching batch page:", result.error);
        // Continue with what we have — fallback will cover missing products
        break;
      }
      allData = allData.concat((result.data || []) as PremiumMatrix[]);
    }
  }

  console.log(
    `[BatchFetch] Fetched ${allData.length}/${totalRows} rows for ${productIds.length} products (gender=${gender}, tobacco=${tobaccoClass})`,
  );

  // Group by productId
  for (const row of allData) {
    const pid = row.product_id;
    if (!matrixMap.has(pid)) {
      matrixMap.set(pid, []);
    }
    matrixMap.get(pid)!.push(row);
  }

  // Log which products got data
  const productsWithData = matrixMap.size;
  const productsMissing = productIds.filter((pid) => !matrixMap.has(pid));
  console.log(
    `[BatchFetch] Products with matrix data: ${productsWithData}/${productIds.length}`,
  );
  if (productsMissing.length > 0) {
    console.log(
      `[BatchFetch] Products WITHOUT matrix data: ${productsMissing.length}`,
    );
  }

  // NOTE: Do NOT initialize empty arrays for missing products
  // This allows the fallback in evaluateSingleProduct to trigger correctly

  return matrixMap;
}

/**
 * Batch-fetch build charts for all products.
 * Resolves product-specific charts (via build_chart_id) and carrier defaults.
 * Returns Map<productId, BuildChartInfo> for O(1) lookup during evaluation.
 *
 * @param products - Array of product candidates
 * @param imoId - IMO ID for filtering
 * @returns Map of productId to BuildChartInfo
 */
export async function batchFetchBuildCharts(
  products: ProductCandidate[],
  imoId: string,
): Promise<Map<string, BuildChartInfo>> {
  const chartMap = new Map<string, BuildChartInfo>();
  if (products.length === 0) return chartMap;

  // Collect product-specific chart IDs and carrier IDs needing defaults
  const specificChartIds: string[] = [];
  const carriersNeedingDefault: string[] = [];
  const productsByChartId = new Map<string, string[]>(); // chartId → productIds
  const productsByCarrier = new Map<string, string[]>(); // carrierId → productIds (without specific chart)

  for (const p of products) {
    if (p.buildChartId) {
      specificChartIds.push(p.buildChartId);
      const existing = productsByChartId.get(p.buildChartId) ?? [];
      existing.push(p.productId);
      productsByChartId.set(p.buildChartId, existing);
    } else {
      if (!carriersNeedingDefault.includes(p.carrierId)) {
        carriersNeedingDefault.push(p.carrierId);
      }
      const existing = productsByCarrier.get(p.carrierId) ?? [];
      existing.push(p.productId);
      productsByCarrier.set(p.carrierId, existing);
    }
  }

  // Fetch product-specific charts and carrier defaults in parallel
  const [specificCharts, defaultCharts] = await Promise.all([
    specificChartIds.length > 0
      ? supabase
          .from("carrier_build_charts")
          .select("id, table_type, build_data, bmi_data")
          .in("id", specificChartIds)
          .then(({ data, error }) => {
            if (error) {
              console.error("Error fetching specific build charts:", error);
              return [];
            }
            return data || [];
          })
      : Promise.resolve([]),
    carriersNeedingDefault.length > 0
      ? supabase
          .from("carrier_build_charts")
          .select(
            "id, carrier_id, table_type, build_data, bmi_data, is_default, created_at",
          )
          .in("carrier_id", carriersNeedingDefault)
          .eq("imo_id", imoId)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true })
          .then(({ data, error }) => {
            if (error) {
              console.error("Error fetching default build charts:", error);
              return [];
            }
            return data || [];
          })
      : Promise.resolve([]),
  ]);

  // Map specific charts to their products
  for (const chart of specificCharts) {
    const info: BuildChartInfo = {
      tableType: chart.table_type as BuildTableType,
      buildData: chart.build_data as unknown as BuildTableData | null,
      bmiData: chart.bmi_data as unknown as BmiTableData | null,
    };
    const productIds = productsByChartId.get(chart.id) ?? [];
    for (const pid of productIds) {
      chartMap.set(pid, info);
    }
  }

  // Map carrier defaults to products without specific charts
  // Group by carrier and take the first (default or oldest)
  const carrierDefaults = new Map<string, BuildChartInfo>();
  for (const chart of defaultCharts) {
    if (!carrierDefaults.has(chart.carrier_id)) {
      carrierDefaults.set(chart.carrier_id, {
        tableType: chart.table_type as BuildTableType,
        buildData: chart.build_data as unknown as BuildTableData | null,
        bmiData: chart.bmi_data as unknown as BmiTableData | null,
      });
    }
  }

  for (const [carrierId, info] of carrierDefaults) {
    const productIds = productsByCarrier.get(carrierId) ?? [];
    for (const pid of productIds) {
      if (!chartMap.has(pid)) {
        chartMap.set(pid, info);
      }
    }
  }

  if (DEBUG_DECISION_ENGINE) {
    console.log(
      `[BatchFetchBuildCharts] Resolved ${chartMap.size}/${products.length} products with build charts`,
    );
  }

  return chartMap;
}

// =============================================================================
// Scoring
// =============================================================================

/**
 * Calculate composite score for ranking.
 * Applies derived confidence penalty for unknown eligibility products.
 *
 * @param approvalLikelihood - Likelihood of approval (0-1)
 * @param monthlyPremium - Monthly premium amount
 * @param maxPremium - Maximum premium in the result set (for normalization)
 * @param eligibilityStatus - Tri-state eligibility: eligible, unknown, ineligible
 * @param dataConfidence - Data completeness confidence (0-1)
 * @returns Score components including final score with penalty applied
 */
export function calculateScore(
  approvalLikelihood: number,
  monthlyPremium: number | null,
  maxPremium: number,
  eligibilityStatus: EligibilityStatus,
  dataConfidence: number,
): ScoreComponents {
  // Price score: 1 = cheapest, 0 = most expensive
  const priceScore =
    maxPremium > 0 && monthlyPremium !== null
      ? 1 - monthlyPremium / maxPremium
      : 0.5;

  // Derived confidence multiplier for unknown eligibility
  // Range: 0.5 to 1.0 based on data completeness
  // If eligible, no penalty (multiplier = 1)
  // If unknown, penalty based on how much data is missing
  const confidenceMultiplier =
    eligibilityStatus === "unknown"
      ? 0.5 + dataConfidence * 0.5 // Range: 0.5 to 1.0
      : 1.0;

  // Returns components; caller computes:
  // rawScore = likelihood * 0.4 + priceScore * 0.6
  // finalScore = rawScore * confidenceMultiplier

  return {
    likelihood: approvalLikelihood,
    priceScore,
    dataConfidence,
    confidenceMultiplier,
  };
}

export function buildApprovalClientProfile(
  client: ProductEvaluationContext["client"],
): ClientProfileV2 {
  return {
    age: client.age,
    gender: client.gender as "male" | "female",
    state: client.state,
    bmi: client.bmi,
    tobacco: client.tobacco,
    healthConditions: client.healthConditions,
    medications: client.medications,
    conditionResponses: client.conditionResponses,
  };
}

const MANUAL_REVIEW_REQUIRED_REASON =
  "Carrier/product requires manual underwriting review for one or more reported medical conditions or medications.";

export function requiresManualReviewForRecommendation(
  approval: Pick<ApprovalResult, "conditionDecisions">,
): boolean {
  return approval.conditionDecisions.some(
    (decision) =>
      decision.decision === "case_by_case" || decision.isApproved !== true,
  );
}

export function applyRecommendationSafetyGate(
  eligibility: EvaluatedProduct["eligibility"],
  approval: Pick<ApprovalResult, "conditionDecisions">,
): EvaluatedProduct["eligibility"] {
  if (
    eligibility.status !== "eligible" ||
    !requiresManualReviewForRecommendation(approval)
  ) {
    return eligibility;
  }

  return {
    ...eligibility,
    status: "unknown",
    reasons: [
      ...new Set([...eligibility.reasons, MANUAL_REVIEW_REQUIRED_REASON]),
    ],
    confidence: Math.min(eligibility.confidence, 0.75),
  };
}

// =============================================================================
// Single Product Evaluation
// =============================================================================

/**
 * Evaluates a single product for recommendations.
 * This function is designed to be called in parallel for multiple products.
 *
 * @param product - The product candidate to evaluate
 * @param ctx - Evaluation context (client, coverage, imoId, etc.)
 * @returns Evaluation result with the evaluated product or null if ineligible
 */
export async function evaluateSingleProduct(
  product: ProductCandidate,
  ctx: ProductEvaluationContext,
): Promise<ProductEvaluationResult> {
  const {
    client,
    coverage,
    imoId,
    inputTermYears,
    criteriaMap,
    premiumMatrixMap,
  } = ctx;

  // Initialize stats for this product
  const stats = {
    passedEligibility: false,
    unknownEligibility: false,
    passedAcceptance: false,
    withPremium: false,
    ineligible: false,
  };

  // ==========================================================================
  // FIX 3: DETERMINE TERM BEFORE ELIGIBILITY
  // We must determine the effective term FIRST, then use it consistently for
  // both eligibility checking AND premium lookup. This prevents the bug where
  // eligibility passes with undefined term (using base limits) but pricing
  // uses a specific term with stricter limits.
  // ==========================================================================

  // OPTIMIZATION: Use pre-fetched matrix from batch query (eliminates N+1 queries)
  // Falls back to individual fetch if product not in cache
  const prefetchedMatrix = premiumMatrixMap.get(product.productId);
  const matrix =
    prefetchedMatrix !== undefined && prefetchedMatrix.length > 0
      ? prefetchedMatrix
      : await getPremiumMatrixForProduct(product.productId, imoId);
  const availableTerms = getAvailableTermsForAge(matrix, client.age);
  const longestTerm = getLongestAvailableTermForAge(matrix, client.age);

  // Check if this is a permanent product (all matrix rows have term_years === null)
  const isPermanentProduct =
    matrix.length > 0 && matrix.every((row) => row.term_years === null);

  // Skip product if no terms are available for this age (only for term products)
  if (availableTerms.length === 0 && matrix.length > 0 && !isPermanentProduct) {
    if (DEBUG_DECISION_ENGINE) {
      console.log(
        `[DecisionEngine] Skipping ${product.productName}: No terms available for age ${client.age}`,
      );
    }
    stats.ineligible = true;
    return { evaluated: null, stats };
  }

  // Determine effective term for BOTH eligibility AND pricing:
  // 1. For permanent products, use null (no term)
  // 2. If input.termYears is specified and available, use it
  // 3. Otherwise fall back to longest available term
  let effectiveTermYears: TermYears | null = isPermanentProduct
    ? null
    : longestTerm;

  if (
    !isPermanentProduct &&
    inputTermYears !== undefined &&
    inputTermYears !== null
  ) {
    if (availableTerms.includes(inputTermYears)) {
      effectiveTermYears = inputTermYears as TermYears;
    } else {
      // Requested term not available for this age - skip this product
      if (DEBUG_DECISION_ENGINE) {
        console.log(
          `[DecisionEngine] Skipping ${product.productName}: Requested term ${inputTermYears}yr not available for age ${client.age}. Available: [${availableTerms.join(", ")}]`,
        );
      }
      stats.ineligible = true;
      return { evaluated: null, stats };
    }
  }

  // Debug: Log term determination
  if (DEBUG_DECISION_ENGINE) {
    console.log(
      `[DecisionEngine] Term determined for ${product.productName}:`,
      {
        inputTermYears,
        effectiveTermYears,
        availableTerms,
        isPermanentProduct,
        maxFaceAmount: product.maxFaceAmount,
        ageTieredFaceAmounts: product.metadata?.ageTieredFaceAmounts,
      },
    );
  }

  // Stage 1: Eligibility (tri-state)
  // CRITICAL: Pass effectiveTermYears (not input.termYears) to enforce
  // term-specific face amount restrictions consistently
  const criteria = criteriaMap.get(product.productId);
  const eligibility = checkEligibility(
    product,
    client,
    coverage,
    criteria,
    undefined, // requiredFieldsByCondition
    effectiveTermYears, // Use same term for eligibility AND pricing
  );

  // Handle tri-state eligibility
  if (eligibility.status === "ineligible") {
    stats.ineligible = true;
    return { evaluated: null, stats };
  }

  // Stage 2: Approval (uses rule engine v2 with compound predicates)
  const approval = await calculateApprovalV2({
    carrierId: product.carrierId,
    productId: product.productId,
    imoId,
    healthConditions: client.healthConditions,
    client: buildApprovalClientProfile(client),
  });

  // For unknown eligibility, we don't skip on low likelihood
  // For eligible products, skip if likelihood is 0 (declined)
  if (eligibility.status === "eligible" && approval.likelihood === 0) {
    stats.ineligible = true;
    return { evaluated: null, stats };
  }
  stats.passedAcceptance = true;

  const effectiveEligibility = applyRecommendationSafetyGate(
    eligibility,
    approval,
  );

  if (effectiveEligibility.status === "unknown") {
    stats.unknownEligibility = true;
  } else {
    stats.passedEligibility = true;
  }

  // Stage 2.5: Build Chart Constraint
  // Apply carrier build chart as a floor on health class
  let effectiveHealthClass: HealthClass = approval.healthClass;
  let buildRating: BuildRatingClass | undefined;

  const buildChart = ctx.buildChartMap.get(product.productId);
  if (
    buildChart &&
    client.heightFeet !== undefined &&
    client.heightInches !== undefined &&
    client.weight !== undefined
  ) {
    const buildResult = lookupBuildRatingUnified(
      client.heightFeet,
      client.heightInches,
      client.weight,
      buildChart.tableType,
      buildChart.buildData,
      buildChart.bmiData,
    );

    if (buildResult.ratingClass !== "unknown") {
      buildRating = buildResult.ratingClass;
      effectiveHealthClass = applyBuildConstraint(
        approval.healthClass,
        buildResult.ratingClass,
      );

      if (
        DEBUG_DECISION_ENGINE &&
        effectiveHealthClass !== approval.healthClass
      ) {
        console.log(
          `[DecisionEngine Stage 2.5] Build chart constraint applied for ${product.productName}:`,
          {
            ruleEngineClass: approval.healthClass,
            buildRating: buildResult.ratingClass,
            effectiveClass: effectiveHealthClass,
          },
        );
      }
    }
  }

  // Stage 3: Premium & Alternative Quotes
  // Use the same effectiveTermYears determined above
  const premiumLookupParams = {
    productId: product.productId,
    productName: product.productName,
    age: client.age,
    gender: client.gender,
    tobaccoClass: client.tobacco ? "tobacco" : "non_tobacco",
    healthClass: effectiveHealthClass,
    faceAmount: coverage.faceAmount,
    imoId,
    termYears: effectiveTermYears,
  };
  if (DEBUG_DECISION_ENGINE) {
    console.log(
      `[DecisionEngine Stage 3] Attempting premium lookup:`,
      premiumLookupParams,
    );
  }

  // termForQuotes is now effectiveTermYears (already determined above)
  const termForQuotes = effectiveTermYears;

  // Debug: Log product metadata to verify age-tiered constraints
  if (DEBUG_DECISION_ENGINE) {
    console.log(
      `[DecisionEngine Stage 3] Product metadata for ${product.productName}:`,
      {
        maxFaceAmount: product.maxFaceAmount,
        ageTieredFaceAmounts: product.metadata?.ageTieredFaceAmounts,
        hasMetadata: !!product.metadata,
        availableTermsForAge: availableTerms,
        isPermanentProduct,
        effectiveTermYears,
      },
    );
  }

  const premiumResult = await getPremium(
    product.productId,
    client.age,
    client.gender,
    client.tobacco,
    effectiveHealthClass,
    coverage.faceAmount,
    imoId,
    termForQuotes, // Use effectiveTermYears for both eligibility and pricing
    matrix, // Pass pre-fetched matrix to avoid duplicate DB query
  );

  // Extract premium and health class metadata from result
  const premium = premiumResult.premium;
  const healthClassRequested =
    premiumResult.premium !== null ? premiumResult.requested : undefined;
  const healthClassUsed =
    premiumResult.premium !== null ? premiumResult.used : undefined;
  const wasFallback =
    premiumResult.premium !== null ? !premiumResult.wasExact : undefined;
  const termYearsUsed =
    premiumResult.premium !== null ? premiumResult.termYears : undefined;
  const availableRateClasses = getAvailableRateClassesForQuote(
    matrix,
    client.gender,
    client.tobacco ? "tobacco" : "non_tobacco",
    termForQuotes,
  );

  // Debug: Log premium lookup result
  if (DEBUG_DECISION_ENGINE) {
    const matrixHealthClasses = [...new Set(matrix.map((m) => m.health_class))];
    console.log(
      `[DecisionEngine Stage 3] Premium result for ${product.productName}:`,
      {
        requestedTerm: inputTermYears,
        termUsed: termForQuotes,
        availableTerms,
        requestedHealthClass: approval.healthClass,
        healthClassUsed,
        wasFallback,
        premium,
        matrixRowCount: matrix.length,
        matrixFaceAmounts: [...new Set(matrix.map((m) => m.face_amount))].sort(
          (a, b) => a - b,
        ),
        // Show actual health class values in the matrix
        matrixHealthClasses,
        matrixHealthClassesRaw: matrixHealthClasses.join(", "),
      },
    );
  }

  // Calculate alternative quotes at different face amounts
  let alternativeQuotes: AlternativeQuote[] = [];
  if (premium !== null && healthClassUsed) {
    // Calculate age AND term adjusted max face amount using helper
    const ageTermAdjustedMaxFace = getMaxFaceAmountForAgeTerm(
      product.metadata,
      product.maxFaceAmount,
      client.age,
      termForQuotes,
    );

    // Use user-provided faceAmounts if available, otherwise generate comparison amounts
    let comparisonFaceAmounts: number[];
    if (coverage.faceAmounts && coverage.faceAmounts.length > 0) {
      // Filter user's amounts to be within product limits
      const minFace = product.minFaceAmount ?? 0;
      const maxFace = ageTermAdjustedMaxFace;
      comparisonFaceAmounts = coverage.faceAmounts
        .filter((amt) => amt >= minFace && amt <= maxFace)
        .sort((a, b) => a - b);
      // If no amounts fit within limits, use the closest valid amount
      if (comparisonFaceAmounts.length === 0) {
        comparisonFaceAmounts = [
          Math.min(Math.max(coverage.faceAmount, minFace), maxFace),
        ];
      }
    } else {
      comparisonFaceAmounts = getComparisonFaceAmounts(
        coverage.faceAmount,
        product.minFaceAmount,
        ageTermAdjustedMaxFace,
      );
    }

    // Diagnostic logging for alternative quotes calculation
    if (DEBUG_DECISION_ENGINE) {
      console.log(
        `[AlternativeQuotes] ${product.productName} - Age ${client.age}, Term ${termForQuotes ?? "N/A"}yr`,
      );
      console.log(
        `  Global max: $${product.maxFaceAmount?.toLocaleString() ?? "unlimited"}`,
      );
      console.log(
        `  Age+Term adjusted max: $${ageTermAdjustedMaxFace === Number.MAX_SAFE_INTEGER ? "unlimited" : ageTermAdjustedMaxFace.toLocaleString()}`,
      );
      console.log(
        `  Face amounts (${coverage.faceAmounts ? "user-provided" : "auto"}): ${comparisonFaceAmounts.map((f) => `$${f.toLocaleString()}`).join(", ")}`,
      );
    }

    const tobaccoClass: TobaccoClass = client.tobacco
      ? "tobacco"
      : "non_tobacco";
    alternativeQuotes = calculateAlternativeQuotes(
      matrix,
      comparisonFaceAmounts,
      client.age,
      client.gender,
      tobaccoClass,
      healthClassUsed,
      termYearsUsed ?? null,
    );
  }

  if (DEBUG_DECISION_ENGINE) {
    if (premium === null) {
      const reason =
        premiumResult.reason === "NON_RATEABLE_CLASS"
          ? "Health class is non-rateable (decline/refer)"
          : premiumResult.reason === "NO_MATRIX"
            ? "No premium matrix data"
            : "No matching rates after fallback";
      console.warn(
        `[DecisionEngine Stage 3] NO PREMIUM FOUND for ${product.productName}: ${reason}`,
        {
          ...premiumLookupParams,
          reason: premiumResult.reason,
        },
      );
    } else {
      const fallbackInfo = wasFallback
        ? ` (fallback: ${healthClassRequested} → ${healthClassUsed})`
        : "";
      console.log(
        `[DecisionEngine Stage 3] Premium found for ${product.productName}: $${premium}/month${fallbackInfo}`,
        { alternativeQuotes: alternativeQuotes.length },
      );
    }
  }

  // For unknown eligibility, premium can be null (we still keep the product)
  if (premium !== null) {
    stats.withPremium = true;
  }

  const maxCoverage = product.maxFaceAmount
    ? Math.min(product.maxFaceAmount, coverage.faceAmount)
    : coverage.faceAmount;

  // Calculate score with confidence penalty for unknown eligibility
  const scoreComponents = calculateScore(
    approval.likelihood,
    premium,
    0, // Will recalculate maxPremium later
    effectiveEligibility.status,
    effectiveEligibility.confidence,
  );

  // Calculate raw score for now (will be adjusted with maxPremium)
  const rawScore = approval.likelihood * 0.4 + scoreComponents.priceScore * 0.6;
  const finalScore = rawScore * scoreComponents.confidenceMultiplier;

  const evaluated: EvaluatedProduct = {
    product,
    eligibility: effectiveEligibility,
    approval,
    premium,
    healthClassRequested,
    healthClassUsed,
    wasFallback,
    availableRateClasses,
    termYears: termYearsUsed,
    availableTerms,
    alternativeQuotes,
    maxCoverage,
    scoreComponents,
    finalScore,
    buildRating,
  };

  return { evaluated, stats };
}
