// src/features/underwriting/utils/criteriaValidation.ts
// Zod schemas and safe parsing utilities for JSONB criteria data

import { z } from "zod";
import type {
  ExtractedCriteria,
  SourceExcerpt,
} from "../../types/underwriting.types";

// ─── Null coercion ───────────────────────────────────────────────────────────
// AI extraction returns `null` for "not found" fields, but Zod's `.optional()`
// only accepts `undefined`. Recursively coerce null → undefined before parsing.

function deepCoerceNulls(obj: unknown): unknown {
  if (obj === null) return undefined;
  if (Array.isArray(obj)) return obj.map(deepCoerceNulls);
  if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, deepCoerceNulls(v)]),
    );
  }
  return obj;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
// Inner leaf fields use `.optional()` where the AI may return null (coerced to
// undefined by deepCoerceNulls). Top-level fields already use `.optional()`.

/**
 * Schema for age-based tier limits
 */
const ageTierSchema = z.object({
  minAge: z.number().optional(),
  maxAge: z.number().optional(),
  maxFaceAmount: z.number(),
});

/**
 * Schema for age limits
 */
const ageLimitsSchema = z.object({
  minIssueAge: z.number(),
  maxIssueAge: z.number(),
});

/**
 * Schema for face amount limits
 */
const faceAmountLimitsSchema = z.object({
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  ageTiers: z.array(ageTierSchema).optional(),
});

/**
 * Schema for knockout condition descriptions
 */
const knockoutDescriptionSchema = z.object({
  code: z.string(),
  name: z.string(),
  severity: z.string(),
});

/**
 * Schema for knockout conditions
 */
const knockoutConditionsSchema = z.object({
  conditionCodes: z.array(z.string()),
  descriptions: z.array(knockoutDescriptionSchema),
});

/**
 * Schema for build requirements
 */
const buildRequirementsSchema = z.object({
  type: z.enum(["height_weight", "bmi"]),
  preferredPlusBmiMax: z.number().optional(),
  preferredBmiMax: z.number().optional(),
  standardBmiMax: z.number().optional(),
});

/**
 * Schema for smoking classifications
 */
const smokingClassificationSchema = z.object({
  classification: z.string(),
  requiresCleanMonths: z.number().optional(),
});

/**
 * Schema for tobacco rules
 */
const tobaccoRulesSchema = z.object({
  smokingClassifications: z.array(smokingClassificationSchema),
  nicotineTestRequired: z.boolean().optional(),
});

/**
 * Schema for medication restrictions
 */
const medicationRestrictionsSchema = z.object({
  insulin: z
    .object({
      allowed: z.boolean(),
      ratingImpact: z.string().optional(),
    })
    .optional(),
  bloodThinners: z
    .object({
      allowed: z.boolean(),
    })
    .optional(),
  opioids: z
    .object({
      allowed: z.boolean(),
      timeSinceUse: z.number().optional(),
    })
    .optional(),
  bpMedications: z
    .object({
      maxCount: z.number(),
    })
    .optional(),
  antidepressants: z
    .object({
      allowed: z.boolean(),
    })
    .optional(),
});

/**
 * Schema for state availability
 */
const stateAvailabilitySchema = z.object({
  availableStates: z.array(z.string()),
  unavailableStates: z.array(z.string()),
});

/**
 * Complete schema for extracted criteria
 */
export const extractedCriteriaSchema = z.object({
  ageLimits: ageLimitsSchema.optional(),
  faceAmountLimits: faceAmountLimitsSchema.optional(),
  knockoutConditions: knockoutConditionsSchema.optional(),
  buildRequirements: buildRequirementsSchema.optional(),
  tobaccoRules: tobaccoRulesSchema.optional(),
  medicationRestrictions: medicationRestrictionsSchema.optional(),
  stateAvailability: stateAvailabilitySchema.optional(),
});

/**
 * Schema for source excerpts
 */
export const sourceExcerptSchema = z.object({
  field: z.string(),
  excerpt: z.string(),
  pageNumber: z.number().optional(),
});

export const sourceExcerptsArraySchema = z.array(sourceExcerptSchema);

/**
 * Result type for safe parsing
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; data: T; errors: string[] };

/**
 * Safely parse extracted criteria from JSONB
 * Returns a default empty object if parsing fails, with error details
 */
export function parseExtractedCriteria(
  data: unknown,
): ParseResult<ExtractedCriteria> {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return { success: true, data: {} };
  }

  // Handle non-object types
  if (typeof data !== "object") {
    return {
      success: false,
      data: {},
      errors: [`Expected object, got ${typeof data}`],
    };
  }

  // Coerce null → undefined throughout: AI extraction returns null for "not found"
  // but Zod's .optional() only accepts undefined.
  const coerced = deepCoerceNulls(data) as Record<string, unknown>;

  const result = extractedCriteriaSchema.safeParse(coerced);

  if (result.success) {
    return { success: true, data: result.data as ExtractedCriteria };
  }

  // Log validation errors for debugging
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  console.warn("Criteria validation failed:", errors);

  // Return partial data - validate each field individually and include only valid ones
  const partialData: ExtractedCriteria = {};

  if (
    coerced.ageLimits &&
    ageLimitsSchema.safeParse(coerced.ageLimits).success
  ) {
    partialData.ageLimits = coerced.ageLimits as ExtractedCriteria["ageLimits"];
  }
  if (
    coerced.faceAmountLimits &&
    faceAmountLimitsSchema.safeParse(coerced.faceAmountLimits).success
  ) {
    partialData.faceAmountLimits =
      coerced.faceAmountLimits as ExtractedCriteria["faceAmountLimits"];
  }
  if (
    coerced.knockoutConditions &&
    knockoutConditionsSchema.safeParse(coerced.knockoutConditions).success
  ) {
    partialData.knockoutConditions =
      coerced.knockoutConditions as ExtractedCriteria["knockoutConditions"];
  }
  if (
    coerced.buildRequirements &&
    buildRequirementsSchema.safeParse(coerced.buildRequirements).success
  ) {
    partialData.buildRequirements =
      coerced.buildRequirements as ExtractedCriteria["buildRequirements"];
  }
  if (
    coerced.tobaccoRules &&
    tobaccoRulesSchema.safeParse(coerced.tobaccoRules).success
  ) {
    partialData.tobaccoRules =
      coerced.tobaccoRules as ExtractedCriteria["tobaccoRules"];
  }
  if (
    coerced.medicationRestrictions &&
    medicationRestrictionsSchema.safeParse(coerced.medicationRestrictions)
      .success
  ) {
    partialData.medicationRestrictions =
      coerced.medicationRestrictions as ExtractedCriteria["medicationRestrictions"];
  }
  if (
    coerced.stateAvailability &&
    stateAvailabilitySchema.safeParse(coerced.stateAvailability).success
  ) {
    partialData.stateAvailability =
      coerced.stateAvailability as ExtractedCriteria["stateAvailability"];
  }

  return { success: false, data: partialData, errors };
}

/**
 * Safely parse source excerpts from JSONB
 */
export function parseSourceExcerpts(
  data: unknown,
): ParseResult<SourceExcerpt[]> {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return { success: true, data: [] };
  }

  // Handle non-array types
  if (!Array.isArray(data)) {
    return {
      success: false,
      data: [],
      errors: [`Expected array, got ${typeof data}`],
    };
  }

  const result = sourceExcerptsArraySchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data as SourceExcerpt[] };
  }

  // Log validation errors
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  console.warn("Source excerpts validation failed:", errors);

  // Filter to only valid excerpts
  const validExcerpts: SourceExcerpt[] = [];
  for (const item of data) {
    const itemResult = sourceExcerptSchema.safeParse(item);
    if (itemResult.success) {
      validExcerpts.push(itemResult.data as SourceExcerpt);
    }
  }

  return { success: false, data: validExcerpts, errors };
}

/**
 * Validate criteria before saving to database
 * Returns the validated data or throws an error
 */
export function validateCriteriaForSave(data: unknown): ExtractedCriteria {
  const result = extractedCriteriaSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid criteria data: ${errors.join("; ")}`);
  }

  return result.data as ExtractedCriteria;
}
