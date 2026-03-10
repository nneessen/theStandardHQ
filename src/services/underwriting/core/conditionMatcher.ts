// src/services/underwriting/conditionMatcher.ts
// =============================================================================
// Condition Matcher Service
// =============================================================================
// Evaluates condition responses against acceptance rules with field requirements.
// Uses Zod for DSL validation to prevent malformed rules from crashing.
// =============================================================================

import { z } from "zod";
import type { Database } from "@/types/database.types.ts";

// =============================================================================
// DSL Schema Definitions (Versioned)
// =============================================================================

/**
 * Valid operators for field requirements
 */
export const FieldOperatorSchema = z.enum([
  "eq", // Equal
  "neq", // Not equal
  "gt", // Greater than
  "gte", // Greater than or equal
  "lt", // Less than
  "lte", // Less than or equal
  "between", // Between two values (inclusive)
  "contains_any", // Array contains any of the values
  "not_contains", // Array does not contain any of the values
]);

export type FieldOperator = z.infer<typeof FieldOperatorSchema>;

/**
 * How to handle null/undefined values
 */
export const NullHandlerSchema = z.enum([
  "fail", // Treat as failed requirement (default)
  "skip", // Skip this requirement entirely
  "default", // Use defaultValue if provided
]);

export type NullHandler = z.infer<typeof NullHandlerSchema>;

/**
 * A single field requirement
 */
export const FieldRequirementSchema = z.object({
  operator: FieldOperatorSchema,
  value: z.unknown(),
  treatNullAs: NullHandlerSchema.optional().default("fail"),
  defaultValue: z.unknown().optional(),
  reason: z.string().optional(), // Human-readable reason for this requirement
});

export type FieldRequirement = z.infer<typeof FieldRequirementSchema>;

/**
 * Full field requirements object (field_id -> requirement)
 */
export const FieldRequirementsSchema = z.record(
  z.string(),
  FieldRequirementSchema,
);

export type FieldRequirements = z.infer<typeof FieldRequirementsSchema>;

/**
 * Versioned rule DSL wrapper
 */
export const RuleDSLV1Schema = z.object({
  schemaVersion: z.literal(1),
  requirements: FieldRequirementsSchema,
});

export type RuleDSLV1 = z.infer<typeof RuleDSLV1Schema>;

// =============================================================================
// Match Result Types
// =============================================================================

/**
 * Result of evaluating a single field requirement
 */
export interface FieldMatchResult {
  field: string;
  matched: boolean;
  reason?: string;
  actualValue?: unknown;
  expectedValue?: unknown;
  operator?: FieldOperator;
}

/**
 * Result of evaluating all field requirements against responses
 */
export interface MatchResult {
  /** Whether all requirements were met */
  matches: boolean;
  /** Fields that are missing and needed */
  missingFields: string[];
  /** Requirements that were successfully matched */
  matchedRequirements: FieldMatchResult[];
  /** Requirements that failed */
  failedRequirements: FieldMatchResult[];
  /** DSL parsing/validation errors */
  validationErrors: string[];
}

// =============================================================================
// Carrier Condition Acceptance Type
// =============================================================================

// Type from database (includes provenance and field requirement columns from migrations)
type CarrierConditionAcceptance =
  Database["public"]["Tables"]["carrier_condition_acceptance"]["Row"];

// =============================================================================
// Evaluation Logic
// =============================================================================

/**
 * Evaluates a single field requirement against a value
 */
function evaluateRequirement(
  value: unknown,
  requirement: FieldRequirement,
): boolean {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    switch (requirement.treatNullAs) {
      case "skip":
        return true; // Skip means we don't fail on this
      case "default":
        value = requirement.defaultValue;
        if (value === null || value === undefined) {
          return false; // No default provided, fail
        }
        break;
      case "fail":
      default:
        return false;
    }
  }

  const expected = requirement.value;

  switch (requirement.operator) {
    case "eq":
      return value === expected;

    case "neq":
      return value !== expected;

    case "gt":
      if (typeof value !== "number" || typeof expected !== "number") {
        return false;
      }
      return value > expected;

    case "gte":
      if (typeof value !== "number" || typeof expected !== "number") {
        return false;
      }
      return value >= expected;

    case "lt":
      if (typeof value !== "number" || typeof expected !== "number") {
        return false;
      }
      return value < expected;

    case "lte":
      if (typeof value !== "number" || typeof expected !== "number") {
        return false;
      }
      return value <= expected;

    case "between": {
      if (typeof value !== "number") {
        return false;
      }
      if (!Array.isArray(expected) || expected.length !== 2) {
        return false;
      }
      const [min, max] = expected as [number, number];
      return value >= min && value <= max;
    }

    case "contains_any":
      if (!Array.isArray(value) || !Array.isArray(expected)) {
        return false;
      }
      return value.some((v) => (expected as unknown[]).includes(v));

    case "not_contains":
      if (!Array.isArray(value) || !Array.isArray(expected)) {
        return false;
      }
      return !value.some((v) => (expected as unknown[]).includes(v));

    default:
      return false;
  }
}

/**
 * Parses and validates field requirements from a rule's JSONB
 */
export function parseFieldRequirements(raw: unknown): {
  requirements: FieldRequirements;
  errors: string[];
} {
  // Handle null/undefined
  if (raw === null || raw === undefined) {
    return { requirements: {}, errors: [] };
  }

  // Handle empty object
  if (typeof raw === "object" && Object.keys(raw as object).length === 0) {
    return { requirements: {}, errors: [] };
  }

  // Try to parse as versioned DSL first
  const versionedResult = RuleDSLV1Schema.safeParse(raw);
  if (versionedResult.success) {
    return { requirements: versionedResult.data.requirements, errors: [] };
  }

  // Fall back to unversioned format (legacy compatibility)
  const unversionedResult = FieldRequirementsSchema.safeParse(raw);
  if (unversionedResult.success) {
    return { requirements: unversionedResult.data, errors: [] };
  }

  // Return validation errors
  return {
    requirements: {},
    errors: unversionedResult.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`,
    ),
  };
}

/**
 * Evaluates condition responses against a carrier acceptance rule
 */
export function evaluateConditionAgainstRule(
  responses: Record<string, unknown>,
  rule: CarrierConditionAcceptance,
): MatchResult {
  const result: MatchResult = {
    matches: false,
    missingFields: [],
    matchedRequirements: [],
    failedRequirements: [],
    validationErrors: [],
  };

  // Parse required_fields (array of field IDs)
  const requiredFields: string[] = Array.isArray(rule.required_fields)
    ? (rule.required_fields as string[])
    : [];

  // Check for missing required fields
  for (const field of requiredFields) {
    if (responses[field] === undefined || responses[field] === null) {
      result.missingFields.push(field);
    }
  }

  // If missing required fields, we can't fully evaluate
  if (result.missingFields.length > 0) {
    return result;
  }

  // Parse and validate field requirements
  const { requirements, errors } = parseFieldRequirements(
    rule.field_requirements,
  );

  if (errors.length > 0) {
    result.validationErrors = errors;
    return result;
  }

  // Evaluate each field requirement
  for (const [field, requirement] of Object.entries(requirements)) {
    const value = responses[field];
    const matched = evaluateRequirement(value, requirement);

    const fieldResult: FieldMatchResult = {
      field,
      matched,
      actualValue: value,
      expectedValue: requirement.value,
      operator: requirement.operator,
      reason: requirement.reason,
    };

    if (matched) {
      result.matchedRequirements.push(fieldResult);
    } else {
      result.failedRequirements.push(fieldResult);
    }
  }

  // All requirements must pass
  result.matches = result.failedRequirements.length === 0;

  return result;
}

/**
 * Calculates data completeness score based on required vs answered fields
 */
export function calculateDataCompleteness(
  responses: Record<string, unknown>,
  requiredFields: string[],
): { complete: boolean; confidence: number; missingFields: string[] } {
  if (requiredFields.length === 0) {
    return { complete: true, confidence: 1, missingFields: [] };
  }

  const missingFields: string[] = [];

  for (const field of requiredFields) {
    const value = responses[field];
    if (value === undefined || value === null || value === "") {
      missingFields.push(field);
    }
  }

  const answered = requiredFields.length - missingFields.length;
  const confidence = answered / requiredFields.length;

  return {
    complete: missingFields.length === 0,
    confidence,
    missingFields,
  };
}

/**
 * Gets all acceptance key fields for a condition
 * (used to determine which responses are needed for acceptance evaluation)
 */
export function getAcceptanceKeyFields(
  _conditionCode: string,
  followUpSchema: unknown,
): string[] {
  // If the schema has questions, extract IDs of questions marked as acceptance_key
  if (
    followUpSchema &&
    typeof followUpSchema === "object" &&
    "questions" in followUpSchema
  ) {
    const questions = (followUpSchema as { questions: unknown[] }).questions;
    return questions
      .filter(
        (q): q is { id: string; acceptance_key?: boolean } =>
          typeof q === "object" &&
          q !== null &&
          "id" in q &&
          typeof (q as { id: unknown }).id === "string" &&
          (q as { acceptance_key?: boolean }).acceptance_key === true,
      )
      .map((q) => q.id);
  }

  return [];
}
