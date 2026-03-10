/**
 * Underwriting Rule Evaluation Engine
 *
 * Evaluates compound predicates against client data with proper
 * unknown propagation and aggregation.
 */

import type { MedicationInfo } from "@/features/underwriting/types/underwriting.types.ts";
import {
  type FieldCondition,
  type PredicateGroup,
  type MissingField,
  type MatchedRule,
  type ConditionOutcome,
  type AggregatedOutcome,
  type RuleOutcome,
  type FactMap,
  type UnderwritingRule,
  type UnderwritingRuleSet,
  type EligibilityStatus,
  type FlatExtra,
  isFieldCondition,
  parsePredicate,
  extractConditionCode,
  getHealthClassRank,
  getHealthClassFromRank,
  getTableRatingUnits,
  getTableRatingFromUnits,
  getWorseEligibility,
  DEFAULT_SAFE_OUTCOME,
} from "./ruleEngineDSL.ts";

// =============================================================================
// TYPES
// =============================================================================

type FieldEvalResult =
  | { status: "matched" }
  | { status: "failed"; reason: string }
  | { status: "unknown"; reason: string };

type PredicateResult =
  | { status: "matched"; matchedConditions: FieldCondition[] }
  | { status: "failed"; failedConditions: FieldCondition[] }
  | { status: "unknown"; missingFields: MissingField[] };

interface CarrierAggregationConfig {
  flatExtraComposition: "sum" | "max" | "worst_only";
}

// =============================================================================
// FIELD CONDITION EVALUATION
// =============================================================================

const BOOLEAN_MEDICATION_FIELDS: Array<keyof MedicationInfo> = [
  "bloodThinners",
  "heartMeds",
  "insulinUse",
  "oralDiabetesMeds",
  "antidepressants",
  "antianxiety",
  "antipsychotics",
  "moodStabilizers",
  "sleepAids",
  "seizureMeds",
  "migraineMeds",
  "inhalers",
  "copdMeds",
  "thyroidMeds",
  "hormonalTherapy",
  "steroids",
  "immunosuppressants",
  "biologics",
  "dmards",
  "cancerTreatment",
  "antivirals",
  "adhdMeds",
  "osteoporosisMeds",
  "kidneyMeds",
  "liverMeds",
];

const COUNT_MEDICATION_FIELDS: Array<keyof MedicationInfo> = [
  "bpMedCount",
  "cholesterolMedCount",
];

function buildMedicationClasses(medications: MedicationInfo): string[] {
  const classes: string[] = [];

  if (medications.bpMedCount > 0) classes.push("bp_medications");
  if (medications.cholesterolMedCount > 0)
    classes.push("cholesterol_medications");

  const booleanClassMap: Array<[keyof MedicationInfo, string]> = [
    ["bloodThinners", "blood_thinners"],
    ["heartMeds", "heart_meds"],
    ["insulinUse", "insulin"],
    ["oralDiabetesMeds", "oral_diabetes_meds"],
    ["antidepressants", "antidepressants"],
    ["antianxiety", "antianxiety"],
    ["antipsychotics", "antipsychotics"],
    ["moodStabilizers", "mood_stabilizers"],
    ["sleepAids", "sleep_aids"],
    ["seizureMeds", "seizure_meds"],
    ["migraineMeds", "migraine_meds"],
    ["inhalers", "inhalers"],
    ["copdMeds", "copd_meds"],
    ["thyroidMeds", "thyroid_meds"],
    ["hormonalTherapy", "hormonal_therapy"],
    ["steroids", "steroids"],
    ["immunosuppressants", "immunosuppressants"],
    ["biologics", "biologics"],
    ["dmards", "dmards"],
    ["cancerTreatment", "cancer_treatment"],
    ["antivirals", "antivirals"],
    ["adhdMeds", "adhd_meds"],
    ["osteoporosisMeds", "osteoporosis_meds"],
    ["kidneyMeds", "kidney_meds"],
    ["liverMeds", "liver_meds"],
  ];

  for (const [field, className] of booleanClassMap) {
    if (medications[field] === true) {
      classes.push(className);
    }
  }

  if (medications.painMedications === "otc_only") {
    classes.push("pain_medications", "otc_pain");
  }
  if (medications.painMedications === "prescribed_non_opioid") {
    classes.push("pain_medications", "prescribed_non_opioid");
  }
  if (medications.painMedications === "opioid") {
    classes.push("pain_medications", "opioid");
  }

  return [...new Set(classes)];
}

function addMedicationFacts(
  factsRecord: Record<string, unknown>,
  medications?: MedicationInfo,
): void {
  if (!medications) {
    return;
  }

  for (const field of BOOLEAN_MEDICATION_FIELDS) {
    factsRecord[`medications.${field}`] = medications[field];
  }

  for (const field of COUNT_MEDICATION_FIELDS) {
    factsRecord[`medications.${field}`] = medications[field];
  }

  factsRecord["medications.painMedications"] = medications.painMedications;

  const medicationClasses = buildMedicationClasses(medications);
  const totalSignals =
    BOOLEAN_MEDICATION_FIELDS.filter((field) => medications[field] === true)
      .length +
    COUNT_MEDICATION_FIELDS.filter(
      (field) =>
        typeof medications[field] === "number" &&
        (medications[field] as number) > 0,
    ).length +
    (medications.painMedications !== "none" ? 1 : 0);

  factsRecord["medications.classes"] = medicationClasses;
  factsRecord["medications.totalSignals"] = totalSignals;
  factsRecord["medications.hasAny"] = totalSignals > 0;
  factsRecord["medications.opioidUse"] =
    medications.painMedications === "opioid";
  factsRecord["medications.highRisk"] = [
    medications.insulinUse,
    medications.antipsychotics,
    medications.immunosuppressants,
    medications.biologics,
    medications.cancerTreatment,
    medications.kidneyMeds,
    medications.liverMeds,
    medications.painMedications === "opioid",
  ].some(Boolean);
}

/**
 * Get a value from the fact map using dot notation
 */
function getFactValue(facts: FactMap, field: string): unknown {
  // Handle direct keys
  if (field in facts) {
    return facts[field as keyof FactMap];
  }

  // Handle nested paths (e.g., client.age)
  const parts = field.split(".");
  if (parts.length === 2) {
    const key = field as keyof FactMap;
    return facts[key];
  }

  return undefined;
}

/**
 * Calculate years since a date
 */
function yearsSince(dateStr: string | Date): number {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const years =
    (now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(years);
}

/**
 * Calculate months since a date
 */
function monthsSince(dateStr: string | Date): number {
  const date = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  return months;
}

/**
 * Evaluate a single field condition against facts
 */
function evaluateFieldCondition(
  condition: FieldCondition,
  facts: FactMap,
): FieldEvalResult {
  const value = getFactValue(facts, condition.field);
  // treatNullAs is only present on non-condition_presence types
  const conditionWithNull = condition as { treatNullAs?: "fail" | "unknown" };
  const treatNullAs = conditionWithNull.treatNullAs ?? "unknown";

  // Handle null/undefined values
  if (value === undefined || value === null) {
    if (condition.type === "null_check") {
      if (condition.operator === "is_null") {
        return { status: "matched" };
      }
      return { status: "failed", reason: `${condition.field} is null` };
    }

    if (treatNullAs === "fail") {
      return {
        status: "failed",
        reason: `${condition.field} is missing (treated as fail)`,
      };
    }
    return { status: "unknown", reason: `${condition.field} is missing` };
  }

  // Handle null check operators
  if (condition.type === "null_check") {
    if (condition.operator === "is_null") {
      return { status: "failed", reason: `${condition.field} is not null` };
    }
    return { status: "matched" };
  }

  // Handle condition presence check
  if (condition.type === "condition_presence") {
    const conditions = facts.conditions || [];
    const targetConditions = condition.value;

    if (condition.operator === "includes_any") {
      const hasAny = targetConditions.some((c) => conditions.includes(c));
      if (hasAny) return { status: "matched" };
      return {
        status: "failed",
        reason: `None of [${targetConditions.join(", ")}] present`,
      };
    }

    if (condition.operator === "includes_all") {
      const hasAll = targetConditions.every((c) => conditions.includes(c));
      if (hasAll) return { status: "matched" };
      const missing = targetConditions.filter((c) => !conditions.includes(c));
      return {
        status: "failed",
        reason: `Missing conditions: ${missing.join(", ")}`,
      };
    }
  }

  // Evaluate based on condition type
  switch (condition.type) {
    case "numeric":
      return evaluateNumeric(condition, value);

    case "date":
      return evaluateDate(condition, value);

    case "boolean":
      return evaluateBoolean(condition, value);

    case "string":
      return evaluateString(condition, value);

    case "array":
      return evaluateArray(condition, value);

    case "set":
      return evaluateSet(condition, value);

    default:
      return { status: "unknown", reason: `Unknown condition type` };
  }
}

function evaluateNumeric(
  condition: {
    operator: string;
    value: number | [number, number];
    field: string;
  },
  value: unknown,
): FieldEvalResult {
  const num = typeof value === "number" ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return { status: "failed", reason: `${condition.field} is not a number` };
  }

  const expected = condition.value;

  switch (condition.operator) {
    case "eq":
      return num === expected
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} ${num} != ${expected}`,
          };

    case "neq":
      return num !== expected
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} ${num} == ${expected}`,
          };

    case "gt":
      return num > (expected as number)
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} ${num} <= ${expected}`,
          };

    case "gte":
      return num >= (expected as number)
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} ${num} < ${expected}`,
          };

    case "lt":
      return num < (expected as number)
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} ${num} >= ${expected}`,
          };

    case "lte":
      return num <= (expected as number)
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} ${num} > ${expected}`,
          };

    case "between":
      if (Array.isArray(expected) && expected.length === 2) {
        const [min, max] = expected;
        return num >= min && num <= max
          ? { status: "matched" }
          : {
              status: "failed",
              reason: `${condition.field} ${num} not in [${min}, ${max}]`,
            };
      }
      return { status: "failed", reason: "between requires [min, max]" };

    default:
      return {
        status: "failed",
        reason: `Unknown numeric operator: ${condition.operator}`,
      };
  }
}

function evaluateDate(
  condition: { operator: string; value: number; field: string },
  value: unknown,
): FieldEvalResult {
  const dateStr = String(value);
  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    return {
      status: "failed",
      reason: `${condition.field} is not a valid date`,
    };
  }

  const threshold = condition.value;

  switch (condition.operator) {
    case "years_since_gte": {
      const years = yearsSince(date);
      return years >= threshold
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${years} years since ${condition.field} < ${threshold}`,
          };
    }

    case "years_since_lte": {
      const years = yearsSince(date);
      return years <= threshold
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${years} years since ${condition.field} > ${threshold}`,
          };
    }

    case "months_since_gte": {
      const months = monthsSince(date);
      return months >= threshold
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${months} months since ${condition.field} < ${threshold}`,
          };
    }

    case "months_since_lte": {
      const months = monthsSince(date);
      return months <= threshold
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${months} months since ${condition.field} > ${threshold}`,
          };
    }

    default:
      return {
        status: "failed",
        reason: `Unknown date operator: ${condition.operator}`,
      };
  }
}

function evaluateBoolean(
  condition: { operator: string; value: boolean; field: string },
  value: unknown,
): FieldEvalResult {
  const bool =
    typeof value === "boolean"
      ? value
      : value === "true" || value === "1" || value === 1;

  switch (condition.operator) {
    case "eq":
      return bool === condition.value
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} ${bool} != ${condition.value}`,
          };

    case "neq":
      return bool !== condition.value
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} ${bool} == ${condition.value}`,
          };

    default:
      return {
        status: "failed",
        reason: `Unknown boolean operator: ${condition.operator}`,
      };
  }
}

function evaluateString(
  condition: { operator: string; value: string; field: string },
  value: unknown,
): FieldEvalResult {
  const str = String(value);
  const expected = condition.value;

  switch (condition.operator) {
    case "eq":
      return str === expected
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} "${str}" != "${expected}"`,
          };

    case "neq":
      return str !== expected
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} "${str}" == "${expected}"`,
          };

    case "contains":
      return str.includes(expected)
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} doesn't contain "${expected}"`,
          };

    case "starts_with":
      return str.startsWith(expected)
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} doesn't start with "${expected}"`,
          };

    case "ends_with":
      return str.endsWith(expected)
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} doesn't end with "${expected}"`,
          };

    default:
      return {
        status: "failed",
        reason: `Unknown string operator: ${condition.operator}`,
      };
  }
}

function evaluateArray(
  condition: { operator: string; value?: string[]; field: string },
  value: unknown,
): FieldEvalResult {
  const arr = Array.isArray(value) ? value : [];
  const expected = condition.value ?? [];

  switch (condition.operator) {
    case "is_empty":
      return arr.length === 0
        ? { status: "matched" }
        : { status: "failed", reason: `${condition.field} is not empty` };

    case "is_not_empty":
      return arr.length > 0
        ? { status: "matched" }
        : { status: "failed", reason: `${condition.field} is empty` };

    case "includes_any":
      return expected.some((e) => arr.includes(e))
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} doesn't include any of [${expected.join(", ")}]`,
          };

    case "includes_all":
      return expected.every((e) => arr.includes(e))
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} doesn't include all of [${expected.join(", ")}]`,
          };

    default:
      return {
        status: "failed",
        reason: `Unknown array operator: ${condition.operator}`,
      };
  }
}

function evaluateSet(
  condition: { operator: string; value: (string | number)[]; field: string },
  value: unknown,
): FieldEvalResult {
  const expected = condition.value;

  switch (condition.operator) {
    case "in":
      return expected.includes(value as string | number)
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} not in [${expected.join(", ")}]`,
          };

    case "not_in":
      return !expected.includes(value as string | number)
        ? { status: "matched" }
        : {
            status: "failed",
            reason: `${condition.field} in [${expected.join(", ")}]`,
          };

    default:
      return {
        status: "failed",
        reason: `Unknown set operator: ${condition.operator}`,
      };
  }
}

// =============================================================================
// PREDICATE GROUP EVALUATION
// =============================================================================

/**
 * Evaluate a predicate group (recursive with proper unknown propagation)
 */
export function evaluatePredicate(
  predicate: PredicateGroup,
  facts: FactMap,
): PredicateResult {
  // Empty predicate = always matches (default/fallback rule)
  if (!predicate.all && !predicate.any && !predicate.not) {
    return { status: "matched", matchedConditions: [] };
  }

  // Handle ALL (AND) - all must pass, any unknown => unknown, any fail => fail
  if (predicate.all) {
    const matched: FieldCondition[] = [];
    const missing: MissingField[] = [];

    for (const item of predicate.all) {
      if (isFieldCondition(item)) {
        const result = evaluateFieldCondition(item, facts);
        if (result.status === "matched") {
          matched.push(item);
        } else if (result.status === "failed") {
          // Short-circuit on first failure
          return { status: "failed", failedConditions: [item] };
        } else {
          // Collect ALL missing fields (don't short-circuit)
          missing.push({
            field: item.field,
            conditionCode: extractConditionCode(item.field),
            reason: result.reason,
            requiredFor: "all",
          });
        }
      } else {
        // Nested predicate group
        const nestedResult = evaluatePredicate(item, facts);
        if (nestedResult.status === "failed") {
          return nestedResult;
        }
        if (nestedResult.status === "unknown") {
          missing.push(...nestedResult.missingFields);
        }
        if (nestedResult.status === "matched") {
          matched.push(...nestedResult.matchedConditions);
        }
      }
    }

    if (missing.length > 0) {
      return { status: "unknown", missingFields: missing };
    }
    return { status: "matched", matchedConditions: matched };
  }

  // Handle ANY (OR) - one match => matched, all fail => fail, some unknown => unknown
  if (predicate.any) {
    const unknownFields: MissingField[] = [];

    for (const item of predicate.any) {
      if (isFieldCondition(item)) {
        const result = evaluateFieldCondition(item, facts);
        if (result.status === "matched") {
          // Short-circuit on first match
          return { status: "matched", matchedConditions: [item] };
        }
        if (result.status === "unknown") {
          unknownFields.push({
            field: item.field,
            conditionCode: extractConditionCode(item.field),
            reason: result.reason,
            requiredFor: "any",
          });
        }
        // Failed items don't need tracking in OR
      } else {
        const nestedResult = evaluatePredicate(item, facts);
        if (nestedResult.status === "matched") {
          return nestedResult;
        }
        if (nestedResult.status === "unknown") {
          unknownFields.push(...nestedResult.missingFields);
        }
      }
    }

    // No matches found
    if (unknownFields.length > 0) {
      // Unknown fields could potentially match, so result is unknown
      return { status: "unknown", missingFields: unknownFields };
    }
    // All evaluated and none matched
    return { status: "failed", failedConditions: [] };
  }

  // Handle NOT
  if (predicate.not) {
    const item = predicate.not;
    const innerResult = isFieldCondition(item)
      ? evaluateFieldCondition(item, facts)
      : evaluatePredicate(item, facts);

    if (innerResult.status === "unknown") {
      // NOT(unknown) => unknown
      return {
        status: "unknown",
        missingFields:
          "missingFields" in innerResult ? innerResult.missingFields : [],
      };
    }
    if (innerResult.status === "matched") {
      return { status: "failed", failedConditions: [] };
    }
    return { status: "matched", matchedConditions: [] };
  }

  // Should not reach here
  return { status: "matched", matchedConditions: [] };
}

// =============================================================================
// RULE SET EVALUATION
// =============================================================================

/**
 * Check if a rule is applicable based on age and gender filters
 */
function isRuleApplicable(
  rule: UnderwritingRule,
  age: number,
  gender: "male" | "female",
): boolean {
  // Check age band
  if (
    rule.age_band_min !== null &&
    rule.age_band_min !== undefined &&
    age < rule.age_band_min
  ) {
    return false;
  }
  if (
    rule.age_band_max !== null &&
    rule.age_band_max !== undefined &&
    age > rule.age_band_max
  ) {
    return false;
  }

  // Check gender
  if (
    rule.gender !== null &&
    rule.gender !== undefined &&
    rule.gender !== gender
  ) {
    return false;
  }

  return true;
}

/**
 * Build outcome from rule
 */
function buildOutcomeFromRule(rule: UnderwritingRule): RuleOutcome {
  return {
    eligibility: rule.outcome_eligibility as EligibilityStatus,
    health_class: rule.outcome_health_class,
    table_rating: rule.outcome_table_rating ?? "none",
    flat_extra_per_thousand: rule.outcome_flat_extra_per_thousand ?? undefined,
    flat_extra_years: rule.outcome_flat_extra_years ?? undefined,
    reason: rule.outcome_reason,
    concerns: rule.outcome_concerns ?? [],
  };
}

/**
 * Evaluate a rule set against facts
 */
export function evaluateRuleSet(
  ruleSet: UnderwritingRuleSet,
  facts: FactMap,
): ConditionOutcome {
  const rules = ruleSet.rules ?? [];
  const orderedRules = [...rules].sort((a, b) => a.priority - b.priority);

  const age = facts["client.age"];
  const gender = facts["client.gender"];
  const conditionCode = ruleSet.condition_code ?? undefined;

  // Filter applicable rules
  const applicableRules = orderedRules.filter((r) =>
    isRuleApplicable(r, age, gender),
  );

  const allMissing: MissingField[] = [];
  const skippedRules: string[] = [];

  for (const rule of applicableRules) {
    const predicate = parsePredicate(rule.predicate);
    const result = evaluatePredicate(predicate, facts);

    if (result.status === "matched") {
      const outcome = buildOutcomeFromRule(rule);
      return {
        conditionCode: conditionCode ?? "global",
        eligibility: outcome.eligibility,
        healthClass: outcome.health_class,
        tableUnits: getTableRatingUnits(outcome.table_rating),
        flatExtra: outcome.flat_extra_per_thousand
          ? {
              perThousand: outcome.flat_extra_per_thousand,
              years: outcome.flat_extra_years ?? 1,
              source: rule.name,
            }
          : null,
        concerns: outcome.concerns,
        matchedRules: [
          {
            ruleId: rule.id,
            ruleName: rule.name,
            ruleSetId: ruleSet.id,
            conditionCode,
            matchedConditions: result.matchedConditions,
            outcome,
          },
        ],
        missingFields: [],
      };
    }

    if (result.status === "unknown") {
      allMissing.push(...result.missingFields);
    }

    skippedRules.push(rule.name);
  }

  // No rules matched - use default outcome
  const defaultOutcome = ruleSet.default_outcome ?? DEFAULT_SAFE_OUTCOME;

  return {
    conditionCode: conditionCode ?? "global",
    eligibility:
      allMissing.length > 0
        ? "unknown"
        : (defaultOutcome.eligibility as EligibilityStatus | "unknown"),
    healthClass:
      allMissing.length > 0 ? "unknown" : defaultOutcome.health_class,
    tableUnits: 0,
    flatExtra: null,
    concerns:
      allMissing.length > 0
        ? [
            `Missing data to evaluate: ${allMissing.map((m) => m.field).join(", ")}`,
          ]
        : [defaultOutcome.reason],
    matchedRules: [],
    missingFields: allMissing,
  };
}

// =============================================================================
// AGGREGATION
// =============================================================================

/**
 * Aggregate flat extras based on carrier configuration
 */
function aggregateFlatExtras(
  extras: FlatExtra[],
  composition: "sum" | "max" | "worst_only",
): { totalPerThousand: number; maxDuration: number } {
  if (extras.length === 0) {
    return { totalPerThousand: 0, maxDuration: 0 };
  }

  switch (composition) {
    case "sum":
      return {
        totalPerThousand: extras.reduce((sum, e) => sum + e.perThousand, 0),
        maxDuration: Math.max(...extras.map((e) => e.years)),
      };

    case "max": {
      const maxExtra = extras.reduce((max, e) =>
        e.perThousand > max.perThousand ? e : max,
      );
      return {
        totalPerThousand: maxExtra.perThousand,
        maxDuration: maxExtra.years,
      };
    }

    case "worst_only": {
      // Use the one with highest total cost (rate * years)
      const worst = extras.reduce((max, e) =>
        e.perThousand * e.years > max.perThousand * max.years ? e : max,
      );
      return {
        totalPerThousand: worst.perThousand,
        maxDuration: worst.years,
      };
    }

    default:
      return { totalPerThousand: 0, maxDuration: 0 };
  }
}

/**
 * Aggregate outcomes from multiple conditions with global rules
 */
export function aggregateOutcomes(
  conditionOutcomes: ConditionOutcome[],
  globalOutcome: ConditionOutcome | null,
  carrierConfig: CarrierAggregationConfig = { flatExtraComposition: "max" },
): AggregatedOutcome {
  // Start with best possible
  let worstEligibility: EligibilityStatus | "unknown" = "eligible";
  let worstHealthClassRank = 1; // preferred_plus
  let maxTableUnits = 0;
  const allFlatExtras: FlatExtra[] = [];
  const allConcerns: string[] = [];
  const allMatched: MatchedRule[] = [];
  const allMissing: MissingField[] = [];

  // Process global outcome first (can decline/refer early)
  if (globalOutcome) {
    worstEligibility = getWorseEligibility(
      worstEligibility,
      globalOutcome.eligibility,
    );
    if (globalOutcome.eligibility === "ineligible") {
      // Global decline - short circuit
      return {
        eligibility: "ineligible",
        healthClass: "decline",
        tableRating: "none",
        tableUnits: 0,
        flatExtras: [],
        totalFlatExtraPerThousand: 0,
        maxFlatExtraDuration: 0,
        concerns: globalOutcome.concerns,
        matchedRules: globalOutcome.matchedRules,
        missingFields: [],
        globalOutcome,
        conditionOutcomes: [],
      };
    }
    allConcerns.push(...globalOutcome.concerns);
    allMatched.push(...globalOutcome.matchedRules);
    allMissing.push(...globalOutcome.missingFields);
    worstHealthClassRank = Math.max(
      worstHealthClassRank,
      getHealthClassRank(globalOutcome.healthClass),
    );
    maxTableUnits = Math.max(maxTableUnits, globalOutcome.tableUnits);
    if (globalOutcome.flatExtra) {
      allFlatExtras.push(globalOutcome.flatExtra);
    }
  }

  // Process each condition outcome
  for (const outcome of conditionOutcomes) {
    worstEligibility = getWorseEligibility(
      worstEligibility,
      outcome.eligibility,
    );
    worstHealthClassRank = Math.max(
      worstHealthClassRank,
      getHealthClassRank(outcome.healthClass),
    );

    // MAX table units (not multiply!)
    if (outcome.tableUnits > maxTableUnits) {
      maxTableUnits = outcome.tableUnits;
    }

    // Collect flat extras
    if (outcome.flatExtra) {
      allFlatExtras.push(outcome.flatExtra);
    }

    allConcerns.push(...outcome.concerns);
    allMatched.push(...outcome.matchedRules);
    allMissing.push(...outcome.missingFields);
  }

  // Aggregate flat extras based on carrier config
  const { totalPerThousand, maxDuration } = aggregateFlatExtras(
    allFlatExtras,
    carrierConfig.flatExtraComposition,
  );

  return {
    eligibility: worstEligibility,
    healthClass: getHealthClassFromRank(worstHealthClassRank),
    tableRating: getTableRatingFromUnits(maxTableUnits),
    tableUnits: maxTableUnits,
    flatExtras: allFlatExtras,
    totalFlatExtraPerThousand: totalPerThousand,
    maxFlatExtraDuration: maxDuration,
    concerns: [...new Set(allConcerns)],
    matchedRules: allMatched,
    missingFields: allMissing,
    globalOutcome,
    conditionOutcomes,
  };
}

// =============================================================================
// FACT MAP BUILDER
// =============================================================================

/**
 * Build canonical fact map from client data and condition responses
 *
 * IMPORTANT: bmi and state are optional. When not provided, the corresponding
 * FactMap fields will be undefined, which causes rules checking those fields
 * to evaluate as "unknown" (safe default - requires manual review).
 */
export function buildFactMap(
  client: {
    age: number;
    gender: "male" | "female";
    bmi?: number;
    state?: string;
    tobacco: boolean;
    medications?: MedicationInfo;
  },
  healthConditions: string[],
  conditionResponses: Record<string, Record<string, unknown>>,
): FactMap {
  const facts: FactMap = {
    "client.age": client.age,
    "client.gender": client.gender,
    "client.tobacco": client.tobacco,
    conditions: healthConditions,
  };

  // Only set optional fields if provided - undefined causes "unknown" evaluation
  if (client.bmi !== undefined && client.bmi > 0) {
    facts["client.bmi"] = client.bmi;
  }
  if (client.state !== undefined && client.state !== "") {
    facts["client.state"] = client.state;
  }

  // Add condition-specific responses
  // Use type assertion through unknown to allow dynamic keys
  const factsRecord = facts as unknown as Record<string, unknown>;
  addMedicationFacts(factsRecord, client.medications);
  for (const [conditionCode, responses] of Object.entries(conditionResponses)) {
    for (const [fieldId, value] of Object.entries(responses)) {
      factsRecord[`${conditionCode}.${fieldId}`] = value;
    }
  }

  return facts;
}

/**
 * Generate input hash for audit logging (no PHI)
 */
export function generateInputHash(facts: FactMap): string {
  // Create a deterministic string representation
  const keys = Object.keys(facts).sort();
  const values = keys.map((k) => {
    const v = facts[k as keyof FactMap];
    return `${k}:${typeof v === "object" ? JSON.stringify(v) : v}`;
  });
  const str = values.join("|");

  // Simple hash (in production, use crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
