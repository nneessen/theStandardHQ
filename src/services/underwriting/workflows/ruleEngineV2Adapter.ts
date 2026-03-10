// src/services/underwriting/ruleEngineV2Adapter.ts
// Adapter to integrate rule engine v2 with the decision engine
// Replaces legacy acceptanceService lookups with compound predicate evaluation

import {
  loadApprovedRuleSets,
  logEvaluation,
} from "../repositories/ruleService";
import { generateInputHash } from "../core/ruleEvaluator";
import {
  buildFactMap,
  evaluateRuleSet,
  aggregateOutcomes,
} from "../core/ruleEvaluator";
import {
  UnderwritingRuleSetSchema,
  type FactMap,
  type EligibilityStatus,
  type HealthClass as DSLHealthClass,
  type ConditionOutcome,
  type MissingField,
  type UnderwritingRuleSet,
} from "../core/ruleEngineDSL";
import type { RuleSetWithRules } from "../repositories/ruleService";
import type { AcceptanceDecision } from "../repositories/acceptanceService";
import type { HealthClass } from "../repositories/premiumMatrixService";
import type {
  DraftRuleInfo,
  MedicationInfo,
} from "@/features/underwriting/types/underwriting.types";
import { deriveRuleConditionCodes } from "../core/derivedConditionCodes";

// =============================================================================
// Types
// =============================================================================

export interface ClientProfileV2 {
  age: number;
  gender: "male" | "female";
  state?: string;
  bmi?: number;
  tobacco: boolean;
  healthConditions: string[];
  medications?: MedicationInfo;
  conditionResponses?: Record<string, Record<string, unknown>>;
}

export interface ConditionDecisionV2 {
  conditionCode: string;
  decision: AcceptanceDecision;
  likelihood: number;
  healthClassResult: string | null;
  isApproved: boolean;
  concerns: string[];
  missingFields: string[];
}

export interface ApprovalResultV2 {
  likelihood: number;
  healthClass: HealthClass;
  conditionDecisions: ConditionDecisionV2[];
  concerns: string[];
  draftRules: DraftRuleInfo[];
  /** For debugging: which rule sets were evaluated */
  evaluatedRuleSets: string[];
}

// DraftRuleInfo imported from underwriting.types.ts

// =============================================================================
// Mapping Functions
// =============================================================================

/**
 * Map v2 eligibility status to legacy AcceptanceDecision format
 */
function mapEligibilityToDecision(
  eligibility: EligibilityStatus | "unknown",
  tableUnits: number,
): AcceptanceDecision {
  if (eligibility === "ineligible") return "declined";
  if (eligibility === "refer" || eligibility === "unknown")
    return "case_by_case";
  return tableUnits > 0 ? "table_rated" : "approved";
}

/**
 * Map v2 eligibility to approval likelihood (0-1)
 * These are deterministic defaults - can be refined with carrier-specific data
 */
function mapEligibilityToLikelihood(
  eligibility: EligibilityStatus | "unknown",
): number {
  switch (eligibility) {
    case "eligible":
      return 0.9;
    case "refer":
      return 0.6;
    case "unknown":
      return 0.5;
    case "ineligible":
      return 0.0;
    default:
      return 0.5;
  }
}

/**
 * Map DSL health class to premium matrix health class
 * DSL has more values (substandard, refer, decline, unknown) that need mapping
 */
function mapHealthClass(hc: DSLHealthClass): HealthClass {
  switch (hc) {
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
      return "standard";
  }
}

/**
 * Adapt database RuleSetWithRules to DSL UnderwritingRuleSet
 * Handles version null -> default of 1, and Json -> proper type conversions
 * Uses Zod validation for runtime type safety
 */
function adaptRuleSetForEvaluation(rs: RuleSetWithRules): UnderwritingRuleSet {
  // Prepare the data with proper defaults for nullable fields
  const prepared = {
    ...rs,
    version: rs.version ?? 1,
    variant: rs.variant ?? "default",
    default_outcome: rs.default_outcome ?? undefined,
    rules: rs.rules?.map((r) => ({
      ...r,
      predicate_version: r.predicate_version ?? 2,
      // predicate is Json in DB, needs to be passed through
      predicate: r.predicate,
    })),
  };

  // Validate with Zod - log warning but continue on validation failure
  // This provides runtime safety while maintaining backward compatibility
  const result = UnderwritingRuleSetSchema.safeParse(prepared);
  if (!result.success) {
    console.warn(
      `Rule set ${rs.id} failed Zod validation:`,
      result.error.flatten().fieldErrors,
    );
    // Continue with prepared data - evaluator has its own validation
  }

  return (result.success ? result.data : prepared) as UnderwritingRuleSet;
}

function chooseHighestVersionRuleSet(
  ruleSets: RuleSetWithRules[],
): RuleSetWithRules | null {
  if (ruleSets.length === 0) {
    return null;
  }

  return [...ruleSets].sort((a, b) => {
    const aVersion = a.version ?? -Infinity;
    const bVersion = b.version ?? -Infinity;
    return bVersion - aVersion;
  })[0];
}

// =============================================================================
// Main Adapter Function
// =============================================================================

/**
 * Calculate approval using rule engine v2
 *
 * This replaces the legacy lookupAcceptance() loop in decisionEngine.ts
 *
 * @param params.carrierId - Carrier to evaluate rules for
 * @param params.productId - Product ID for product-scoped rules (can be null for carrier-wide)
 * @param params.imoId - IMO for tenant isolation
 * @param params.healthConditions - List of condition codes present
 * @param params.client - Client profile with demographics and optional condition responses
 * @param params.sessionId - Optional session ID for audit logging (from underwriting wizard)
 */
export async function calculateApprovalV2(params: {
  carrierId: string;
  productId: string | null;
  imoId: string;
  healthConditions: string[];
  client: ClientProfileV2;
  sessionId?: string;
}): Promise<ApprovalResultV2> {
  const { carrierId, productId, imoId, healthConditions, client, sessionId } =
    params;
  const evaluatedRuleSets: string[] = [];

  // No conditions => healthy client, high likelihood
  if (healthConditions.length === 0) {
    return {
      likelihood: 0.95,
      healthClass: "preferred",
      conditionDecisions: [],
      concerns: [],
      draftRules: [],
      evaluatedRuleSets: [],
    };
  }

  const conditionResponses = client.conditionResponses ?? {};
  const { allConditionCodes, derivedConditionCodes } = deriveRuleConditionCodes(
    {
      age: client.age,
      healthConditions,
      conditionResponses,
    },
  );

  // Build FactMap from client data
  // Note: bmi and state are optional - when undefined, rules will evaluate as "unknown"
  const facts: FactMap = buildFactMap(
    {
      age: client.age,
      gender: client.gender,
      bmi: client.bmi,
      state: client.state,
      tobacco: client.tobacco,
      medications: client.medications,
    },
    healthConditions,
    conditionResponses,
  );

  // Load approved rule sets in parallel
  const [globalSets, conditionSets] = await Promise.all([
    loadApprovedRuleSets(imoId, carrierId, productId, { scope: "global" }),
    loadApprovedRuleSets(imoId, carrierId, productId, {
      scope: "condition",
      conditionCodes: allConditionCodes,
    }),
  ]);

  // Track which rule sets we're evaluating
  globalSets.forEach((rs) => evaluatedRuleSets.push(`global:${rs.name}`));
  conditionSets.forEach((rs) =>
    evaluatedRuleSets.push(`condition:${rs.condition_code}:${rs.name}`),
  );

  // Evaluate global rule sets
  // If multiple global sets exist (e.g., knockout rules), evaluate all
  const globalOutcomes: ConditionOutcome[] = globalSets.map((rs) =>
    evaluateRuleSet(adaptRuleSetForEvaluation(rs), facts),
  );

  // Reduce global outcomes to single worst outcome
  let globalOutcome: ConditionOutcome | null = null;
  if (globalOutcomes.length > 0) {
    globalOutcome = globalOutcomes.reduce((worst, current) => {
      const agg = aggregateOutcomes([worst, current], null, {
        flatExtraComposition: "max",
      });
      return {
        conditionCode: "global",
        eligibility: agg.eligibility,
        healthClass: agg.healthClass,
        tableUnits: agg.tableUnits,
        flatExtra: agg.flatExtras[0] ?? null,
        concerns: agg.concerns,
        matchedRules: agg.matchedRules,
        missingFields: agg.missingFields,
      };
    });
  }

  // Group condition rule sets by condition code
  // If multiple rule sets exist for a condition, use highest version
  // Filter out any rule sets with null condition_code (shouldn't happen for condition-scoped, but defensive)
  const byCondition = new Map<string, typeof conditionSets>();
  for (const rs of conditionSets) {
    if (!rs.condition_code) {
      console.warn(
        `Condition-scoped rule set ${rs.id} has null condition_code - skipping`,
      );
      continue;
    }
    const existing = byCondition.get(rs.condition_code) ?? [];
    existing.push(rs);
    byCondition.set(rs.condition_code, existing);
  }

  // Evaluate each health condition
  const baseConditionOutcomes: ConditionOutcome[] = healthConditions.map(
    (cc) => {
      const sets = byCondition.get(cc) ?? [];

      if (sets.length === 0) {
        // No approved rule set for this condition => unknown/refer
        return {
          conditionCode: cc,
          eligibility: "unknown" as const,
          healthClass: "unknown" as DSLHealthClass,
          tableUnits: 0,
          flatExtra: null,
          concerns: [
            `${cc}: no approved rule set found - manual review required`,
          ],
          matchedRules: [],
          missingFields: [],
        };
      }

      const chosen = chooseHighestVersionRuleSet(sets);
      if (!chosen) {
        return {
          conditionCode: cc,
          eligibility: "unknown" as const,
          healthClass: "unknown" as DSLHealthClass,
          tableUnits: 0,
          flatExtra: null,
          concerns: [
            `${cc}: no approved rule set found - manual review required`,
          ],
          matchedRules: [],
          missingFields: [],
        };
      }

      return evaluateRuleSet(adaptRuleSetForEvaluation(chosen), facts);
    },
  );

  const derivedConditionOutcomes: ConditionOutcome[] =
    derivedConditionCodes.flatMap((conditionCode) => {
      const sets = byCondition.get(conditionCode) ?? [];
      const chosen = chooseHighestVersionRuleSet(sets);

      if (!chosen) {
        return [];
      }

      return [evaluateRuleSet(adaptRuleSetForEvaluation(chosen), facts)];
    });

  const conditionOutcomes = [
    ...baseConditionOutcomes,
    ...derivedConditionOutcomes,
  ];

  // Aggregate all outcomes (global + conditions)
  const aggregated = aggregateOutcomes(conditionOutcomes, globalOutcome, {
    flatExtraComposition: "max",
  });

  // Build condition decisions in format expected by decision engine
  const conditionDecisions: ConditionDecisionV2[] = conditionOutcomes.map(
    (o) => ({
      conditionCode: o.conditionCode,
      decision: mapEligibilityToDecision(o.eligibility, o.tableUnits),
      likelihood: mapEligibilityToLikelihood(o.eligibility),
      healthClassResult: o.healthClass === "unknown" ? null : o.healthClass,
      isApproved: true, // All rule sets loaded are approved
      concerns: o.concerns,
      missingFields: o.missingFields.map((mf: MissingField) => mf.field),
    }),
  );

  // Calculate overall likelihood (worst across all conditions)
  const likelihood =
    aggregated.eligibility === "ineligible"
      ? 0
      : Math.min(...conditionDecisions.map((d) => d.likelihood), 0.95);

  // Persist audit records before returning a saved-session result.
  if (sessionId) {
    const inputHash = generateInputHash(facts);

    await Promise.all(
      conditionOutcomes.map((outcome) => {
        const ruleSetId =
          byCondition.get(outcome.conditionCode)?.[0]?.id ?? null;
        const predicateResult: "matched" | "failed" | "unknown" | "skipped" =
          outcome.eligibility === "eligible"
            ? "matched"
            : outcome.eligibility === "ineligible"
              ? "failed"
              : "unknown";

        return logEvaluation(
          sessionId,
          ruleSetId,
          null,
          outcome.conditionCode,
          predicateResult,
          {
            matchedConditions: outcome.matchedRules,
            missingFields: outcome.missingFields,
            outcomeApplied: {
              eligibility: outcome.eligibility,
              healthClass: outcome.healthClass,
              tableUnits: outcome.tableUnits,
            },
            inputHash,
          },
        );
      }),
    );
  }

  return {
    likelihood,
    healthClass: mapHealthClass(aggregated.healthClass),
    conditionDecisions,
    concerns: aggregated.concerns,
    draftRules: [], // TODO: Implement draft rules FYI if needed
    evaluatedRuleSets,
  };
}

/**
 * Check if v2 rules exist for a carrier/product combination
 * Useful for determining whether to use v2 or fall back to legacy
 */
export async function hasV2Rules(
  imoId: string,
  carrierId: string,
  productId: string | null,
): Promise<boolean> {
  const [globalSets, conditionSets] = await Promise.all([
    loadApprovedRuleSets(imoId, carrierId, productId, { scope: "global" }),
    loadApprovedRuleSets(imoId, carrierId, productId, { scope: "condition" }),
  ]);

  return globalSets.length > 0 || conditionSets.length > 0;
}
