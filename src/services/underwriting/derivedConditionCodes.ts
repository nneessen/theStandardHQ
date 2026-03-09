import type { ClientProfile } from "./decision-engine.types.ts";

export interface DerivedConditionCodesResult {
  allConditionCodes: string[];
  derivedConditionCodes: string[];
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    return undefined;
  }

  return value;
}

function normalizeDiabetesType(value: unknown): "type_1" | "type_2" | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "type 1") {
    return "type_1";
  }
  if (normalized === "type 2") {
    return "type_2";
  }

  return null;
}

/**
 * Derive carrier-facing diabetes aliases from the canonical wizard facts.
 *
 * These aliases exist because a meaningful portion of the seeded carrier rule
 * data still uses condition-code triggers like `diabetes_insulin_early` or
 * `diabetic_retinopathy` instead of pure predicate-only rule sets.
 */
function deriveDiabetesConditionCodes(
  clientAge: number,
  responses: Record<string, unknown> | undefined,
): string[] {
  if (!responses) {
    return [];
  }

  const derived = new Set<string>();
  const diabetesType = normalizeDiabetesType(responses.type);
  const insulinUse = responses.insulin_use === true;
  const a1cLevel = asFiniteNumber(responses.a1c_level);
  const goodControl = responses.good_control;
  const yearsSinceDiagnosis = asFiniteNumber(responses.years_since_diagnosis);
  const diagnosisAge =
    yearsSinceDiagnosis !== undefined
      ? clientAge - yearsSinceDiagnosis
      : undefined;
  const complications = asStringArray(responses.complications) ?? [];

  // Most rule seeds phrase early-onset diabetes as diagnosis before age 45.
  if (diagnosisAge !== undefined && diagnosisAge < 45) {
    derived.add("diabetes_juvenile");
  }

  // This alias is used by several seeded carrier rule sets for insulin-
  // dependent / early-onset diabetes. We only emit it with direct evidence.
  if (
    insulinUse &&
    (diabetesType === "type_1" ||
      (diagnosisAge !== undefined && diagnosisAge < 45))
  ) {
    derived.add("diabetes_insulin_early");
  }

  if (goodControl === false || (a1cLevel !== undefined && a1cLevel >= 7.5)) {
    derived.add("diabetes_uncontrolled");
  }

  if (complications.includes("retinopathy")) {
    derived.add("diabetic_retinopathy");
  }
  if (complications.includes("neuropathy")) {
    derived.add("diabetic_neuropathy");
  }
  if (complications.includes("amputation")) {
    derived.add("diabetes_amputation");
  }

  return [...derived];
}

export function deriveRuleConditionCodes(
  client: Pick<
    ClientProfile,
    "age" | "healthConditions" | "conditionResponses"
  >,
): DerivedConditionCodesResult {
  const baseConditionCodes = [...new Set(client.healthConditions)];
  const derivedConditionCodes = new Set<string>();

  if (baseConditionCodes.includes("diabetes")) {
    for (const code of deriveDiabetesConditionCodes(
      client.age,
      client.conditionResponses?.diabetes,
    )) {
      if (!baseConditionCodes.includes(code)) {
        derivedConditionCodes.add(code);
      }
    }
  }

  return {
    allConditionCodes: [...baseConditionCodes, ...derivedConditionCodes],
    derivedConditionCodes: [...derivedConditionCodes],
  };
}
