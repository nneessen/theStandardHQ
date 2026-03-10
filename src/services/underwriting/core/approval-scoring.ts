// src/services/underwriting/approval-scoring.ts
// Stage 2: Approval Scoring
// Calculates approval likelihood based on carrier acceptance rules.

import type {
  HealthClass,
  ConditionDecision,
  ProductType,
  ApprovalResult,
} from "./decision-engine.types";
import type {
  DraftRuleInfo,
  RuleProvenance,
  UWAcceptanceDecision as TypesAcceptanceDecision,
} from "@/features/underwriting";
import {
  lookupAcceptance,
  getDraftRulesForConditions,
  type AcceptanceDecision,
} from "../repositories/acceptanceService";
import type { BuildRatingClass } from "@/features/underwriting";

// =============================================================================
// Constants
// =============================================================================

/** Severity ranking for health/build classes (higher = worse) */
export const HEALTH_CLASS_SEVERITY: Record<string, number> = {
  preferred_plus: 0,
  preferred: 1,
  standard_plus: 2,
  standard: 3,
  // All table ratings (A-P) map to table_rated for premium lookup
  table_a: 4,
  table_b: 4,
  table_c: 4,
  table_d: 4,
  table_e: 4,
  table_f: 4,
  table_g: 4,
  table_h: 4,
  table_i: 4,
  table_j: 4,
  table_k: 4,
  table_l: 4,
  table_m: 4,
  table_n: 4,
  table_o: 4,
  table_p: 4,
  table_rated: 4,
};

// =============================================================================
// Build Constraint
// =============================================================================

/**
 * Returns the WORSE of the rule engine health class and build chart rating.
 * Acts as a floor: build chart cannot improve the health class, only worsen it.
 * All substandard table ratings (A-P) map to table_rated HealthClass for premium lookup.
 *
 * @param ruleEngineClass - Health class from rule engine evaluation
 * @param buildRating - Build rating from carrier build chart
 * @returns The effective health class (worse of the two)
 */
export function applyBuildConstraint(
  ruleEngineClass: HealthClass,
  buildRating: BuildRatingClass,
): HealthClass {
  const reSeverity = HEALTH_CLASS_SEVERITY[ruleEngineClass] ?? 3;
  const buildSeverity = HEALTH_CLASS_SEVERITY[buildRating] ?? 3;
  if (buildSeverity > reSeverity) {
    // Build chart is worse — map to the appropriate HealthClass
    // Standard classes map directly; table ratings map to table_rated
    const standardClassMap: Record<string, HealthClass> = {
      preferred_plus: "preferred_plus",
      preferred: "preferred",
      standard_plus: "standard_plus",
      standard: "standard",
    };
    return standardClassMap[buildRating] ?? "table_rated";
  }
  return ruleEngineClass;
}

// =============================================================================
// Health Class Determination
// =============================================================================

/**
 * Determine health class based on condition decisions.
 * Returns the worst health class among all conditions.
 *
 * @param conditionDecisions - Array of condition decisions with health class results
 * @returns The worst health class (highest severity)
 */
export function determineHealthClass(
  conditionDecisions: ConditionDecision[],
): HealthClass {
  const healthClasses: HealthClass[] = [
    "preferred_plus",
    "preferred",
    "standard_plus",
    "standard",
    "table_rated",
  ];
  let worstIndex = 0;

  for (const decision of conditionDecisions) {
    if (decision.healthClassResult) {
      const healthResult = decision.healthClassResult.startsWith("table_")
        ? "table_rated"
        : (decision.healthClassResult as HealthClass);

      const index = healthClasses.indexOf(healthResult);
      if (index > worstIndex) {
        worstIndex = index;
      }
    }
  }

  return healthClasses[worstIndex];
}

// =============================================================================
// Approval Calculation (Legacy v1)
// =============================================================================

/**
 * Calculate approval likelihood based on carrier acceptance rules.
 * Only uses approved rules for scoring; collects draft rules for FYI display.
 *
 * @deprecated Use calculateApprovalV2 from ruleEngineV2Adapter instead.
 * Kept for backward compatibility and type reference.
 *
 * @param carrierId - The carrier ID
 * @param productType - The product type
 * @param healthConditions - Array of condition codes
 * @param imoId - The IMO ID for rule lookup
 * @returns Approval result with likelihood, health class, and condition decisions
 */
export async function calculateApproval(
  carrierId: string,
  productType: ProductType,
  healthConditions: string[],
  imoId: string,
): Promise<ApprovalResult> {
  const conditionDecisions: ConditionDecision[] = [];
  const concerns: string[] = [];
  const draftRules: DraftRuleInfo[] = [];

  // No conditions = healthy client
  if (healthConditions.length === 0) {
    return {
      likelihood: 0.95,
      healthClass: "preferred",
      conditionDecisions: [],
      concerns: [],
      draftRules: [],
    };
  }

  // Fetch draft rules for FYI display (does not affect scoring)
  try {
    const drafts = await getDraftRulesForConditions(
      carrierId,
      healthConditions,
      imoId,
    );
    for (const draft of drafts) {
      draftRules.push({
        conditionCode: draft.condition_code,
        decision: draft.acceptance as TypesAcceptanceDecision,
        reviewStatus:
          (draft.review_status as DraftRuleInfo["reviewStatus"]) || "draft",
        source: draft.source_snippet || undefined,
      });
    }
  } catch (e) {
    // Non-critical: log but continue
    console.warn("Failed to fetch draft rules for FYI:", e);
  }

  // Evaluate each condition using only approved rules
  for (const conditionCode of healthConditions) {
    // lookupAcceptance defaults to approved rules only
    const acceptance = await lookupAcceptance(
      carrierId,
      conditionCode,
      imoId,
      productType,
    );

    if (acceptance) {
      // Build provenance if available
      const provenance: RuleProvenance | undefined =
        acceptance.source_guide_id ||
        acceptance.source_pages ||
        acceptance.source_snippet
          ? {
              guideId: acceptance.source_guide_id ?? undefined,
              pages: acceptance.source_pages ?? undefined,
              snippet: acceptance.source_snippet ?? undefined,
              confidence: acceptance.extraction_confidence ?? undefined,
              reviewStatus:
                (acceptance.review_status as RuleProvenance["reviewStatus"]) ||
                "approved",
            }
          : undefined;

      conditionDecisions.push({
        conditionCode,
        decision: acceptance.acceptance as AcceptanceDecision,
        likelihood: acceptance.approval_likelihood ?? 0.5,
        healthClassResult: acceptance.health_class_result,
        isApproved: true, // We only get approved rules here
        provenance,
      });

      if (acceptance.acceptance === "declined") {
        concerns.push(`${conditionCode}: declined`);
      } else if (acceptance.acceptance === "case_by_case") {
        concerns.push(`${conditionCode}: requires review`);
      } else if (acceptance.acceptance === "table_rated") {
        concerns.push(`${conditionCode}: table rated`);
      }
    } else {
      // No approved rule found
      conditionDecisions.push({
        conditionCode,
        decision: "case_by_case",
        likelihood: 0.5,
        healthClassResult: null,
        isApproved: false, // No rule = not approved
      });
      concerns.push(`${conditionCode}: no approved rule found`);
    }
  }

  // Check for declined
  if (conditionDecisions.some((d) => d.decision === "declined")) {
    return {
      likelihood: 0,
      healthClass: "standard",
      conditionDecisions,
      concerns,
      draftRules,
    };
  }

  // Calculate overall likelihood (minimum)
  const likelihood = Math.min(...conditionDecisions.map((d) => d.likelihood));

  // Determine health class
  const healthClass = determineHealthClass(conditionDecisions);

  return { likelihood, healthClass, conditionDecisions, concerns, draftRules };
}
