import type { SupabaseClient } from "npm:@supabase/supabase-js@2.47.10";

import type { Database } from "../../../../src/types/database.types.ts";
import {
  transformConditionResponses,
  type TransformedConditionResponses,
} from "../../../../src/services/underwriting/core/conditionResponseTransformer.ts";
import {
  checkEligibility,
  getMaxFaceAmountForAgeTerm,
} from "../../../../src/services/underwriting/core/eligibility-filter.ts";
import { lookupBuildRatingUnified } from "../../../../src/features/underwriting/utils/rates/buildTableLookup.ts";
import { calculateBMI } from "../../../../src/features/underwriting/utils/shared/bmiCalculator.ts";
import {
  buildFactMap,
  evaluateRuleSet,
  aggregateOutcomes,
  generateInputHash,
} from "../../../../src/services/underwriting/core/ruleEvaluator.ts";
import {
  UnderwritingRuleSetSchema,
  type ConditionOutcome,
  type FactMap,
  type HealthClass as DSLHealthClass,
  type UnderwritingRuleSet,
} from "../../../../src/services/underwriting/core/ruleEngineDSL.ts";
import { deriveRuleConditionCodes } from "../../../../src/services/underwriting/core/derivedConditionCodes.ts";
import type {
  BuildChartInfo,
  DecisionEngineResult,
  ExtractedCriteria,
  ProductCandidate,
  Recommendation,
  EvaluatedProduct,
  ScoreComponents,
} from "../../../../src/services/underwriting/core/decision-engine.types.ts";
import type {
  AlternativeQuote,
  GenderType,
  HealthClass,
  PremiumMatrix,
  TermYears,
} from "../../../../src/services/underwriting/core/premium-matrix-core.ts";
import {
  calculateAlternativeQuotes,
  getAvailableRateClassesForQuote,
  getAvailableTermsForAge,
  getComparisonFaceAmounts,
  getLongestAvailableTermForAge,
  interpolatePremium,
} from "../../../../src/services/underwriting/core/premium-matrix-core.ts";
import type {
  DraftRuleInfo,
  RateTableRecommendation,
  SessionEligibilitySummary,
  SessionRecommendationInput,
} from "../../../../src/features/underwriting/types/underwriting.types.ts";

import type { UnderwritingRawPayload } from "./payload.ts";
import { parseHealthSnapshot } from "./payload.ts";
import type { RuleSetWithRules } from "./repositories.ts";
import {
  fetchBuildChartMap,
  fetchExtractedCriteriaMap,
  fetchPremiumMatrixMap,
  fetchProducts,
  fetchApprovedConditionRuleSets,
  fetchApprovedGlobalRuleSets,
} from "./repositories.ts";

const ENGINE_VERSION = "backend_authoritative_v1";

/**
 * User-facing reason surfaced when the engine cannot honestly assess a product
 * because it lacks curated carrier data for one or more stated conditions.
 * The system abstains here instead of fabricating a favorable health class.
 */
export const INSUFFICIENT_DATA_REASON =
  "Insufficient carrier data — manual review";

/**
 * A DSL health class is "assessable" only when it maps to a real underwriting
 * class. unknown/refer/decline carry NO favorable signal — historically
 * mapHealthClass() silently collapsed them to "standard", which made a
 * data-starved high-risk client read as average risk. We instead abstain.
 */
function isAssessableClass(healthClass: DSLHealthClass): boolean {
  return (
    healthClass !== "unknown" &&
    healthClass !== "refer" &&
    healthClass !== "decline"
  );
}

type ApprovalDecision =
  | "approved"
  | "table_rated"
  | "case_by_case"
  | "declined";

export interface ClientProfile {
  age: number;
  gender: GenderType;
  state?: string;
  bmi?: number;
  heightFeet?: number;
  heightInches?: number;
  weight?: number;
  tobacco: boolean;
  healthConditions: string[];
  medications?: UnderwritingRunMedicationInfo;
  conditionResponses?: TransformedConditionResponses;
}

type UnderwritingRunMedicationInfo = Parameters<
  typeof buildFactMap
>[0]["medications"];

interface CoverageRequest {
  faceAmount: number;
  faceAmounts?: number[];
  productTypes?: string[];
}

export interface ProductEvaluationContext {
  client: ClientProfile;
  coverage: CoverageRequest;
  imoId: string;
  inputTermYears: number | null;
  criteriaMap: Map<string, ExtractedCriteria>;
  premiumMatrixMap: Map<string, PremiumMatrix[]>;
  buildChartMap: Map<string, BuildChartInfo>;
  globalRuleSetsByCarrier: Map<string, RuleSetWithRules[]>;
  conditionRuleSetsByCarrier: Map<string, RuleSetWithRules[]>;
}

export interface PersistableAuditRow {
  ruleSetId: string | null;
  ruleId: string | null;
  conditionCode: string;
  predicateResult: "matched" | "failed" | "unknown" | "skipped";
  matchedConditions: unknown[] | null;
  failedConditions: unknown[] | null;
  missingFields: unknown[] | null;
  outcomeApplied: Record<string, unknown> | null;
  inputHash: string;
}

export interface AuthoritativeRunResult {
  decisionResult: DecisionEngineResult;
  sessionRecommendations: SessionRecommendationInput[];
  rateTableRecommendations: RateTableRecommendation[];
  eligibilitySummary: SessionEligibilitySummary;
  auditRows: PersistableAuditRow[];
  evaluationMetadata: Record<string, unknown>;
}

export interface ApprovalComputation {
  likelihood: number;
  healthClass: HealthClass;
  /**
   * True only when the engine had enough curated carrier data to produce a
   * trustworthy verdict (every stated condition matched an approved rule and
   * the aggregated class is a real underwriting class). When false, `healthClass`
   * is a suppressed placeholder and consumers must surface honest abstention
   * (see INSUFFICIENT_DATA_REASON) instead of the class.
   */
  assessable: boolean;
  conditionDecisions: Recommendation["conditionDecisions"];
  concerns: string[];
  draftRules: DraftRuleInfo[];
  evaluatedRuleSets: string[];
  auditRows: PersistableAuditRow[];
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function calculateAnnualPremium(monthlyPremium: number | null): number | null {
  if (monthlyPremium === null) {
    return null;
  }

  return roundTo(monthlyPremium * 12, 2);
}

function calculateCostPerThousand(
  annualPremium: number | null,
  faceAmount: number,
): number | null {
  if (annualPremium === null || faceAmount <= 0) {
    return null;
  }

  return roundTo(annualPremium / (faceAmount / 1000), 4);
}

function mapEligibilityToDecision(
  eligibility: "eligible" | "refer" | "ineligible" | "unknown",
  tableUnits: number,
): ApprovalDecision {
  if (eligibility === "ineligible") return "declined";
  if (eligibility === "refer" || eligibility === "unknown") {
    return "case_by_case";
  }
  return tableUnits > 0 ? "table_rated" : "approved";
}

function mapEligibilityToLikelihood(
  eligibility: "eligible" | "refer" | "ineligible" | "unknown",
): number {
  switch (eligibility) {
    case "eligible":
      return 0.9;
    case "refer":
      return 0.6;
    case "unknown":
      return 0.5;
    case "ineligible":
      return 0;
    default:
      return 0.5;
  }
}

function mapHealthClass(healthClass: DSLHealthClass): HealthClass {
  switch (healthClass) {
    case "preferred_plus":
      return "preferred_plus";
    case "preferred":
      return "preferred";
    case "standard_plus":
      return "standard_plus";
    case "standard":
      return "standard";
    case "substandard":
      return "table_rated";
    case "graded":
      return "graded";
    case "modified":
      return "modified";
    case "guaranteed_issue":
      return "guaranteed_issue";
    case "refer":
    case "decline":
    case "unknown":
    default:
      // No real class. The premium-matrix HealthClass union has no
      // unknown/refer/decline member, so abstention cannot be expressed here —
      // it is carried by ApprovalComputation.assessable (false in these cases),
      // and every consumer suppresses this placeholder when assessable is false.
      return "standard";
  }
}

function applyBuildConstraint(
  ruleEngineClass: HealthClass,
  buildRating: string,
): HealthClass {
  const severity: Record<string, number> = {
    preferred_plus: 0,
    preferred: 1,
    standard_plus: 2,
    standard: 3,
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

  const ruleSeverity = severity[ruleEngineClass] ?? 3;
  const buildSeverity = severity[buildRating] ?? 3;

  if (buildSeverity <= ruleSeverity) {
    return ruleEngineClass;
  }

  switch (buildRating) {
    case "preferred_plus":
      return "preferred_plus";
    case "preferred":
      return "preferred";
    case "standard_plus":
      return "standard_plus";
    case "standard":
      return "standard";
    default:
      return "table_rated";
  }
}

function calculateScore(
  approvalLikelihood: number,
  eligibilityStatus: Recommendation["eligibilityStatus"],
  dataConfidence: number,
): ScoreComponents {
  // Price is intentionally OUT OF SCOPE: we rank by probability of approval, not
  // premium. priceScore is retained in the shape (consumers read it) but pinned
  // to 0 so it can never re-enter ranking. Ranking = likelihood × dataConfidence
  // (× confidenceMultiplier, which down-weights unknown-eligibility products).
  return {
    likelihood: approvalLikelihood,
    priceScore: 0,
    dataConfidence,
    confidenceMultiplier:
      eligibilityStatus === "unknown" ? 0.5 + dataConfidence * 0.5 : 1,
  };
}

function requiresManualReviewForRecommendation(
  approval: Pick<ApprovalComputation, "conditionDecisions">,
): boolean {
  return approval.conditionDecisions.some(
    (decision) =>
      decision.decision === "case_by_case" || decision.isApproved !== true,
  );
}

function applyRecommendationSafetyGate(
  eligibility: EvaluatedProduct["eligibility"],
  approval: Pick<ApprovalComputation, "conditionDecisions">,
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
      ...new Set([
        ...eligibility.reasons,
        "Carrier/product requires manual underwriting review for one or more reported medical conditions or medications.",
      ]),
    ],
    confidence: Math.min(eligibility.confidence, 0.75),
  };
}

function chooseHighestVersionRuleSet(
  ruleSets: RuleSetWithRules[],
): RuleSetWithRules | null {
  if (ruleSets.length === 0) {
    return null;
  }

  return [...ruleSets].sort(
    (a, b) => (b.version ?? -Infinity) - (a.version ?? -Infinity),
  )[0];
}

function adaptRuleSetForEvaluation(
  ruleSet: RuleSetWithRules,
): UnderwritingRuleSet {
  const prepared = {
    ...ruleSet,
    version: ruleSet.version ?? 1,
    variant: ruleSet.variant ?? "default",
    default_outcome: ruleSet.default_outcome ?? undefined,
    rules: ruleSet.rules?.map((rule) => ({
      ...rule,
      predicate_version: rule.predicate_version ?? 2,
      predicate: rule.predicate,
    })),
  };

  const parsed = UnderwritingRuleSetSchema.safeParse(prepared);
  return (parsed.success ? parsed.data : prepared) as UnderwritingRuleSet;
}

function buildApprovalClientProfile(client: ClientProfile) {
  return {
    age: client.age,
    gender: client.gender,
    state: client.state,
    bmi: client.bmi,
    tobacco: client.tobacco,
    healthConditions: client.healthConditions,
    medications: client.medications,
    conditionResponses: client.conditionResponses,
  };
}

export function toRateTableRecommendation(
  recommendation: Recommendation,
): RateTableRecommendation {
  // Honest abstention: never present a class or premium for a product the
  // engine could not assess. (Defense-in-depth — evaluateProduct already emits
  // null premium for non-assessable products — but this also covers any future
  // consumer that constructs a non-assessable Recommendation by another path.)
  if (recommendation.assessable === false) {
    return {
      carrierName: recommendation.carrierName,
      productName: recommendation.productName,
      termYears: recommendation.termYears ?? null,
      healthClass: "unknown",
      quotedHealthClass: undefined,
      underwritingHealthClass: null,
      quoteClassNote: undefined,
      monthlyPremium: null,
      faceAmount: recommendation.maxCoverage,
      reason: INSUFFICIENT_DATA_REASON,
    };
  }

  return {
    carrierName: recommendation.carrierName,
    productName: recommendation.productName,
    termYears: recommendation.termYears ?? null,
    healthClass:
      recommendation.healthClassUsed ??
      recommendation.healthClassResult ??
      "standard",
    quotedHealthClass: recommendation.healthClassUsed ?? undefined,
    underwritingHealthClass: recommendation.healthClassResult ?? null,
    quoteClassNote: recommendation.wasFallback
      ? `Quoted at ${recommendation.healthClassUsed ?? recommendation.healthClassResult ?? "standard"} because the requested class was unavailable.`
      : undefined,
    monthlyPremium: recommendation.monthlyPremium,
    faceAmount: recommendation.maxCoverage,
    reason:
      recommendation.reason === "cheapest"
        ? "Cheapest premium"
        : recommendation.reason === "highest_coverage"
          ? "Highest available coverage"
          : recommendation.reason === "best_approval"
            ? "Best approval odds"
            : recommendation.reason === "best_value"
              ? "Best value"
              : recommendation.eligibilityStatus === "unknown"
                ? "Manual underwriting review required"
                : "Recommended",
  };
}

function buildSessionRecommendations(
  decisionResult: DecisionEngineResult,
): SessionRecommendationInput[] {
  const recommendationReasonByProductId = new Map(
    decisionResult.recommendations
      .filter((recommendation) => recommendation.reason !== null)
      .map((recommendation) => [
        recommendation.productId,
        recommendation.reason,
      ]),
  );

  return [
    ...decisionResult.eligibleProducts,
    ...decisionResult.unknownEligibility,
  ].map((recommendation, index) => {
    const annualPremium = calculateAnnualPremium(recommendation.monthlyPremium);

    return {
      productId: recommendation.productId,
      carrierId: recommendation.carrierId,
      eligibilityStatus: recommendation.eligibilityStatus,
      eligibilityReasons: recommendation.eligibilityReasons,
      missingFields: recommendation.missingFields,
      confidence: recommendation.confidence,
      assessable: recommendation.assessable,
      approvalLikelihood: recommendation.approvalLikelihood,
      healthClassResult: recommendation.healthClassResult,
      conditionDecisions: recommendation.conditionDecisions,
      monthlyPremium: recommendation.monthlyPremium,
      annualPremium,
      costPerThousand: calculateCostPerThousand(
        annualPremium,
        recommendation.maxCoverage,
      ),
      score: roundTo(recommendation.score, 4),
      scoreComponents: recommendation.scoreComponents,
      recommendationReason:
        recommendationReasonByProductId.get(recommendation.productId) ?? null,
      recommendationRank: index + 1,
      draftRulesFyi: recommendation.draftRulesFyi,
    };
  });
}

function buildEligibilitySummary(
  decisionResult: DecisionEngineResult,
): SessionEligibilitySummary {
  return {
    eligible: decisionResult.eligibleProducts.length,
    unknown: decisionResult.unknownEligibility.length,
    ineligible: decisionResult.filtered.ineligible,
  };
}

function getGlobalRuleSetsForProduct(
  ruleSets: Map<string, RuleSetWithRules[]>,
  carrierId: string,
  productId: string,
): RuleSetWithRules[] {
  return (ruleSets.get(carrierId) ?? []).filter(
    (ruleSet) =>
      ruleSet.product_id === null || ruleSet.product_id === productId,
  );
}

function getConditionRuleSetsForProduct(
  ruleSets: Map<string, RuleSetWithRules[]>,
  carrierId: string,
  productId: string,
): RuleSetWithRules[] {
  return (ruleSets.get(carrierId) ?? []).filter(
    (ruleSet) =>
      ruleSet.product_id === null || ruleSet.product_id === productId,
  );
}

export function computeApproval(params: {
  product: ProductCandidate;
  client: ClientProfile;
  globalRuleSetsByCarrier: Map<string, RuleSetWithRules[]>;
  conditionRuleSetsByCarrier: Map<string, RuleSetWithRules[]>;
}): ApprovalComputation {
  const {
    product,
    client,
    globalRuleSetsByCarrier,
    conditionRuleSetsByCarrier,
  } = params;

  if (client.healthConditions.length === 0) {
    // No conditions ENTERED is not the same as "verified healthy". We have no
    // basis to grant Preferred (the old behavior fabricated 0.95/preferred for
    // anyone we simply didn't ask). Abstain with a neutral likelihood until a
    // future "verified healthy" intake signal exists (Phase 1).
    return {
      likelihood: 0.5,
      healthClass: "standard",
      assessable: false,
      conditionDecisions: [],
      concerns: [],
      draftRules: [],
      evaluatedRuleSets: [],
      auditRows: [],
    };
  }

  const conditionResponses = client.conditionResponses ?? {};
  const { allConditionCodes, derivedConditionCodes } = deriveRuleConditionCodes(
    {
      age: client.age,
      healthConditions: client.healthConditions,
      conditionResponses,
    },
  );

  const facts: FactMap = buildFactMap(
    {
      age: client.age,
      gender: client.gender,
      bmi: client.bmi,
      state: client.state,
      tobacco: client.tobacco,
      medications: client.medications,
    },
    client.healthConditions,
    conditionResponses,
  );

  const globalSets = getGlobalRuleSetsForProduct(
    globalRuleSetsByCarrier,
    product.carrierId,
    product.productId,
  );
  const conditionSets = getConditionRuleSetsForProduct(
    conditionRuleSetsByCarrier,
    product.carrierId,
    product.productId,
  ).filter(
    (ruleSet) =>
      ruleSet.condition_code !== null &&
      allConditionCodes.includes(ruleSet.condition_code),
  );

  const evaluatedRuleSets: string[] = [];
  globalSets.forEach((ruleSet) =>
    evaluatedRuleSets.push(`global:${ruleSet.name}`),
  );
  conditionSets.forEach((ruleSet) =>
    evaluatedRuleSets.push(
      `condition:${ruleSet.condition_code}:${ruleSet.name}`,
    ),
  );

  const globalOutcomes: ConditionOutcome[] = globalSets.map((ruleSet) =>
    evaluateRuleSet(adaptRuleSetForEvaluation(ruleSet), facts),
  );

  let globalOutcome: ConditionOutcome | null = null;
  if (globalOutcomes.length > 0) {
    globalOutcome = globalOutcomes.reduce((worst, current) => {
      const aggregate = aggregateOutcomes([worst, current], null, {
        flatExtraComposition: "max",
      });

      return {
        conditionCode: "global",
        eligibility: aggregate.eligibility,
        healthClass: aggregate.healthClass,
        tableUnits: aggregate.tableUnits,
        flatExtra: aggregate.flatExtras[0] ?? null,
        concerns: aggregate.concerns,
        matchedRules: aggregate.matchedRules,
        missingFields: aggregate.missingFields,
      };
    });
  }

  const byCondition = new Map<string, RuleSetWithRules[]>();
  for (const ruleSet of conditionSets) {
    if (!ruleSet.condition_code) continue;
    byCondition.set(ruleSet.condition_code, [
      ...(byCondition.get(ruleSet.condition_code) ?? []),
      ruleSet,
    ]);
  }

  // Track whether EVERY stated condition matched an approved rule set. This is
  // the globals-immune abstain signal: an administrative global (eligible/standard)
  // must never mask a stated condition we have no curated data for.
  let allStatedConditionsMatched = true;

  const baseConditionOutcomes: ConditionOutcome[] = client.healthConditions.map(
    (conditionCode) => {
      const chosen = chooseHighestVersionRuleSet(
        byCondition.get(conditionCode) ?? [],
      );

      if (!chosen) {
        allStatedConditionsMatched = false;
        return {
          conditionCode,
          eligibility: "unknown" as const,
          healthClass: "unknown" as DSLHealthClass,
          tableUnits: 0,
          flatExtra: null,
          concerns: [
            `${conditionCode}: no approved rule set found - manual review required`,
          ],
          matchedRules: [],
          missingFields: [],
        };
      }

      return evaluateRuleSet(adaptRuleSetForEvaluation(chosen), facts);
    },
  );

  // Derived codes (inferred from stated conditions, not entered by the user) that
  // lack a rule are simply omitted here and do NOT flip allStatedConditionsMatched
  // — a missing rule for an inferred code must not by itself force abstention. (A
  // derived code that DOES have a rule still participates in aggregation, so it can
  // still drive abstention via the aggregated class/eligibility path.) Only the
  // presence/absence of rules for STATED conditions gates allStatedConditionsMatched.
  const derivedConditionOutcomes = derivedConditionCodes.flatMap(
    (conditionCode) => {
      const chosen = chooseHighestVersionRuleSet(
        byCondition.get(conditionCode) ?? [],
      );
      return chosen
        ? [evaluateRuleSet(adaptRuleSetForEvaluation(chosen), facts)]
        : [];
    },
  );

  const conditionOutcomes = [
    ...baseConditionOutcomes,
    ...derivedConditionOutcomes,
  ];

  const aggregated = aggregateOutcomes(conditionOutcomes, globalOutcome, {
    flatExtraComposition: "max",
  });

  const conditionDecisions: Recommendation["conditionDecisions"] =
    conditionOutcomes.map((outcome) => ({
      conditionCode: outcome.conditionCode,
      decision: mapEligibilityToDecision(
        outcome.eligibility,
        outcome.tableUnits,
      ),
      likelihood: mapEligibilityToLikelihood(outcome.eligibility),
      healthClassResult:
        outcome.healthClass === "unknown" ? null : outcome.healthClass,
      isApproved: true,
    }));

  const likelihood =
    aggregated.eligibility === "ineligible"
      ? 0
      : Math.min(
          ...conditionDecisions.map((decision) => decision.likelihood),
          0.95,
        );

  const inputHash = generateInputHash(facts);
  const auditRows: PersistableAuditRow[] = conditionOutcomes.map((outcome) => {
    const chosenRuleSet = chooseHighestVersionRuleSet(
      byCondition.get(outcome.conditionCode) ?? [],
    );

    return {
      ruleSetId: chosenRuleSet?.id ?? null,
      ruleId: null,
      conditionCode: outcome.conditionCode,
      predicateResult:
        outcome.eligibility === "eligible"
          ? "matched"
          : outcome.eligibility === "ineligible"
            ? "failed"
            : "unknown",
      matchedConditions: outcome.matchedRules,
      failedConditions: null,
      missingFields: outcome.missingFields,
      outcomeApplied: {
        eligibility: outcome.eligibility,
        healthClass: outcome.healthClass,
        tableUnits: outcome.tableUnits,
      },
      inputHash,
    };
  });

  // Assessable only when we had curated data for every stated condition, the
  // aggregated outcome is actually eligible, AND the class is real (not
  // unknown/refer/decline). The eligibility term guards an authoring footgun: a
  // rule set whose default_outcome carries a real class but eligibility
  // 'refer'/'unknown' must still abstain, never leak a quoted class. Otherwise
  // healthClass below is a suppressed placeholder consumers must ignore.
  const assessable =
    allStatedConditionsMatched &&
    aggregated.eligibility === "eligible" &&
    isAssessableClass(aggregated.healthClass);

  return {
    likelihood,
    healthClass: mapHealthClass(aggregated.healthClass),
    assessable,
    conditionDecisions,
    concerns: aggregated.concerns,
    draftRules: [],
    evaluatedRuleSets,
    auditRows,
  };
}

export async function evaluateProduct(
  product: ProductCandidate,
  ctx: ProductEvaluationContext,
): Promise<{
  evaluated: EvaluatedProduct | null;
  stats: DecisionEngineResult["filtered"];
  auditRows: PersistableAuditRow[];
}> {
  const { client, coverage, inputTermYears, criteriaMap, premiumMatrixMap } =
    ctx;

  const stats: DecisionEngineResult["filtered"] = {
    totalProducts: 0,
    passedEligibility: 0,
    unknownEligibility: 0,
    passedAcceptance: 0,
    withPremiums: 0,
    ineligible: 0,
  };

  const matrix = premiumMatrixMap.get(product.productId) ?? [];
  const availableTerms = getAvailableTermsForAge(matrix, client.age);
  const longestTerm = getLongestAvailableTermForAge(matrix, client.age);
  const isPermanentProduct =
    matrix.length > 0 && matrix.every((row) => row.term_years === null);

  if (availableTerms.length === 0 && matrix.length > 0 && !isPermanentProduct) {
    stats.ineligible += 1;
    return { evaluated: null, stats, auditRows: [] };
  }

  let effectiveTermYears: TermYears | null = isPermanentProduct
    ? null
    : longestTerm;

  // Only enforce term availability when the product actually has a rate matrix.
  // We rank by APPROVAL probability, not price, so a product with NO premium
  // matrix (premiums are out of scope) must still be assessable for its condition
  // rules — it must not be silently dropped just because a term was requested and
  // there are no rates to validate it against. When the matrix is empty we keep
  // the product term-agnostic (effectiveTermYears stays null) and let the rules run.
  if (!isPermanentProduct && inputTermYears !== null && matrix.length > 0) {
    if (availableTerms.includes(inputTermYears)) {
      effectiveTermYears = inputTermYears as TermYears;
    } else {
      stats.ineligible += 1;
      return { evaluated: null, stats, auditRows: [] };
    }
  }

  const eligibility = checkEligibility(
    product,
    client,
    coverage,
    criteriaMap.get(product.productId),
    undefined,
    effectiveTermYears,
  );

  if (eligibility.status === "ineligible") {
    stats.ineligible += 1;
    return { evaluated: null, stats, auditRows: [] };
  }

  const approval = computeApproval({
    product,
    client: buildApprovalClientProfile(client),
    globalRuleSetsByCarrier: ctx.globalRuleSetsByCarrier,
    conditionRuleSetsByCarrier: ctx.conditionRuleSetsByCarrier,
  });

  if (eligibility.status === "eligible" && approval.likelihood === 0) {
    stats.ineligible += 1;
    return { evaluated: null, stats, auditRows: approval.auditRows };
  }

  stats.passedAcceptance += 1;

  const effectiveEligibility = applyRecommendationSafetyGate(
    eligibility,
    approval,
  );

  if (effectiveEligibility.status === "unknown") {
    stats.unknownEligibility += 1;
  } else {
    stats.passedEligibility += 1;
  }

  let effectiveHealthClass: HealthClass = approval.healthClass;
  let buildRating: Recommendation["buildRating"];
  const buildChart = ctx.buildChartMap.get(product.productId);
  // Only fold the build chart into the class when the approval is assessable.
  // When we are abstaining (no curated data), approval.healthClass is a
  // suppressed placeholder, so constraining it would just be a second silent
  // collapse to "standard" — pass through unchanged instead.
  if (
    approval.assessable &&
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
    }
  }

  const premiumResult = interpolatePremium(
    matrix,
    client.age,
    coverage.faceAmount,
    client.gender,
    client.tobacco ? "tobacco" : "non_tobacco",
    effectiveHealthClass,
    effectiveTermYears,
  );
  const premium = premiumResult.premium;
  const healthClassRequested =
    premium !== null ? premiumResult.requested : undefined;
  const healthClassUsed = premium !== null ? premiumResult.used : undefined;
  const wasFallback = premium !== null ? !premiumResult.wasExact : undefined;
  const termYearsUsed = premium !== null ? premiumResult.termYears : undefined;
  const availableRateClasses = getAvailableRateClassesForQuote(
    matrix,
    client.gender,
    client.tobacco ? "tobacco" : "non_tobacco",
    effectiveTermYears,
  );

  if (premium !== null) {
    stats.withPremiums += 1;
  }

  const comparisonFaceAmounts = coverage.faceAmounts?.length
    ? coverage.faceAmounts.filter((amount) => amount > 0)
    : getComparisonFaceAmounts(
        coverage.faceAmount,
        product.minFaceAmount,
        getMaxFaceAmountForAgeTerm(
          product.metadata,
          product.maxFaceAmount,
          client.age,
          effectiveTermYears,
        ),
      );

  const alternativeQuotes: AlternativeQuote[] = approval.assessable
    ? calculateAlternativeQuotes(
        matrix,
        comparisonFaceAmounts,
        client.age,
        client.gender,
        client.tobacco ? "tobacco" : "non_tobacco",
        effectiveHealthClass,
        effectiveTermYears,
      )
    : [];

  // Never surface a quote (premium or quoted class) for a client we are
  // abstaining on: effectiveHealthClass was the suppressed "standard"
  // placeholder, so any premium/class derived from it is fabricated. This is the
  // exact dishonesty Phase 0 kills — it leaks via healthClassUsed/monthlyPremium,
  // NOT healthClassResult, so suppressing it here keeps every downstream
  // consumer (rate-table, session recs, future Jarvis tool) honest.
  const quotable = approval.assessable;

  return {
    evaluated: {
      product,
      eligibility: effectiveEligibility,
      approval,
      premium: quotable ? premium : null,
      healthClassRequested: quotable ? healthClassRequested : undefined,
      healthClassUsed: quotable ? healthClassUsed : undefined,
      wasFallback: quotable ? wasFallback : undefined,
      availableRateClasses,
      termYears: quotable ? termYearsUsed : undefined,
      availableTerms,
      alternativeQuotes,
      maxCoverage: coverage.faceAmount,
      scoreComponents: {
        likelihood: approval.likelihood,
        // Price is out of scope — we rank by approval probability, not premium.
        priceScore: 0,
        dataConfidence: effectiveEligibility.confidence,
        confidenceMultiplier: 1,
      },
      finalScore: 0,
      buildRating,
    },
    stats,
    auditRows: approval.auditRows,
  };
}

export async function computeAuthoritativeUnderwritingRun(params: {
  client: SupabaseClient<Database>;
  payload: UnderwritingRawPayload;
  imoId: string;
  requestId: string;
}): Promise<AuthoritativeRunResult> {
  const startTime = Date.now();
  const { client, payload, imoId, requestId } = params;

  const heightFeet = Math.floor(payload.clientHeightInches / 12);
  const heightInches = payload.clientHeightInches % 12;
  const bmi = calculateBMI(heightFeet, heightInches, payload.clientWeightLbs);
  const parsedSnapshot = parseHealthSnapshot(payload.healthResponses);
  const conditionResponses = transformConditionResponses(
    parsedSnapshot.conditions,
    payload.clientAge,
  );

  const gender: GenderType =
    payload.clientGender === "female" ? "female" : "male";
  const validFaceAmounts = payload.requestedFaceAmounts.filter(
    (amount) => amount >= 10000,
  );
  const coverage: CoverageRequest = {
    faceAmount: validFaceAmounts[0] ?? payload.requestedFaceAmounts[0] ?? 0,
    faceAmounts: validFaceAmounts.length > 0 ? validFaceAmounts : undefined,
    productTypes: payload.requestedProductTypes,
  };
  const clientProfile: ClientProfile = {
    age: payload.clientAge,
    gender,
    state: payload.clientState || undefined,
    bmi: bmi > 0 ? bmi : undefined,
    heightFeet,
    heightInches,
    weight: payload.clientWeightLbs,
    tobacco: payload.tobaccoUse,
    healthConditions: parsedSnapshot.conditions.map(
      (condition) => condition.conditionCode,
    ),
    medications: parsedSnapshot.medications,
    conditionResponses,
  };

  const products = await fetchProducts(
    client,
    imoId,
    coverage.productTypes ?? [],
  );
  const productIds = products.map((product) => product.productId);
  const carrierIds = [...new Set(products.map((product) => product.carrierId))];
  const { allConditionCodes } = deriveRuleConditionCodes({
    age: clientProfile.age,
    healthConditions: clientProfile.healthConditions,
    conditionResponses: clientProfile.conditionResponses,
  });

  const [
    criteriaMap,
    premiumMatrixMap,
    buildChartMap,
    globalRuleSets,
    conditionRuleSets,
  ] = await Promise.all([
    fetchExtractedCriteriaMap(client, productIds),
    fetchPremiumMatrixMap(
      client,
      productIds,
      imoId,
      clientProfile.gender,
      clientProfile.tobacco,
    ),
    fetchBuildChartMap(client, products, imoId),
    fetchApprovedGlobalRuleSets(client, { imoId, carrierIds, productIds }),
    fetchApprovedConditionRuleSets(client, {
      imoId,
      carrierIds,
      productIds,
      conditionCodes: allConditionCodes,
    }),
  ]);

  const evaluationContext: ProductEvaluationContext = {
    client: clientProfile,
    coverage,
    imoId,
    inputTermYears: payload.selectedTermYears,
    criteriaMap,
    premiumMatrixMap,
    buildChartMap,
    globalRuleSetsByCarrier: new Map<string, RuleSetWithRules[]>(),
    conditionRuleSetsByCarrier: new Map<string, RuleSetWithRules[]>(),
  };

  for (const ruleSet of globalRuleSets) {
    evaluationContext.globalRuleSetsByCarrier.set(ruleSet.carrier_id, [
      ...(evaluationContext.globalRuleSetsByCarrier.get(ruleSet.carrier_id) ??
        []),
      ruleSet,
    ]);
  }
  for (const ruleSet of conditionRuleSets) {
    evaluationContext.conditionRuleSetsByCarrier.set(ruleSet.carrier_id, [
      ...(evaluationContext.conditionRuleSetsByCarrier.get(
        ruleSet.carrier_id,
      ) ?? []),
      ruleSet,
    ]);
  }

  const evaluationResults = await Promise.all(
    products.map((product) => evaluateProduct(product, evaluationContext)),
  );

  const filtered = {
    totalProducts: products.length,
    passedEligibility: 0,
    unknownEligibility: 0,
    passedAcceptance: 0,
    withPremiums: 0,
    ineligible: 0,
  };
  const eligibleProducts: EvaluatedProduct[] = [];
  const unknownProducts: EvaluatedProduct[] = [];
  const auditRows: PersistableAuditRow[] = [];

  for (const result of evaluationResults) {
    filtered.passedEligibility += result.stats.passedEligibility;
    filtered.unknownEligibility += result.stats.unknownEligibility;
    filtered.passedAcceptance += result.stats.passedAcceptance;
    filtered.withPremiums += result.stats.withPremiums;
    filtered.ineligible += result.stats.ineligible;
    auditRows.push(...result.auditRows);

    if (!result.evaluated) {
      continue;
    }

    if (result.evaluated.eligibility.status === "eligible") {
      eligibleProducts.push(result.evaluated);
    } else {
      unknownProducts.push(result.evaluated);
    }
  }

  // Rank by PROBABILITY OF APPROVAL, not price. Premium is out of scope, so the
  // score is approvalLikelihood × dataConfidence, then down-weighted for
  // unknown-eligibility products via confidenceMultiplier.
  const recalculate = (evaluated: EvaluatedProduct): EvaluatedProduct => {
    const scoreComponents = calculateScore(
      evaluated.approval.likelihood,
      evaluated.eligibility.status,
      evaluated.eligibility.confidence,
    );
    const approvalScore =
      evaluated.approval.likelihood * evaluated.eligibility.confidence;
    return {
      ...evaluated,
      scoreComponents,
      finalScore: approvalScore * scoreComponents.confidenceMultiplier,
    };
  };

  // Group recommendations by product type (term / whole / IUL / UL / par-whole /
  // GI-graded / AD&D), then rank by approval score within each group. This
  // surfaces the underwriting-tier steering that "highest probability of
  // approval" is really about, instead of the old price-tagged buckets.
  const byProductTypeThenScore = (
    a: EvaluatedProduct,
    b: EvaluatedProduct,
  ): number => {
    const typeCmp = a.product.productType.localeCompare(b.product.productType);
    return typeCmp !== 0 ? typeCmp : b.finalScore - a.finalScore;
  };

  const scoredEligible = eligibleProducts
    .map(recalculate)
    .sort((a, b) => b.finalScore - a.finalScore);
  const scoredUnknown = unknownProducts
    .map(recalculate)
    .sort((a, b) => b.finalScore - a.finalScore);

  const toRecommendation = (
    product: EvaluatedProduct,
    reason: Recommendation["reason"],
  ): Recommendation => ({
    carrierId: product.product.carrierId,
    carrierName: product.product.carrierName,
    productId: product.product.productId,
    productName: product.product.productName,
    productType: product.product.productType,
    monthlyPremium: product.premium,
    maxCoverage: product.maxCoverage,
    approvalLikelihood: product.approval.likelihood,
    assessable: product.approval.assessable,
    // When not assessable the class is a suppressed placeholder — surface the
    // honest "unknown" instead of a fabricated standard/preferred.
    healthClassResult: product.approval.assessable
      ? product.approval.healthClass
      : "unknown",
    healthClassRequested: product.healthClassRequested,
    healthClassUsed: product.healthClassUsed,
    wasFallback: product.wasFallback,
    availableRateClasses: product.availableRateClasses,
    termYears: product.termYears,
    availableTerms: product.availableTerms,
    alternativeQuotes: product.alternativeQuotes,
    reason,
    concerns: product.approval.concerns,
    conditionDecisions: product.approval.conditionDecisions,
    score: product.finalScore,
    eligibilityStatus: product.eligibility.status,
    eligibilityReasons: product.approval.assessable
      ? product.eligibility.reasons
      : [
          ...new Set([
            INSUFFICIENT_DATA_REASON,
            ...product.eligibility.reasons,
          ]),
        ],
    missingFields: product.eligibility.missingFields,
    confidence: product.eligibility.confidence,
    scoreComponents: product.scoreComponents,
    draftRulesFyi: product.approval.draftRules,
    buildRating: product.buildRating,
  });

  const decisionResult: DecisionEngineResult = {
    // No more price-tagged buckets (best_value/cheapest/best_approval/
    // highest_coverage were labeled purely by array index, not real price).
    // Recommendations are grouped by product type and ranked by approval score;
    // `reason` is null because price-based reasons no longer apply.
    recommendations: [
      ...[...scoredEligible].sort(byProductTypeThenScore),
      ...[...scoredUnknown].sort(byProductTypeThenScore),
    ].map((product) => toRecommendation(product, null)),
    eligibleProducts: scoredEligible.map((product) =>
      toRecommendation(product, null),
    ),
    unknownEligibility: scoredUnknown.map((product) =>
      toRecommendation(product, null),
    ),
    filtered,
    processingTime: Date.now() - startTime,
  };

  return {
    decisionResult,
    sessionRecommendations: buildSessionRecommendations(decisionResult),
    rateTableRecommendations: [
      ...decisionResult.eligibleProducts,
      ...decisionResult.unknownEligibility,
    ].map(toRateTableRecommendation),
    eligibilitySummary: buildEligibilitySummary(decisionResult),
    auditRows,
    evaluationMetadata: {
      engineVersion: ENGINE_VERSION,
      requestId,
      runKey: payload.runKey,
      selectedTermYears: payload.selectedTermYears,
      totalProductsEvaluated: products.length,
      evaluatedAt: new Date().toISOString(),
    },
  };
}
