// src/features/underwriting/utils/ruleUtils.ts

import type {
  ConditionField,
  ConditionOperator,
} from "../../types/underwriting.types";

/**
 * Operator configuration for rule conditions
 */
export interface OperatorOption {
  value: ConditionOperator;
  label: string;
}

/**
 * Numeric operators for age, BMI, face amount fields
 */
export const NUMERIC_OPERATORS: OperatorOption[] = [
  { value: "==", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: ">", label: "greater than" },
  { value: "<", label: "less than" },
  { value: ">=", label: "≥" },
  { value: "<=", label: "≤" },
];

/**
 * String operators for gender, health_tier, state, condition_present fields
 */
export const STRING_OPERATORS: OperatorOption[] = [
  { value: "==", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: "in", label: "in list" },
  { value: "not_in", label: "not in list" },
];

/**
 * Boolean operators for tobacco field
 */
export const BOOLEAN_OPERATORS: OperatorOption[] = [
  { value: "==", label: "equals" },
];

/**
 * Get the appropriate operators for a given condition field
 * @param field - The condition field type
 * @returns Array of operator options valid for this field
 */
export function getOperatorsForField(field: ConditionField): OperatorOption[] {
  switch (field) {
    case "age":
    case "bmi":
    case "face_amount":
    case "bp_med_count":
    case "cholesterol_med_count":
      return NUMERIC_OPERATORS;
    case "tobacco":
    case "insulin_use":
    case "blood_thinners":
    case "antidepressants":
      return BOOLEAN_OPERATORS;
    case "gender":
    case "health_tier":
    case "state":
    case "condition_present":
    case "pain_medications":
      return STRING_OPERATORS;
    default:
      return NUMERIC_OPERATORS;
  }
}

/**
 * Validation constraints for numeric fields
 */
export const FIELD_CONSTRAINTS = {
  age: { min: 0, max: 120, step: 1, default: 18 },
  bmi: { min: 10, max: 60, step: 0.1, default: 25 },
  face_amount: { min: 0, max: 100000000, step: 10000, default: 100000 },
} as const;

/**
 * Validate a numeric value for a given field
 * @param field - The condition field type
 * @param value - The value to validate
 * @returns Object with isValid boolean and sanitized value
 */
export function validateNumericValue(
  field: "age" | "bmi" | "face_amount",
  value: string | number,
): { isValid: boolean; value: number; error?: string } {
  const constraints = FIELD_CONSTRAINTS[field];
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  // Check for NaN
  if (isNaN(numValue)) {
    return {
      isValid: false,
      value: constraints.default,
      error: "Please enter a valid number",
    };
  }

  // Check min bound
  if (numValue < constraints.min) {
    return {
      isValid: false,
      value: constraints.min,
      error: `Minimum value is ${constraints.min}`,
    };
  }

  // Check max bound
  if (numValue > constraints.max) {
    return {
      isValid: false,
      value: constraints.max,
      error: `Maximum value is ${constraints.max}`,
    };
  }

  return { isValid: true, value: numValue };
}

/**
 * Sanitize text input by removing potentially harmful characters
 * @param input - The text to sanitize
 * @returns Sanitized text
 */
export function sanitizeTextInput(input: string): string {
  // Remove control characters and limit length
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, "") // Remove control characters
      .trim()
      .slice(0, 1000)
  ); // Limit length
}

/**
 * Get the default value for a condition field when it changes
 * @param field - The new condition field type
 * @returns The default value for this field type
 */
export function getDefaultValueForField(
  field: ConditionField,
): string | number | boolean {
  switch (field) {
    case "age":
      return FIELD_CONSTRAINTS.age.default;
    case "bmi":
      return FIELD_CONSTRAINTS.bmi.default;
    case "face_amount":
      return FIELD_CONSTRAINTS.face_amount.default;
    case "tobacco":
    case "insulin_use":
    case "blood_thinners":
    case "antidepressants":
      return true;
    case "health_tier":
      return "standard";
    case "gender":
      return "male";
    case "state":
      return "";
    case "condition_present":
      return "";
    case "bp_med_count":
    case "cholesterol_med_count":
      return 1;
    case "pain_medications":
      return "none";
    default:
      return "";
  }
}
