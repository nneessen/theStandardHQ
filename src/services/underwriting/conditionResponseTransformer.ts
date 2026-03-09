// src/services/underwriting/conditionResponseTransformer.ts
// Transforms wizard follow-up responses to rule-engine-compatible fact keys.
//
// CRITICAL SEMANTICS:
// - Missing source field → undefined output (NEVER false, NEVER [])
// - Derived fields only computed when source exists
// - Conditions without transformers pass through raw data with warning

import type { ConditionResponse } from "@/features/underwriting/types/underwriting.types.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Transformed condition responses with rule-compatible field names.
 * IMPORTANT: Missing inputs produce undefined outputs, never false/[]/0.
 */
export type TransformedConditionResponses = Record<
  string,
  Record<string, unknown>
>;

interface TransformResult {
  code: string;
  transformed: Record<string, unknown>;
  isRaw: boolean; // True if using pass-through (no specific transformer)
}

// ============================================================================
// Runtime-Safe Normalization Helpers
// ============================================================================

/**
 * Safely extract a non-empty string from unknown input.
 * Returns undefined for: undefined, null, empty string, non-string values.
 */
function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Safely extract a finite number from unknown input.
 * Accepts: number, numeric string (e.g., "7.5").
 * Returns undefined for: undefined, null, NaN, Infinity, non-numeric strings.
 */
function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const parsed = parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Safely extract a string array from unknown input.
 * Returns undefined for: undefined, null, non-array values, arrays with non-string elements.
 *
 * IMPORTANT: Empty arrays are PRESERVED (not converted to undefined).
 * The caller must decide whether an empty array means "unanswered" vs "explicitly none".
 */
function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  // Validate all elements are strings
  if (!value.every((item) => typeof item === "string")) return undefined;
  return value as string[];
}

// ============================================================================
// Constants (Documented Thresholds)
// ============================================================================

/**
 * A1C threshold for "controlled" / "good control" diabetes.
 * Per ADA (American Diabetes Association) guidelines:
 * - A1C < 7.0% is the general target for most adults
 * - A1C < 7.5% is often used as a more permissive threshold
 *
 * We use 7.5 as the threshold for underwriting purposes.
 */
const DIABETES_CONTROLLED_A1C_THRESHOLD = 7.5;

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Transform wizard follow-up responses to rule-compatible fact keys.
 *
 * Semantics:
 * - Missing source field → undefined (NOT false, NOT [])
 * - Derived fields only computed when source exists
 * - Conditions without transformers emit warning and pass through raw data
 *
 * @param conditions - Array of condition responses from the wizard
 * @param clientAge - Client's current age (needed for years_since_diagnosis)
 * @returns Transformed responses keyed by condition code
 */
export function transformConditionResponses(
  conditions: ConditionResponse[],
  clientAge: number,
): TransformedConditionResponses {
  const result: TransformedConditionResponses = {};

  for (const condition of conditions) {
    const { code, transformed, isRaw } = transformSingleCondition(
      condition.conditionCode,
      condition.responses,
      clientAge,
    );

    if (isRaw) {
      console.warn(
        `[ConditionTransformer] No transformer for "${code}". ` +
          `Raw wizard data passed through - rule predicates may not match.`,
      );
    }

    result[code] = transformed;
  }

  return result;
}

// ============================================================================
// Condition Router
// ============================================================================

function transformSingleCondition(
  code: string,
  responses: Record<string, string | number | string[]>,
  clientAge: number,
): TransformResult {
  switch (code) {
    case "diabetes":
      return {
        code,
        transformed: transformDiabetes(responses, clientAge),
        isRaw: false,
      };
    case "heart_disease":
      return {
        code,
        transformed: transformHeartDisease(responses, clientAge),
        isRaw: false,
      };
    case "heart_attack":
      return {
        code,
        transformed: transformHeartAttack(responses, clientAge),
        isRaw: false,
      };
    case "stroke":
      return {
        code,
        transformed: transformStroke(responses, clientAge),
        isRaw: false,
      };
    case "high_blood_pressure":
      return {
        code,
        transformed: transformHighBloodPressure(responses, clientAge),
        isRaw: false,
      };
    case "cancer":
      return {
        code,
        transformed: transformCancer(responses, clientAge),
        isRaw: false,
      };
    case "copd":
      return {
        code,
        transformed: transformCopd(responses, clientAge),
        isRaw: false,
      };
    case "depression":
    case "anxiety":
    case "bipolar":
      return {
        code,
        transformed: transformMentalHealth(code, responses, clientAge),
        isRaw: false,
      };
    default:
      // Pass through raw data for conditions without specific transformers
      return {
        code,
        transformed: responses as Record<string, unknown>,
        isRaw: true,
      };
  }
}

// ============================================================================
// Diabetes Transformer
// ============================================================================

/**
 * Explicit mapping of wizard treatment option strings to insulin_use boolean.
 * Using explicit mapping prevents substring matching errors (e.g., "No insulin" containing "Insulin").
 */
const DIABETES_TREATMENT_INSULIN_MAP: Record<string, boolean> = {
  // Insulin-using treatments
  "Insulin only": true,
  "Insulin pump": true,
  "Oral medication + Insulin": true,
  "Oral medication and Insulin": true,
  // Non-insulin treatments
  "Oral medication only": false,
  "Diet and exercise only": false,
  "Diet only": false,
  "No medication": false,
  "No insulin": false,
  "No treatment": false,
};

/**
 * Determine insulin_use from treatment string.
 * Uses explicit mapping first, falls back to substring matching only for unknown values.
 */
function deriveInsulinUse(treatment: string): boolean {
  // 1. Check explicit mapping first (case-sensitive)
  if (treatment in DIABETES_TREATMENT_INSULIN_MAP) {
    return DIABETES_TREATMENT_INSULIN_MAP[treatment];
  }

  // 2. Try case-insensitive exact match
  const lowerTreatment = treatment.toLowerCase();
  for (const [key, value] of Object.entries(DIABETES_TREATMENT_INSULIN_MAP)) {
    if (key.toLowerCase() === lowerTreatment) {
      return value;
    }
  }

  // 3. Fallback: substring matching with safeguards
  // Only use if no explicit mapping found - log warning for tracking
  console.warn(
    `[DiabetesTransformer] Unknown treatment string "${treatment}". Using substring heuristic.`,
  );

  // Check for negation patterns BEFORE checking for "insulin" presence
  const negationPatterns = [
    /\bno\s+insulin\b/i,
    /\bwithout\s+insulin\b/i,
    /\bnon-?insulin\b/i,
  ];
  if (negationPatterns.some((pattern) => pattern.test(treatment))) {
    return false;
  }

  // If "insulin" or "pump" present without negation, assume insulin use
  return /\binsulin\b/i.test(treatment) || /\bpump\b/i.test(treatment);
}

/**
 * Transform diabetes wizard responses to rule-compatible facts.
 *
 * Output Fields:
 * - insulin_use: boolean | undefined - derived from treatment string
 * - is_controlled: boolean | undefined - A1C < threshold (legacy alias)
 * - good_control: boolean | undefined - A1C < threshold (preferred name)
 * - a1c_level: number | undefined - raw A1C value (pass-through)
 * - complications: string[] | undefined - normalized complication list
 * - years_since_diagnosis: number | undefined - clientAge - diagnosisAge
 * - type: string | undefined - diabetes type (pass-through)
 *
 * CRITICAL SEMANTICS:
 * - Missing source → undefined output (NEVER false, NEVER [])
 * - Empty complications array without explicit "None" → undefined (unanswered)
 * - Invalid diagnosis_age → years_since_diagnosis undefined
 */
function transformDiabetes(
  responses: Record<string, unknown>,
  clientAge: number,
): Record<string, unknown> {
  // Safe extraction using normalization helpers
  const treatment = asNonEmptyString(responses.treatment);
  const a1cLevel = asFiniteNumber(responses.a1c_level);
  const rawComplications = asStringArray(responses.complications);
  const diagnosisAge = asFiniteNumber(responses.diagnosis_age);
  const diabetesType = asNonEmptyString(responses.type);

  const result: Record<string, unknown> = {};

  // insulin_use: Only set if treatment is provided (non-empty string)
  if (treatment !== undefined) {
    result.insulin_use = deriveInsulinUse(treatment);
  }
  // If treatment is undefined/empty, insulin_use stays undefined (NOT false)

  // is_controlled & good_control: Only set if A1C is provided and finite
  if (a1cLevel !== undefined) {
    const controlled = a1cLevel < DIABETES_CONTROLLED_A1C_THRESHOLD;
    result.is_controlled = controlled;
    result.good_control = controlled; // Alias for predicates using either name
    result.a1c_level = a1cLevel; // Pass through raw value
  }
  // If a1c_level is undefined/invalid, is_controlled & good_control stay undefined

  // complications: Only set if provided, with special handling for empty arrays
  if (rawComplications !== undefined) {
    const normalized = normalizeDiabetesComplications(rawComplications);
    // Only set if original array was NOT empty, OR if it contained explicit "None"
    // Empty array without "None" means the user didn't answer → undefined
    if (
      rawComplications.length > 0 ||
      rawComplications.some((c) => c === "None")
    ) {
      result.complications = normalized;
    }
    // else: empty array without "None" → leave undefined (unanswered)
  }
  // If rawComplications is undefined, result.complications stays undefined

  // years_since_diagnosis: Only set if diagnosis_age is valid and reasonable
  if (diagnosisAge !== undefined) {
    const clientAgeNum = asFiniteNumber(clientAge);
    if (
      clientAgeNum !== undefined &&
      diagnosisAge >= 0 &&
      clientAgeNum >= diagnosisAge
    ) {
      result.years_since_diagnosis = clientAgeNum - diagnosisAge;
    }
    // Invalid scenarios (negative diagnosis_age, future diagnosis) → undefined
  }
  // NO date synthesis - use numeric years instead

  // Pass through original type if provided (non-empty string)
  if (diabetesType !== undefined) {
    result.type = diabetesType;
  }

  return result;
}

/**
 * Normalize wizard complication labels to canonical rule values.
 *
 * Mapping:
 * - "Retinopathy (eye)" → "retinopathy"
 * - "Neuropathy (nerve)" → "neuropathy"
 * - "Nephropathy (kidney)" → "nephropathy"
 * - "Amputation" → "amputation"
 * - "Heart disease" → "heart_disease"
 * - "None" → filtered out (results in empty array)
 *
 * Unknown values are normalized: lowercased with parentheticals removed.
 */
function normalizeDiabetesComplications(complications: string[]): string[] {
  const mapping: Record<string, string> = {
    "Retinopathy (eye)": "retinopathy",
    "Neuropathy (nerve)": "neuropathy",
    "Nephropathy (kidney)": "nephropathy",
    Amputation: "amputation",
    "Heart disease": "heart_disease",
    None: "", // Filter out "None" selection
  };

  return complications
    .map((c) => mapping[c] ?? c.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ""))
    .filter((c) => c !== "");
}

// ============================================================================
// Heart Disease Transformer
// ============================================================================

/**
 * Ejection fraction thresholds for underwriting.
 * - Normal: >= 55%
 * - Mildly reduced: 45-54%
 * - Moderately reduced: 35-44%
 * - Severely reduced: < 35%
 */
const EJECTION_FRACTION_NORMAL_THRESHOLD = 55;
const EJECTION_FRACTION_REDUCED_THRESHOLD = 35;

/**
 * Transform heart disease wizard responses to rule-compatible facts.
 *
 * Output Fields:
 * - type: string | undefined - type of heart disease
 * - years_since_diagnosis: number | undefined - derived from diagnosis_date
 * - has_stent: boolean | undefined - had angioplasty/stent
 * - has_bypass: boolean | undefined - had CABG surgery
 * - has_valve_replacement: boolean | undefined
 * - has_pacemaker: boolean | undefined
 * - has_defibrillator: boolean | undefined
 * - ejection_fraction: number | undefined
 * - ef_normal: boolean | undefined - EF >= 55%
 * - ef_severely_reduced: boolean | undefined - EF < 35%
 * - symptoms_controlled: boolean | undefined
 * - on_blood_thinner: boolean | undefined
 * - on_beta_blocker: boolean | undefined
 * - medications: string[] | undefined
 * - procedures: string[] | undefined
 */
function transformHeartDisease(
  responses: Record<string, unknown>,
  _clientAge: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Type (pass-through)
  const heartDiseaseType = asNonEmptyString(responses.type);
  if (heartDiseaseType !== undefined) {
    result.type = heartDiseaseType;
  }

  // Years since diagnosis
  const diagnosisDate = asNonEmptyString(responses.diagnosis_date);
  if (diagnosisDate !== undefined) {
    const yearsSince = calculateYearsSinceDate(diagnosisDate);
    if (yearsSince !== undefined) {
      result.years_since_diagnosis = yearsSince;
    }
  }

  // Procedures - derive boolean flags
  const procedures = asStringArray(responses.procedures);
  if (procedures !== undefined && procedures.length > 0) {
    const normalizedProcedures = normalizeProcedureList(procedures);
    result.procedures = normalizedProcedures;
    result.has_stent = normalizedProcedures.includes("angioplasty_stent");
    result.has_bypass = normalizedProcedures.includes("bypass_cabg");
    result.has_valve_replacement =
      normalizedProcedures.includes("valve_replacement");
    result.has_pacemaker = normalizedProcedures.includes("pacemaker");
    result.has_defibrillator = normalizedProcedures.includes("defibrillator");
    result.no_procedures =
      normalizedProcedures.length === 0 ||
      normalizedProcedures.includes("none");
  }

  // Ejection fraction
  const ejectionFraction = asFiniteNumber(responses.ejection_fraction);
  if (ejectionFraction !== undefined) {
    result.ejection_fraction = ejectionFraction;
    result.ef_normal = ejectionFraction >= EJECTION_FRACTION_NORMAL_THRESHOLD;
    result.ef_severely_reduced =
      ejectionFraction < EJECTION_FRACTION_REDUCED_THRESHOLD;
  }

  // Symptoms controlled
  const symptomsControlled = asNonEmptyString(responses.symptoms_controlled);
  if (symptomsControlled !== undefined) {
    result.symptoms_controlled =
      symptomsControlled === "Yes, fully controlled" ||
      symptomsControlled === "Mostly controlled";
    result.symptoms_controlled_raw = symptomsControlled;
  }

  // Medications - derive boolean flags
  const medications = asStringArray(responses.medications);
  if (medications !== undefined && medications.length > 0) {
    const normalizedMeds = normalizeMedicationList(medications);
    result.medications = normalizedMeds;
    result.on_blood_thinner = normalizedMeds.includes("blood_thinner");
    result.on_beta_blocker = normalizedMeds.includes("beta_blocker");
    result.on_statin = normalizedMeds.includes("statin");
    result.on_ace_inhibitor = normalizedMeds.includes("ace_inhibitor_arb");
  }

  return result;
}

// ============================================================================
// Heart Attack Transformer
// ============================================================================

/**
 * Transform heart attack wizard responses to rule-compatible facts.
 *
 * Output Fields:
 * - years_since_event: number | undefined
 * - multiple_events: boolean | undefined - more than one heart attack
 * - event_count: number | undefined - 1, 2, or 3
 * - had_stent: boolean | undefined
 * - had_bypass: boolean | undefined
 * - medication_only: boolean | undefined
 * - ejection_fraction_post: number | undefined
 * - ef_normal: boolean | undefined
 * - ef_severely_reduced: boolean | undefined
 * - has_heart_failure: boolean | undefined
 * - has_arrhythmia: boolean | undefined
 * - has_cardiogenic_shock: boolean | undefined
 * - has_complications: boolean | undefined
 * - full_recovery: boolean | undefined
 * - partial_recovery: boolean | undefined
 */
function transformHeartAttack(
  responses: Record<string, unknown>,
  _clientAge: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Years since event
  const eventDate = asNonEmptyString(responses.date_of_event);
  if (eventDate !== undefined) {
    const yearsSince = calculateYearsSinceDate(eventDate);
    if (yearsSince !== undefined) {
      result.years_since_event = yearsSince;
    }
  }

  // Number of events
  const numberOfEvents = asNonEmptyString(responses.number_of_events);
  if (numberOfEvents !== undefined) {
    const eventCount = parseEventCount(numberOfEvents);
    if (eventCount !== undefined) {
      result.event_count = eventCount;
      result.multiple_events = eventCount > 1;
    }
  }

  // Treatment - derive boolean flags
  const treatment = asStringArray(responses.treatment);
  if (treatment !== undefined && treatment.length > 0) {
    const normalizedTreatment = treatment.map((t) =>
      t.toLowerCase().replace(/[^a-z]/g, "_"),
    );
    result.had_stent = treatment.some(
      (t) =>
        t.toLowerCase().includes("angioplasty") ||
        t.toLowerCase().includes("stent"),
    );
    result.had_bypass = treatment.some(
      (t) =>
        t.toLowerCase().includes("bypass") || t.toLowerCase().includes("cabg"),
    );
    result.medication_only = treatment.some(
      (t) =>
        t.toLowerCase().includes("medication only") &&
        !result.had_stent &&
        !result.had_bypass,
    );
    result.treatment = normalizedTreatment;
  }

  // Ejection fraction post-event
  const ejectionFractionPost = asFiniteNumber(responses.ejection_fraction_post);
  if (ejectionFractionPost !== undefined) {
    result.ejection_fraction_post = ejectionFractionPost;
    result.ef_normal =
      ejectionFractionPost >= EJECTION_FRACTION_NORMAL_THRESHOLD;
    result.ef_severely_reduced =
      ejectionFractionPost < EJECTION_FRACTION_REDUCED_THRESHOLD;
  }

  // Complications
  const complications = asStringArray(responses.complications);
  if (complications !== undefined && complications.length > 0) {
    const normalizedComplications = normalizeComplicationList(complications);
    result.complications = normalizedComplications;
    result.has_heart_failure =
      normalizedComplications.includes("heart_failure");
    result.has_arrhythmia = normalizedComplications.includes("arrhythmia");
    result.has_cardiogenic_shock =
      normalizedComplications.includes("cardiogenic_shock");
    result.has_complications =
      normalizedComplications.length > 0 &&
      !normalizedComplications.includes("none");
  }

  // Full recovery
  const fullRecovery = asNonEmptyString(responses.full_recovery);
  if (fullRecovery !== undefined) {
    result.full_recovery = fullRecovery === "Yes";
    result.partial_recovery =
      fullRecovery === "Partial" || fullRecovery === "Mostly";
    result.recovery_status = fullRecovery.toLowerCase();
  }

  return result;
}

// ============================================================================
// Stroke Transformer
// ============================================================================

/**
 * Transform stroke/TIA wizard responses to rule-compatible facts.
 *
 * Output Fields:
 * - type: string | undefined - ischemic, hemorrhagic, tia
 * - is_tia: boolean | undefined - was it a mini-stroke
 * - is_ischemic: boolean | undefined
 * - is_hemorrhagic: boolean | undefined
 * - years_since_event: number | undefined
 * - multiple_events: boolean | undefined
 * - event_count: number | undefined
 * - has_residual_effects: boolean | undefined
 * - residual_effects: string[] | undefined
 * - has_paralysis: boolean | undefined
 * - has_speech_difficulty: boolean | undefined
 * - has_cognitive_changes: boolean | undefined
 * - cause: string | undefined
 * - cause_is_afib: boolean | undefined
 * - on_blood_thinners: boolean | undefined
 */
function transformStroke(
  responses: Record<string, unknown>,
  _clientAge: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Type of stroke
  const strokeType = asNonEmptyString(responses.type);
  if (strokeType !== undefined) {
    const normalizedType = strokeType.toLowerCase();
    result.type = normalizedType;
    result.is_tia =
      normalizedType.includes("tia") || normalizedType.includes("mini");
    result.is_ischemic = normalizedType.includes("ischemic");
    result.is_hemorrhagic = normalizedType.includes("hemorrhagic");
  }

  // Years since event
  const eventDate = asNonEmptyString(responses.date_of_event);
  if (eventDate !== undefined) {
    const yearsSince = calculateYearsSinceDate(eventDate);
    if (yearsSince !== undefined) {
      result.years_since_event = yearsSince;
    }
  }

  // Number of events
  const numberOfEvents = asNonEmptyString(responses.number_of_events);
  if (numberOfEvents !== undefined) {
    const eventCount = parseEventCount(numberOfEvents);
    if (eventCount !== undefined) {
      result.event_count = eventCount;
      result.multiple_events = eventCount > 1;
    }
  }

  // Residual effects
  const residualEffects = asStringArray(responses.residual_effects);
  if (residualEffects !== undefined && residualEffects.length > 0) {
    const normalizedEffects = normalizeResidualEffects(residualEffects);
    result.residual_effects = normalizedEffects;
    result.has_residual_effects =
      normalizedEffects.length > 0 && !normalizedEffects.includes("none");
    result.has_paralysis = normalizedEffects.includes("paralysis_weakness");
    result.has_speech_difficulty =
      normalizedEffects.includes("speech_difficulty");
    result.has_cognitive_changes =
      normalizedEffects.includes("cognitive_changes");
    result.has_vision_problems = normalizedEffects.includes("vision_problems");
  }

  // Cause identified
  const causeIdentified = asNonEmptyString(responses.cause_identified);
  if (causeIdentified !== undefined) {
    result.cause = causeIdentified.toLowerCase().replace(/[^a-z]/g, "_");
    result.cause_is_afib =
      causeIdentified.toLowerCase().includes("afib") ||
      causeIdentified.toLowerCase().includes("atrial");
  }

  // Blood thinners
  const onBloodThinners = asNonEmptyString(responses.on_blood_thinners);
  if (onBloodThinners !== undefined) {
    result.on_blood_thinners = onBloodThinners === "Yes";
  }

  return result;
}

// ============================================================================
// High Blood Pressure Transformer
// ============================================================================

/**
 * Blood pressure thresholds (per AHA guidelines).
 * - Normal: < 120/80
 * - Elevated: 120-129/<80
 * - Stage 1: 130-139/80-89
 * - Stage 2: >= 140/90
 * - Crisis: > 180/120
 */
const BP_STAGE2_SYSTOLIC = 140;
const BP_STAGE2_DIASTOLIC = 90;
const BP_CRISIS_SYSTOLIC = 180;
const BP_CRISIS_DIASTOLIC = 120;

/**
 * Transform high blood pressure wizard responses to rule-compatible facts.
 *
 * Output Fields:
 * - years_since_diagnosis: number | undefined
 * - systolic: number | undefined - parsed from current_reading
 * - diastolic: number | undefined - parsed from current_reading
 * - bp_controlled: boolean | undefined
 * - well_controlled: boolean | undefined
 * - poorly_controlled: boolean | undefined
 * - is_stage2_or_higher: boolean | undefined
 * - is_crisis: boolean | undefined
 * - medication_count: number | undefined
 * - on_multiple_medications: boolean | undefined
 * - has_complications: boolean | undefined
 * - has_heart_complications: boolean | undefined
 * - has_kidney_complications: boolean | undefined
 */
function transformHighBloodPressure(
  responses: Record<string, unknown>,
  _clientAge: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Years since diagnosis
  const diagnosisDate = asNonEmptyString(responses.diagnosis_date);
  if (diagnosisDate !== undefined) {
    const yearsSince = calculateYearsSinceDate(diagnosisDate);
    if (yearsSince !== undefined) {
      result.years_since_diagnosis = yearsSince;
    }
  }

  // Parse blood pressure reading (e.g., "130/85")
  const currentReading = asNonEmptyString(responses.current_reading);
  if (currentReading !== undefined) {
    const bpParsed = parseBloodPressure(currentReading);
    if (bpParsed !== undefined) {
      result.systolic = bpParsed.systolic;
      result.diastolic = bpParsed.diastolic;
      result.is_stage2_or_higher =
        bpParsed.systolic >= BP_STAGE2_SYSTOLIC ||
        bpParsed.diastolic >= BP_STAGE2_DIASTOLIC;
      result.is_crisis =
        bpParsed.systolic > BP_CRISIS_SYSTOLIC ||
        bpParsed.diastolic > BP_CRISIS_DIASTOLIC;
    }
  }

  // Control status
  const controlled = asNonEmptyString(responses.controlled);
  if (controlled !== undefined) {
    result.bp_controlled =
      controlled === "Yes, consistently normal" ||
      controlled === "Mostly controlled";
    result.well_controlled = controlled === "Yes, consistently normal";
    result.poorly_controlled = controlled === "Poorly controlled";
    result.control_status = controlled;
  }

  // Medication count
  const medicationCount = asNonEmptyString(responses.medication_count);
  if (medicationCount !== undefined) {
    const count = parseMedicationCount(medicationCount);
    if (count !== undefined) {
      result.medication_count = count;
      result.on_multiple_medications = count >= 2;
      result.diet_only = count === 0;
    }
  }

  // Complications
  const complications = asStringArray(responses.complications);
  if (complications !== undefined && complications.length > 0) {
    const normalizedComplications =
      normalizeHypertensionComplications(complications);
    result.complications = normalizedComplications;
    result.has_complications =
      normalizedComplications.length > 0 &&
      !normalizedComplications.includes("none");
    result.has_heart_complications =
      normalizedComplications.includes("heart_disease");
    result.has_kidney_complications =
      normalizedComplications.includes("kidney_problems");
    result.has_eye_complications =
      normalizedComplications.includes("eye_problems");
  }

  return result;
}

// ============================================================================
// Cancer Transformer
// ============================================================================

/**
 * Cancer stage risk mapping.
 * - Stage 0 (in situ): Low risk
 * - Stage I: Low-moderate risk
 * - Stage II: Moderate risk
 * - Stage III: High risk
 * - Stage IV: Very high risk (metastatic)
 */
const CANCER_HIGH_RISK_TYPES = [
  "pancreatic",
  "lung",
  "brain",
  "leukemia",
  "lymphoma",
];

/**
 * Transform cancer wizard responses to rule-compatible facts.
 *
 * Output Fields:
 * - cancer_type: string | undefined
 * - is_high_risk_type: boolean | undefined
 * - is_skin_cancer: boolean | undefined
 * - is_melanoma: boolean | undefined
 * - years_since_diagnosis: number | undefined
 * - stage: number | undefined (0-4)
 * - stage_raw: string | undefined
 * - is_early_stage: boolean | undefined (0 or 1)
 * - is_advanced_stage: boolean | undefined (3 or 4)
 * - had_surgery: boolean | undefined
 * - had_chemo: boolean | undefined
 * - had_radiation: boolean | undefined
 * - in_remission: boolean | undefined
 * - in_treatment: boolean | undefined
 * - has_recurrence: boolean | undefined
 * - years_in_remission: number | undefined
 */
function transformCancer(
  responses: Record<string, unknown>,
  _clientAge: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Cancer type
  const cancerType = asNonEmptyString(responses.cancer_type);
  if (cancerType !== undefined) {
    const normalizedType = cancerType.toLowerCase().replace(/[^a-z]/g, "_");
    result.cancer_type = normalizedType;
    result.is_high_risk_type = CANCER_HIGH_RISK_TYPES.some((t) =>
      normalizedType.includes(t),
    );
    result.is_skin_cancer = normalizedType.includes("skin");
    result.is_melanoma = normalizedType.includes("melanoma");
    result.is_non_melanoma_skin =
      normalizedType.includes("skin") &&
      normalizedType.includes("non") &&
      !normalizedType.includes("melanoma");
  }

  // Years since diagnosis
  const diagnosisDate = asNonEmptyString(responses.diagnosis_date);
  if (diagnosisDate !== undefined) {
    const yearsSince = calculateYearsSinceDate(diagnosisDate);
    if (yearsSince !== undefined) {
      result.years_since_diagnosis = yearsSince;
    }
  }

  // Stage
  const stageAtDiagnosis = asNonEmptyString(responses.stage_at_diagnosis);
  if (stageAtDiagnosis !== undefined) {
    const stageNum = parseCancerStage(stageAtDiagnosis);
    result.stage_raw = stageAtDiagnosis;
    if (stageNum !== undefined) {
      result.stage = stageNum;
      result.is_early_stage = stageNum <= 1;
      result.is_advanced_stage = stageNum >= 3;
      result.is_metastatic = stageNum === 4;
    }
  }

  // Treatment
  const treatment = asStringArray(responses.treatment);
  if (treatment !== undefined && treatment.length > 0) {
    const normalizedTreatment = treatment.map((t) =>
      t.toLowerCase().replace(/[^a-z]/g, "_"),
    );
    result.treatment = normalizedTreatment;
    result.had_surgery = treatment.some((t) =>
      t.toLowerCase().includes("surgery"),
    );
    result.had_chemo = treatment.some(
      (t) =>
        t.toLowerCase().includes("chemo") ||
        t.toLowerCase().includes("chemotherapy"),
    );
    result.had_radiation = treatment.some((t) =>
      t.toLowerCase().includes("radiation"),
    );
    result.had_immunotherapy = treatment.some((t) =>
      t.toLowerCase().includes("immunotherapy"),
    );
    result.watchful_waiting = treatment.some((t) =>
      t.toLowerCase().includes("watchful"),
    );
  }

  // Current status
  const currentStatus = asNonEmptyString(responses.current_status);
  if (currentStatus !== undefined) {
    result.current_status = currentStatus.toLowerCase().replace(/[^a-z]/g, "_");
    result.in_remission =
      currentStatus.toLowerCase().includes("remission") ||
      currentStatus.toLowerCase().includes("no evidence");
    result.in_treatment = currentStatus.toLowerCase().includes("in treatment");
    result.has_recurrence = currentStatus.toLowerCase().includes("recurrence");
    result.is_stable = currentStatus.toLowerCase().includes("stable");
  }

  // Years in remission
  const remissionDate = asNonEmptyString(responses.remission_date);
  if (remissionDate !== undefined) {
    const yearsSince = calculateYearsSinceDate(remissionDate);
    if (yearsSince !== undefined) {
      result.years_in_remission = yearsSince;
    }
  }

  return result;
}

// ============================================================================
// COPD Transformer
// ============================================================================

/**
 * Transform COPD/emphysema wizard responses to rule-compatible facts.
 *
 * Output Fields:
 * - years_since_diagnosis: number | undefined
 * - severity: string | undefined
 * - is_mild: boolean | undefined
 * - is_severe: boolean | undefined
 * - requires_oxygen: boolean | undefined
 * - continuous_oxygen: boolean | undefined
 * - hospitalizations: number | undefined
 * - hospitalized_past_year: boolean | undefined (inferred from past 2 years)
 * - is_current_smoker: boolean | undefined
 * - is_former_smoker: boolean | undefined
 * - inhaler_count: number | undefined
 * - on_multiple_inhalers: boolean | undefined
 */
function transformCopd(
  responses: Record<string, unknown>,
  _clientAge: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Years since diagnosis
  const diagnosisDate = asNonEmptyString(responses.diagnosis_date);
  if (diagnosisDate !== undefined) {
    const yearsSince = calculateYearsSinceDate(diagnosisDate);
    if (yearsSince !== undefined) {
      result.years_since_diagnosis = yearsSince;
    }
  }

  // Severity
  const severity = asNonEmptyString(responses.severity);
  if (severity !== undefined) {
    const normalizedSeverity = severity.toLowerCase();
    result.severity = normalizedSeverity;
    result.is_mild = normalizedSeverity === "mild";
    result.is_moderate = normalizedSeverity === "moderate";
    result.is_severe =
      normalizedSeverity === "severe" ||
      normalizedSeverity.includes("very severe");
  }

  // Oxygen use
  const oxygenUse = asNonEmptyString(responses.oxygen_use);
  if (oxygenUse !== undefined) {
    result.oxygen_use_raw = oxygenUse;
    result.requires_oxygen = oxygenUse !== "No";
    result.continuous_oxygen = oxygenUse.toLowerCase().includes("continuously");
    result.nighttime_oxygen = oxygenUse.toLowerCase().includes("night");
  }

  // Hospitalizations (past 2 years)
  const hospitalizations = asNonEmptyString(responses.hospitalizations);
  if (hospitalizations !== undefined) {
    const hospCount = parseEventCount(hospitalizations);
    if (hospCount !== undefined) {
      result.hospitalizations = hospCount;
      result.hospitalized_past_year = hospCount >= 1; // Conservative estimate
      result.multiple_hospitalizations = hospCount >= 2;
    }
  }

  // Smoking status
  const smokingStatus = asNonEmptyString(responses.smoking_status);
  if (smokingStatus !== undefined) {
    result.smoking_status = smokingStatus.toLowerCase().replace(/[^a-z]/g, "_");
    result.is_current_smoker = smokingStatus.toLowerCase().includes("current");
    result.is_former_smoker = smokingStatus.toLowerCase().includes("former");
    result.never_smoked = smokingStatus.toLowerCase().includes("never");
  }

  // Inhalers
  const inhalers = asNonEmptyString(responses.inhalers);
  if (inhalers !== undefined) {
    const inhalerCount = parseEventCount(inhalers);
    if (inhalerCount !== undefined) {
      result.inhaler_count = inhalerCount;
      result.on_multiple_inhalers = inhalerCount >= 2;
    }
  }

  return result;
}

// ============================================================================
// Mental Health Transformer (Depression, Anxiety, Bipolar)
// ============================================================================

/**
 * Transform mental health condition wizard responses to rule-compatible facts.
 * Handles: depression, anxiety, bipolar
 *
 * Common Output Fields:
 * - years_since_diagnosis: number | undefined
 * - severity: string | undefined
 * - is_mild: boolean | undefined
 * - is_severe: boolean | undefined
 * - in_remission: boolean | undefined
 * - on_medication: boolean | undefined
 * - in_therapy: boolean | undefined
 * - stable_on_treatment: boolean | undefined
 * - hospitalized: boolean | undefined
 * - multiple_hospitalizations: boolean | undefined
 *
 * Depression-specific:
 * - suicide_history: boolean | undefined
 * - work_disabled: boolean | undefined
 *
 * Anxiety-specific:
 * - anxiety_type: string | undefined
 * - has_panic_attacks: boolean | undefined
 * - frequent_panic_attacks: boolean | undefined
 *
 * Bipolar-specific:
 * - bipolar_type: string | undefined
 * - is_stable: boolean | undefined
 * - is_compliant: boolean | undefined
 */
function transformMentalHealth(
  conditionCode: string,
  responses: Record<string, unknown>,
  _clientAge: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Years since diagnosis (common)
  const diagnosisDate = asNonEmptyString(responses.diagnosis_date);
  if (diagnosisDate !== undefined) {
    const yearsSince = calculateYearsSinceDate(diagnosisDate);
    if (yearsSince !== undefined) {
      result.years_since_diagnosis = yearsSince;
    }
  }

  // Severity (common)
  const severity = asNonEmptyString(responses.severity);
  if (severity !== undefined) {
    const normalizedSeverity = severity.toLowerCase();
    result.severity = normalizedSeverity;
    result.is_mild = normalizedSeverity === "mild";
    result.is_moderate = normalizedSeverity === "moderate";
    result.is_severe = normalizedSeverity === "severe";
    result.in_remission = normalizedSeverity.includes("remission");
  }

  // Treatment (common)
  const treatment = asStringArray(responses.treatment);
  if (treatment !== undefined && treatment.length > 0) {
    result.treatment = treatment.map((t) =>
      t.toLowerCase().replace(/[^a-z]/g, "_"),
    );
    result.on_medication = treatment.some(
      (t) =>
        t.toLowerCase().includes("medication") ||
        t.toLowerCase().includes("antidepressant") ||
        t.toLowerCase().includes("ssri") ||
        t.toLowerCase().includes("snri") ||
        t.toLowerCase().includes("benzodiazepine"),
    );
    result.in_therapy = treatment.some(
      (t) =>
        t.toLowerCase().includes("therapy") ||
        t.toLowerCase().includes("counseling"),
    );
    result.no_treatment = treatment.some((t) =>
      t.toLowerCase().includes("no current treatment"),
    );
    result.stable_on_treatment = result.on_medication && !result.is_severe;
  }

  // Hospitalizations (common)
  const hospitalizations = asNonEmptyString(responses.hospitalizations);
  if (hospitalizations !== undefined) {
    const isHospitalized =
      hospitalizations !== "No" && hospitalizations !== "0";
    result.hospitalized = isHospitalized;
    result.multiple_hospitalizations =
      hospitalizations.includes("more than once") ||
      hospitalizations === "2" ||
      hospitalizations.includes("3") ||
      hospitalizations.includes("more");
  }

  // Condition-specific fields
  if (conditionCode === "depression") {
    // Suicide attempt history
    const suicideAttempt = asNonEmptyString(responses.suicide_attempt);
    if (suicideAttempt !== undefined) {
      result.suicide_history = suicideAttempt === "Yes";
    }

    // Work impact
    const workImpact = asNonEmptyString(responses.work_impact);
    if (workImpact !== undefined) {
      result.work_impact = workImpact.toLowerCase().replace(/[^a-z]/g, "_");
      result.work_disabled =
        workImpact.toLowerCase().includes("disability") ||
        workImpact.toLowerCase().includes("unable to work");
    }
  }

  if (conditionCode === "anxiety") {
    // Anxiety type
    const anxietyType = asNonEmptyString(responses.type);
    if (anxietyType !== undefined) {
      result.anxiety_type = anxietyType.toLowerCase().replace(/[^a-z]/g, "_");
      result.is_ptsd = anxietyType.toLowerCase().includes("ptsd");
      result.is_ocd = anxietyType.toLowerCase().includes("ocd");
      result.is_panic_disorder = anxietyType.toLowerCase().includes("panic");
    }

    // Panic attacks
    const panicAttacks = asNonEmptyString(responses.panic_attacks);
    if (panicAttacks !== undefined) {
      result.panic_frequency = panicAttacks.toLowerCase();
      result.has_panic_attacks =
        panicAttacks !== "Never" && panicAttacks.toLowerCase() !== "never";
      result.frequent_panic_attacks =
        panicAttacks.toLowerCase().includes("weekly") ||
        panicAttacks.toLowerCase().includes("daily");
    }
  }

  if (conditionCode === "bipolar") {
    // Bipolar type
    const bipolarType = asNonEmptyString(responses.type);
    if (bipolarType !== undefined) {
      result.bipolar_type = bipolarType.toLowerCase().replace(/[^a-z]/g, "_");
      result.is_bipolar_1 =
        bipolarType.toLowerCase().includes("i") &&
        !bipolarType.toLowerCase().includes("ii");
      result.is_bipolar_2 = bipolarType.toLowerCase().includes("ii");
    }

    // Current state
    const currentState = asNonEmptyString(responses.current_state);
    if (currentState !== undefined) {
      result.current_state = currentState.toLowerCase().replace(/[^a-z]/g, "_");
      result.is_stable = currentState.toLowerCase().includes("stable");
      result.in_episode =
        currentState.toLowerCase().includes("manic") ||
        currentState.toLowerCase().includes("depressive") ||
        currentState.toLowerCase().includes("mixed");
    }

    // Medications (specific)
    const medications = asStringArray(responses.medications);
    if (medications !== undefined && medications.length > 0) {
      result.on_lithium = medications.some((m) =>
        m.toLowerCase().includes("lithium"),
      );
      result.on_antipsychotic = medications.some((m) =>
        m.toLowerCase().includes("antipsychotic"),
      );
    }

    // Compliance
    const compliance = asNonEmptyString(responses.compliance);
    if (compliance !== undefined) {
      result.compliance_level = compliance
        .toLowerCase()
        .replace(/[^a-z]/g, "_");
      result.is_compliant =
        compliance.toLowerCase().includes("always") ||
        compliance.toLowerCase().includes("mostly");
      result.often_non_compliant = compliance
        .toLowerCase()
        .includes("often non");
    }
  }

  return result;
}

// ============================================================================
// Helper Functions for Transformers
// ============================================================================

/**
 * Calculate years since a given date string.
 * Supports ISO date format (YYYY-MM-DD) and common US formats.
 */
function calculateYearsSinceDate(dateStr: string): number | undefined {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return undefined;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const years = diffMs / (1000 * 60 * 60 * 24 * 365.25);

    return years >= 0 ? Math.floor(years * 10) / 10 : undefined; // Round to 1 decimal
  } catch {
    return undefined;
  }
}

/**
 * Parse event count from strings like "1", "2", "3 or more".
 */
function parseEventCount(countStr: string): number | undefined {
  const trimmed = countStr.trim();

  // Direct number
  const direct = parseInt(trimmed, 10);
  if (!isNaN(direct)) return direct;

  // "3 or more" → 3
  const orMoreMatch = trimmed.match(/(\d+)\s*(or\s*more|\+)/i);
  if (orMoreMatch) return parseInt(orMoreMatch[1], 10);

  return undefined;
}

/**
 * Parse medication count from strings like "0 (diet/lifestyle only)", "1", "2", "3 or more".
 */
function parseMedicationCount(countStr: string): number | undefined {
  const trimmed = countStr.trim();

  // Extract leading number
  const match = trimmed.match(/^(\d+)/);
  if (match) return parseInt(match[1], 10);

  return undefined;
}

/**
 * Parse blood pressure reading from format "130/85".
 */
function parseBloodPressure(
  reading: string,
): { systolic: number; diastolic: number } | undefined {
  const match = reading.trim().match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return undefined;

  const systolic = parseInt(match[1], 10);
  const diastolic = parseInt(match[2], 10);

  if (isNaN(systolic) || isNaN(diastolic)) return undefined;
  if (systolic < 60 || systolic > 250) return undefined;
  if (diastolic < 30 || diastolic > 150) return undefined;

  return { systolic, diastolic };
}

/**
 * Parse cancer stage from strings like "Stage 0 (in situ)", "Stage I", "Stage IV".
 */
function parseCancerStage(stageStr: string): number | undefined {
  const normalizedStage = stageStr.toLowerCase();

  if (normalizedStage.includes("0") || normalizedStage.includes("in situ"))
    return 0;
  if (normalizedStage.includes("iv") || normalizedStage.includes("4")) return 4;
  if (normalizedStage.includes("iii") || normalizedStage.includes("3"))
    return 3;
  if (normalizedStage.includes("ii") || normalizedStage.includes("2")) return 2;
  if (normalizedStage.includes("i") || normalizedStage.includes("1")) return 1;

  return undefined;
}

/**
 * Normalize procedure list to canonical values.
 */
function normalizeProcedureList(procedures: string[]): string[] {
  const mapping: Record<string, string> = {
    "Angioplasty/Stent": "angioplasty_stent",
    "Bypass Surgery (CABG)": "bypass_cabg",
    "Valve Replacement": "valve_replacement",
    Pacemaker: "pacemaker",
    "Defibrillator (ICD)": "defibrillator",
    None: "none",
  };

  return procedures
    .map((p) => mapping[p] ?? p.toLowerCase().replace(/[^a-z]/g, "_"))
    .filter((p) => p !== "");
}

/**
 * Normalize medication list to canonical values.
 */
function normalizeMedicationList(medications: string[]): string[] {
  const mapping: Record<string, string> = {
    "Beta Blocker": "beta_blocker",
    "ACE Inhibitor/ARB": "ace_inhibitor_arb",
    Statin: "statin",
    "Blood Thinner": "blood_thinner",
    Diuretic: "diuretic",
    Nitrate: "nitrate",
    Other: "other",
    None: "none",
  };

  return medications
    .map((m) => mapping[m] ?? m.toLowerCase().replace(/[^a-z]/g, "_"))
    .filter((m) => m !== "");
}

/**
 * Normalize complication list (heart attack).
 */
function normalizeComplicationList(complications: string[]): string[] {
  const mapping: Record<string, string> = {
    "Heart failure": "heart_failure",
    Arrhythmia: "arrhythmia",
    "Cardiogenic shock": "cardiogenic_shock",
    None: "none",
  };

  return complications
    .map((c) => mapping[c] ?? c.toLowerCase().replace(/[^a-z]/g, "_"))
    .filter((c) => c !== "");
}

/**
 * Normalize residual effects (stroke).
 */
function normalizeResidualEffects(effects: string[]): string[] {
  const mapping: Record<string, string> = {
    "Speech difficulty": "speech_difficulty",
    "Paralysis/weakness": "paralysis_weakness",
    "Vision problems": "vision_problems",
    "Cognitive changes": "cognitive_changes",
    None: "none",
  };

  return effects
    .map((e) => mapping[e] ?? e.toLowerCase().replace(/[^a-z]/g, "_"))
    .filter((e) => e !== "");
}

/**
 * Normalize hypertension complications.
 */
function normalizeHypertensionComplications(complications: string[]): string[] {
  const mapping: Record<string, string> = {
    "Heart disease": "heart_disease",
    "Kidney problems": "kidney_problems",
    "Eye problems": "eye_problems",
    None: "none",
  };

  return complications
    .map((c) => mapping[c] ?? c.toLowerCase().replace(/[^a-z]/g, "_"))
    .filter((c) => c !== "");
}
