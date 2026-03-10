// src/features/underwriting/components/RuleEngine/fieldRegistry.ts
// Field definitions and operator registry for the predicate builder

// eslint-disable-next-line no-restricted-imports
import type {
  NumericOperator,
  DateOperator,
  BooleanOperator,
  StringOperator,
  SetOperator,
  ArrayOperator,
  NullOperator,
} from "@/services/underwriting/core/ruleEngineDSL";

// ============================================================================
// Field Type Definitions
// ============================================================================

export type FieldType =
  | "numeric"
  | "date"
  | "boolean"
  | "string"
  | "set"
  | "array"
  | "null_check";

export interface FieldDefinition {
  type: FieldType;
  label: string;
  unit?: string;
  options?: { value: string; label: string }[];
  description?: string;
}

export type AllOperators =
  | NumericOperator
  | DateOperator
  | BooleanOperator
  | StringOperator
  | SetOperator
  | ArrayOperator
  | NullOperator;

// ============================================================================
// Operator Labels
// ============================================================================

export const OPERATOR_LABELS: Record<AllOperators, string> = {
  // Numeric
  eq: "equals",
  neq: "not equals",
  gt: "greater than",
  gte: "greater than or equal",
  lt: "less than",
  lte: "less than or equal",
  between: "between",
  // Date
  years_since_gte: "years since >=",
  years_since_lte: "years since <=",
  months_since_gte: "months since >=",
  months_since_lte: "months since <=",
  // String
  contains: "contains",
  starts_with: "starts with",
  ends_with: "ends with",
  // Set
  in: "in",
  not_in: "not in",
  // Array
  includes_any: "includes any",
  includes_all: "includes all",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  // Null
  is_null: "is null",
  is_not_null: "is not null",
};

// ============================================================================
// Operators by Field Type
// ============================================================================

export const OPERATORS_BY_TYPE: Record<FieldType, AllOperators[]> = {
  numeric: ["eq", "neq", "gt", "gte", "lt", "lte", "between"],
  date: [
    "years_since_gte",
    "years_since_lte",
    "months_since_gte",
    "months_since_lte",
  ],
  boolean: ["eq", "neq"],
  string: ["eq", "neq", "contains", "starts_with", "ends_with"],
  set: ["in", "not_in"],
  array: ["includes_any", "includes_all", "is_empty", "is_not_empty"],
  null_check: ["is_null", "is_not_null"],
};

// ============================================================================
// Client Fields (available for all rules)
// ============================================================================

export const CLIENT_FIELDS: Record<string, FieldDefinition> = {
  "client.age": {
    type: "numeric",
    label: "Age",
    unit: "years",
    description: "Applicant age at time of application",
  },
  "client.gender": {
    type: "set",
    label: "Gender",
    options: [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
    ],
  },
  "client.bmi": {
    type: "numeric",
    label: "BMI",
    description: "Body Mass Index",
  },
  "client.state": {
    type: "string",
    label: "State",
    description: "State of residence (2-letter code)",
  },
  "client.tobacco": {
    type: "boolean",
    label: "Tobacco Use",
    description: "Current tobacco user",
  },
  "medications.hasAny": {
    type: "boolean",
    label: "Any Medications Flagged",
    description: "At least one medication signal was reported",
  },
  "medications.totalSignals": {
    type: "numeric",
    label: "Medication Signal Count",
    description: "Count of medication flags or medication categories reported",
  },
  "medications.classes": {
    type: "array",
    label: "Medication Classes",
    description: "Canonical medication classes derived from the intake step",
    options: [
      { value: "bp_medications", label: "BP Medications" },
      { value: "cholesterol_medications", label: "Cholesterol Medications" },
      { value: "blood_thinners", label: "Blood Thinners" },
      { value: "heart_meds", label: "Heart Medications" },
      { value: "insulin", label: "Insulin" },
      { value: "oral_diabetes_meds", label: "Oral Diabetes Medications" },
      { value: "antidepressants", label: "Antidepressants" },
      { value: "antianxiety", label: "Anti-Anxiety" },
      { value: "antipsychotics", label: "Antipsychotics" },
      { value: "mood_stabilizers", label: "Mood Stabilizers" },
      { value: "sleep_aids", label: "Sleep Aids" },
      { value: "pain_medications", label: "Pain Medications" },
      { value: "otc_pain", label: "OTC Pain" },
      { value: "opioid", label: "Opioid" },
      { value: "prescribed_non_opioid", label: "Rx Non-Opioid" },
      { value: "seizure_meds", label: "Seizure Medications" },
      { value: "migraine_meds", label: "Migraine Medications" },
      { value: "inhalers", label: "Inhalers" },
      { value: "copd_meds", label: "COPD Medications" },
      { value: "thyroid_meds", label: "Thyroid Medications" },
      { value: "hormonal_therapy", label: "Hormonal Therapy" },
      { value: "steroids", label: "Steroids" },
      { value: "immunosuppressants", label: "Immunosuppressants" },
      { value: "biologics", label: "Biologics" },
      { value: "dmards", label: "DMARDs" },
      { value: "cancer_treatment", label: "Cancer Treatment" },
      { value: "antivirals", label: "Antivirals" },
      { value: "adhd_meds", label: "ADHD Medications" },
      { value: "osteoporosis_meds", label: "Osteoporosis Medications" },
      { value: "kidney_meds", label: "Kidney Medications" },
      { value: "liver_meds", label: "Liver Medications" },
    ],
  },
  "medications.bpMedCount": {
    type: "numeric",
    label: "BP Medication Count",
    description: "Number of blood pressure medications reported",
  },
  "medications.cholesterolMedCount": {
    type: "numeric",
    label: "Cholesterol Medication Count",
    description: "Number of cholesterol medications reported",
  },
  "medications.painMedications": {
    type: "set",
    label: "Pain Medication Type",
    options: [
      { value: "none", label: "None" },
      { value: "otc_only", label: "OTC Only" },
      { value: "prescribed_non_opioid", label: "Rx Non-Opioid" },
      { value: "opioid", label: "Opioid" },
    ],
  },
  "medications.opioidUse": {
    type: "boolean",
    label: "Opioid Use",
    description: "Pain medication intake indicates opioid use",
  },
  "medications.highRisk": {
    type: "boolean",
    label: "High-Risk Medication Signal",
    description: "Derived flag for high-impact medication profiles",
  },
  "medications.insulinUse": {
    type: "boolean",
    label: "Insulin Use",
  },
  "medications.bloodThinners": {
    type: "boolean",
    label: "Blood Thinners",
  },
  "medications.heartMeds": {
    type: "boolean",
    label: "Heart Medications",
  },
  "medications.oralDiabetesMeds": {
    type: "boolean",
    label: "Oral Diabetes Medications",
  },
  "medications.antidepressants": {
    type: "boolean",
    label: "Antidepressants",
  },
  "medications.antianxiety": {
    type: "boolean",
    label: "Anti-Anxiety",
  },
  "medications.antipsychotics": {
    type: "boolean",
    label: "Antipsychotics",
  },
  "medications.moodStabilizers": {
    type: "boolean",
    label: "Mood Stabilizers",
  },
  "medications.sleepAids": {
    type: "boolean",
    label: "Sleep Aids",
  },
  "medications.seizureMeds": {
    type: "boolean",
    label: "Seizure Medications",
  },
  "medications.migraineMeds": {
    type: "boolean",
    label: "Migraine Medications",
  },
  "medications.inhalers": {
    type: "boolean",
    label: "Inhalers",
  },
  "medications.copdMeds": {
    type: "boolean",
    label: "COPD Medications",
  },
  "medications.thyroidMeds": {
    type: "boolean",
    label: "Thyroid Medications",
  },
  "medications.hormonalTherapy": {
    type: "boolean",
    label: "Hormonal Therapy",
  },
  "medications.steroids": {
    type: "boolean",
    label: "Steroids",
  },
  "medications.immunosuppressants": {
    type: "boolean",
    label: "Immunosuppressants",
  },
  "medications.biologics": {
    type: "boolean",
    label: "Biologics",
  },
  "medications.dmards": {
    type: "boolean",
    label: "DMARDs",
  },
  "medications.cancerTreatment": {
    type: "boolean",
    label: "Cancer Treatment",
  },
  "medications.antivirals": {
    type: "boolean",
    label: "Antivirals",
  },
  "medications.adhdMeds": {
    type: "boolean",
    label: "ADHD Medications",
  },
  "medications.osteoporosisMeds": {
    type: "boolean",
    label: "Osteoporosis Medications",
  },
  "medications.kidneyMeds": {
    type: "boolean",
    label: "Kidney Medications",
  },
  "medications.liverMeds": {
    type: "boolean",
    label: "Liver Medications",
  },
  // Health conditions array - enables combination and knockout rules
  conditions: {
    type: "array",
    label: "Health Conditions",
    description: "Health conditions the client has disclosed",
    options: [
      // Metabolic
      { value: "diabetes_type_1", label: "Diabetes Type 1" },
      { value: "diabetes_type_2", label: "Diabetes Type 2" },
      { value: "obesity", label: "Obesity" },
      // Cardiovascular
      { value: "hypertension", label: "Hypertension" },
      { value: "heart_disease", label: "Heart Disease" },
      { value: "heart_attack", label: "Heart Attack History" },
      {
        value: "heart_attack_recent",
        label: "Heart Attack (within 12 months)",
      },
      { value: "stroke", label: "Stroke History" },
      { value: "stroke_recent", label: "Stroke (within 12 months)" },
      { value: "atrial_fibrillation", label: "Atrial Fibrillation" },
      // Respiratory
      { value: "copd", label: "COPD" },
      { value: "asthma", label: "Asthma" },
      { value: "sleep_apnea", label: "Sleep Apnea" },
      { value: "oxygen_therapy", label: "Continuous Oxygen Therapy" },
      // Cancer
      { value: "cancer", label: "Cancer (General)" },
      { value: "cancer_remission", label: "Cancer in Remission" },
      { value: "metastatic_cancer", label: "Metastatic Cancer" },
      // Mental Health
      { value: "depression", label: "Depression" },
      { value: "anxiety", label: "Anxiety" },
      { value: "bipolar", label: "Bipolar Disorder" },
      { value: "schizophrenia", label: "Schizophrenia" },
      // Neurological
      { value: "alzheimers", label: "Alzheimer's Disease" },
      { value: "dementia", label: "Dementia" },
      { value: "parkinsons", label: "Parkinson's Disease" },
      { value: "parkinsons_advanced", label: "Advanced Parkinson's Disease" },
      { value: "als", label: "ALS (Lou Gehrig's Disease)" },
      { value: "multiple_sclerosis", label: "Multiple Sclerosis" },
      { value: "epilepsy", label: "Epilepsy" },
      // Kidney/Liver
      { value: "kidney_disease", label: "Kidney Disease" },
      { value: "dialysis", label: "Currently on Dialysis" },
      { value: "liver_disease", label: "Liver Disease" },
      { value: "hepatitis", label: "Hepatitis" },
      // Autoimmune
      { value: "rheumatoid_arthritis", label: "Rheumatoid Arthritis" },
      { value: "lupus", label: "Lupus" },
      { value: "crohns", label: "Crohn's Disease" },
      { value: "ulcerative_colitis", label: "Ulcerative Colitis" },
      // High-Risk / Knockout
      { value: "aids_hiv", label: "AIDS/HIV" },
      { value: "organ_transplant", label: "Organ Transplant History" },
      { value: "organ_transplant_waiting", label: "Awaiting Organ Transplant" },
      { value: "hospice", label: "Hospice Care" },
      { value: "wheelchair_bound", label: "Wheelchair Bound" },
      // Substance Use
      { value: "substance_abuse_history", label: "Substance Abuse History" },
      { value: "substance_abuse_active", label: "Active Substance Abuse" },
      { value: "intravenous_drug_use", label: "IV Drug Use (Current)" },
      { value: "alcohol_abuse", label: "Alcohol Abuse" },
    ],
  },
};

// ============================================================================
// Condition-Specific Fields
// ============================================================================

export const CONDITION_FIELDS: Record<
  string,
  Record<string, FieldDefinition>
> = {
  // Diabetes Type 2
  diabetes_type_2: {
    "diabetes_type_2.a1c": {
      type: "numeric",
      label: "A1C Level",
      unit: "%",
      description: "Most recent A1C reading",
    },
    "diabetes_type_2.diagnosis_date": {
      type: "date",
      label: "Diagnosis Date",
      description: "Date of initial diagnosis",
    },
    "diabetes_type_2.insulin_use": {
      type: "boolean",
      label: "Uses Insulin",
      description: "Currently using insulin",
    },
    "diabetes_type_2.oral_meds_only": {
      type: "boolean",
      label: "Oral Meds Only",
      description: "Controlled with oral medications only",
    },
    "diabetes_type_2.complications": {
      type: "array",
      label: "Complications",
      options: [
        { value: "retinopathy", label: "Retinopathy" },
        { value: "neuropathy", label: "Neuropathy" },
        { value: "nephropathy", label: "Nephropathy" },
        { value: "cardiovascular", label: "Cardiovascular" },
      ],
    },
    "diabetes_type_2.well_controlled": {
      type: "boolean",
      label: "Well Controlled",
      description: "Condition is well controlled",
    },
  },

  // Diabetes Type 1
  diabetes_type_1: {
    "diabetes_type_1.a1c": {
      type: "numeric",
      label: "A1C Level",
      unit: "%",
    },
    "diabetes_type_1.diagnosis_date": {
      type: "date",
      label: "Diagnosis Date",
    },
    "diabetes_type_1.complications": {
      type: "array",
      label: "Complications",
      options: [
        { value: "retinopathy", label: "Retinopathy" },
        { value: "neuropathy", label: "Neuropathy" },
        { value: "nephropathy", label: "Nephropathy" },
        { value: "cardiovascular", label: "Cardiovascular" },
        { value: "dka_episodes", label: "DKA Episodes" },
      ],
    },
    "diabetes_type_1.pump_use": {
      type: "boolean",
      label: "Uses Insulin Pump",
    },
    "diabetes_type_1.cgm_use": {
      type: "boolean",
      label: "Uses CGM",
    },
  },

  // Hypertension
  hypertension: {
    "hypertension.systolic": {
      type: "numeric",
      label: "Systolic BP",
      unit: "mmHg",
      description: "Most recent systolic reading",
    },
    "hypertension.diastolic": {
      type: "numeric",
      label: "Diastolic BP",
      unit: "mmHg",
      description: "Most recent diastolic reading",
    },
    "hypertension.controlled": {
      type: "boolean",
      label: "Controlled",
      description: "BP controlled with treatment",
    },
    "hypertension.medication_count": {
      type: "numeric",
      label: "# of Medications",
      description: "Number of BP medications",
    },
    "hypertension.end_organ_damage": {
      type: "boolean",
      label: "End Organ Damage",
    },
  },

  // Cancer (generic)
  cancer: {
    "cancer.type": {
      type: "string",
      label: "Cancer Type",
    },
    "cancer.stage": {
      type: "set",
      label: "Stage",
      options: [
        { value: "0", label: "Stage 0" },
        { value: "1", label: "Stage I" },
        { value: "2", label: "Stage II" },
        { value: "3", label: "Stage III" },
        { value: "4", label: "Stage IV" },
      ],
    },
    "cancer.diagnosis_date": {
      type: "date",
      label: "Diagnosis Date",
    },
    "cancer.treatment_status": {
      type: "set",
      label: "Treatment Status",
      options: [
        { value: "active", label: "Active Treatment" },
        { value: "remission", label: "In Remission" },
        { value: "completed", label: "Treatment Completed" },
        { value: "watchful_waiting", label: "Watchful Waiting" },
      ],
    },
    "cancer.remission_date": {
      type: "date",
      label: "Remission Date",
    },
    "cancer.metastatic": {
      type: "boolean",
      label: "Metastatic",
    },
  },

  // Heart Disease
  heart_disease: {
    "heart_disease.type": {
      type: "set",
      label: "Type",
      options: [
        { value: "cad", label: "Coronary Artery Disease" },
        { value: "chf", label: "Congestive Heart Failure" },
        { value: "arrhythmia", label: "Arrhythmia" },
        { value: "valve_disease", label: "Valve Disease" },
        { value: "cardiomyopathy", label: "Cardiomyopathy" },
      ],
    },
    "heart_disease.ejection_fraction": {
      type: "numeric",
      label: "Ejection Fraction",
      unit: "%",
    },
    "heart_disease.lvef": {
      type: "numeric",
      label: "LVEF",
      unit: "%",
    },
    "heart_disease.nyha_class": {
      type: "set",
      label: "NYHA Class",
      options: [
        { value: "1", label: "Class I" },
        { value: "2", label: "Class II" },
        { value: "3", label: "Class III" },
        { value: "4", label: "Class IV" },
      ],
    },
    "heart_disease.cabg": {
      type: "boolean",
      label: "Had CABG",
    },
    "heart_disease.stent": {
      type: "boolean",
      label: "Had Stent",
    },
    "heart_disease.last_event_date": {
      type: "date",
      label: "Last Event Date",
    },
  },

  // COPD
  copd: {
    "copd.fev1_percent": {
      type: "numeric",
      label: "FEV1 %",
      unit: "%",
      description: "FEV1 as % of predicted",
    },
    "copd.gold_stage": {
      type: "set",
      label: "GOLD Stage",
      options: [
        { value: "1", label: "Stage 1 (Mild)" },
        { value: "2", label: "Stage 2 (Moderate)" },
        { value: "3", label: "Stage 3 (Severe)" },
        { value: "4", label: "Stage 4 (Very Severe)" },
      ],
    },
    "copd.oxygen_use": {
      type: "boolean",
      label: "Uses Oxygen",
    },
    "copd.hospitalizations_last_year": {
      type: "numeric",
      label: "Hospitalizations/Year",
    },
  },

  // Sleep Apnea
  sleep_apnea: {
    "sleep_apnea.ahi": {
      type: "numeric",
      label: "AHI",
      description: "Apnea-Hypopnea Index",
    },
    "sleep_apnea.severity": {
      type: "set",
      label: "Severity",
      options: [
        { value: "mild", label: "Mild (5-14)" },
        { value: "moderate", label: "Moderate (15-29)" },
        { value: "severe", label: "Severe (30+)" },
      ],
    },
    "sleep_apnea.cpap_compliant": {
      type: "boolean",
      label: "CPAP Compliant",
    },
    "sleep_apnea.treatment": {
      type: "set",
      label: "Treatment",
      options: [
        { value: "cpap", label: "CPAP" },
        { value: "bipap", label: "BiPAP" },
        { value: "oral_appliance", label: "Oral Appliance" },
        { value: "none", label: "No Treatment" },
      ],
    },
  },

  // Depression
  depression: {
    "depression.severity": {
      type: "set",
      label: "Severity",
      options: [
        { value: "mild", label: "Mild" },
        { value: "moderate", label: "Moderate" },
        { value: "severe", label: "Severe" },
      ],
    },
    "depression.hospitalizations": {
      type: "numeric",
      label: "Hospitalizations",
      description: "Total psychiatric hospitalizations",
    },
    "depression.suicide_attempt": {
      type: "boolean",
      label: "Suicide Attempt History",
    },
    "depression.stable_on_meds": {
      type: "boolean",
      label: "Stable on Medications",
    },
    "depression.working": {
      type: "boolean",
      label: "Currently Working",
    },
  },

  // Anxiety
  anxiety: {
    "anxiety.severity": {
      type: "set",
      label: "Severity",
      options: [
        { value: "mild", label: "Mild" },
        { value: "moderate", label: "Moderate" },
        { value: "severe", label: "Severe" },
      ],
    },
    "anxiety.panic_attacks": {
      type: "boolean",
      label: "Panic Attacks",
    },
    "anxiety.stable_on_meds": {
      type: "boolean",
      label: "Stable on Medications",
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all available fields for a given condition code
 */
export function getFieldsForCondition(
  conditionCode: string,
): Record<string, FieldDefinition> {
  return CONDITION_FIELDS[conditionCode] ?? {};
}

/**
 * Get all client fields
 */
export function getClientFields(): Record<string, FieldDefinition> {
  return CLIENT_FIELDS;
}

/**
 * Get all fields (client + condition-specific)
 */
export function getAllFields(
  conditionCode?: string,
): Record<string, FieldDefinition> {
  const fields = { ...CLIENT_FIELDS };
  if (conditionCode && CONDITION_FIELDS[conditionCode]) {
    Object.assign(fields, CONDITION_FIELDS[conditionCode]);
  }
  return fields;
}

/**
 * Get operators for a field type
 */
export function getOperatorsForType(type: FieldType): AllOperators[] {
  return OPERATORS_BY_TYPE[type] ?? [];
}

/**
 * Get operator label
 */
export function getOperatorLabel(operator: AllOperators): string {
  return OPERATOR_LABELS[operator] ?? operator;
}

/**
 * Get field definition by path
 */
export function getFieldDefinition(
  fieldPath: string,
): FieldDefinition | undefined {
  // Check client fields first
  if (CLIENT_FIELDS[fieldPath]) {
    return CLIENT_FIELDS[fieldPath];
  }

  // Check condition fields
  const conditionCode = fieldPath.split(".")[0];
  if (CONDITION_FIELDS[conditionCode]?.[fieldPath]) {
    return CONDITION_FIELDS[conditionCode][fieldPath];
  }

  return undefined;
}

/**
 * Get all condition codes that have fields defined
 */
export function getAvailableConditionCodes(): string[] {
  return Object.keys(CONDITION_FIELDS);
}

/**
 * Group fields by category for UI display
 */
export function getFieldsByCategory(conditionCode?: string): {
  client: Record<string, FieldDefinition>;
  condition: Record<string, FieldDefinition>;
} {
  return {
    client: CLIENT_FIELDS,
    condition: conditionCode ? (CONDITION_FIELDS[conditionCode] ?? {}) : {},
  };
}
