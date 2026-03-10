// src/services/underwriting/rule-engine-v2.ts
// V2 Rule Engine Integration
// Provides compound predicates, cross-condition evaluation, proper unknown propagation,
// and table rating aggregation (max, not multiply).

import {
  evaluateRuleSet,
  aggregateOutcomes,
  buildFactMap,
  generateInputHash,
} from "../core/ruleEvaluator";
import {
  loadApprovedRuleSets,
  logEvaluation,
} from "../repositories/ruleService";
import type {
  AggregatedOutcome,
  ConditionOutcome,
} from "../core/ruleEngineDSL";

// =============================================================================
// Types
// =============================================================================

export interface V2EvaluationInput {
  imoId: string;
  carrierId: string;
  productId: string | null;
  client: {
    age: number;
    gender: "male" | "female";
    bmi: number;
    state: string;
    tobacco: boolean;
  };
  healthConditions: string[];
  conditionResponses: Record<string, Record<string, unknown>>;
  sessionId?: string;
}

export interface V2EvaluationResult extends AggregatedOutcome {
  inputHash: string;
  evaluatedAt: string;
}

// =============================================================================
// Adapter Function
// =============================================================================

// Adapter to convert service types to DSL types
// This will be unnecessary once database.types.ts is regenerated
function toRuleSetForEvaluation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rs: any,
): Parameters<typeof evaluateRuleSet>[0] {
  return rs;
}

// =============================================================================
// V2 Evaluation
// =============================================================================

/**
 * Evaluate underwriting using the v2 rule engine.
 *
 * This function:
 * 1. Builds a canonical fact map from client data
 * 2. Loads and evaluates global (cross-condition) rules first
 * 3. Evaluates condition-specific rules for each health condition
 * 4. Aggregates outcomes using max table units (not multiply)
 * 5. Logs evaluation for audit trail
 *
 * Key differences from v1:
 * - Compound predicates (AND/OR/NOT groups)
 * - Proper unknown propagation with specific missing fields
 * - Table ratings aggregated by max, not multiplication
 * - Default fallback is unknown/refer, not decline
 * - Cross-condition rules for multi-morbidity interactions
 *
 * @param input - The evaluation input including client data and health conditions
 * @returns The aggregated evaluation result with input hash and timestamp
 */
export async function evaluateUnderwritingV2(
  input: V2EvaluationInput,
): Promise<V2EvaluationResult> {
  const {
    imoId,
    carrierId,
    productId,
    client,
    healthConditions,
    conditionResponses,
    sessionId,
  } = input;

  // 1. Build canonical fact map
  const facts = buildFactMap(client, healthConditions, conditionResponses);
  const inputHash = generateInputHash(facts);

  // 2. Load and evaluate GLOBAL rules first (can decline early for multi-morbidity)
  let globalOutcome: ConditionOutcome | null = null;

  const globalRuleSets = await loadApprovedRuleSets(
    imoId,
    carrierId,
    productId,
    {
      scope: "global",
    },
  );

  for (const ruleSet of globalRuleSets) {
    const result = evaluateRuleSet(toRuleSetForEvaluation(ruleSet), facts);

    if (sessionId) {
      await logEvaluation(
        sessionId,
        ruleSet.id,
        result.matchedRules[0]?.ruleId ?? null,
        null,
        result.matchedRules.length > 0
          ? "matched"
          : result.missingFields.length > 0
            ? "unknown"
            : "failed",
        {
          matchedConditions: result.matchedRules.map(
            (rule) => rule.matchedConditions,
          ),
          missingFields: result.missingFields,
          outcomeApplied: result.matchedRules[0]?.outcome ?? null,
          inputHash,
        },
      );
    }

    if (result.eligibility === "ineligible") {
      // Early decline from global rule
      return {
        ...aggregateOutcomes([], result, { flatExtraComposition: "max" }),
        inputHash,
        evaluatedAt: new Date().toISOString(),
      };
    }

    globalOutcome = result;
  }

  // 3. Evaluate CONDITION rules for each reported condition
  const conditionOutcomes: ConditionOutcome[] = [];

  for (const conditionCode of healthConditions) {
    const conditionRuleSets = await loadApprovedRuleSets(
      imoId,
      carrierId,
      productId,
      {
        scope: "condition",
        conditionCode,
      },
    );

    if (conditionRuleSets.length === 0) {
      // No rules for this condition = unknown
      conditionOutcomes.push({
        conditionCode,
        eligibility: "unknown",
        healthClass: "unknown",
        tableUnits: 0,
        flatExtra: null,
        concerns: [`No approved rules defined for ${conditionCode}`],
        matchedRules: [],
        missingFields: [],
      });
      continue;
    }

    // Evaluate the first (should be only) approved rule set for this condition
    const ruleSet = conditionRuleSets[0];
    const result = evaluateRuleSet(toRuleSetForEvaluation(ruleSet), facts);

    if (sessionId) {
      await logEvaluation(
        sessionId,
        ruleSet.id,
        result.matchedRules[0]?.ruleId ?? null,
        conditionCode,
        result.matchedRules.length > 0
          ? "matched"
          : result.missingFields.length > 0
            ? "unknown"
            : "failed",
        {
          matchedConditions: result.matchedRules.map(
            (rule) => rule.matchedConditions,
          ),
          missingFields: result.missingFields,
          outcomeApplied: result.matchedRules[0]?.outcome ?? null,
          inputHash,
        },
      );
    }

    conditionOutcomes.push(result);
  }

  // 4. Aggregate all outcomes
  const aggregated = aggregateOutcomes(
    conditionOutcomes,
    globalOutcome,
    { flatExtraComposition: "max" }, // Use max for flat extras by default
  );

  return {
    ...aggregated,
    inputHash,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Check if v2 rule engine should be used for a given carrier.
 * Returns true if the carrier has any approved v2 rule sets.
 *
 * @param imoId - The IMO ID
 * @param carrierId - The carrier ID
 * @returns True if the carrier has v2 rules
 */
export async function hasV2RulesForCarrier(
  imoId: string,
  carrierId: string,
): Promise<boolean> {
  const ruleSets = await loadApprovedRuleSets(imoId, carrierId, null, {});
  return ruleSets.length > 0;
}
