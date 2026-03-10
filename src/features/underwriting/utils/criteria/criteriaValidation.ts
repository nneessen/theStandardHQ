// src/features/underwriting/utils/criteriaValidation.ts
// Zod schemas and safe parsing utilities for JSONB criteria data

import { z } from "zod";
import type {
  ExtractedCriteria,
  SourceExcerpt,
} from "../../types/underwriting.types";

/**
 * Schema for age-based tier limits
 */
const ageTierSchema = z.object({
  minAge: z.number(),
  maxAge: z.number(),
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
  minimum: z.number(),
  maximum: z.number(),
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
  requiresCleanMonths: z.number(),
});

/**
 * Schema for tobacco rules
 */
const tobaccoRulesSchema = z.object({
  smokingClassifications: z.array(smokingClassificationSchema),
  nicotineTestRequired: z.boolean(),
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

  const result = extractedCriteriaSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data as ExtractedCriteria };
  }

  // Log validation errors for debugging
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  console.warn("Criteria validation failed:", errors);

  // Return partial data - cast the original object but exclude invalid fields
  // This allows the UI to still show valid fields
  const partialData: ExtractedCriteria = {};
  const rawData = data as Record<string, unknown>;

  // Validate each field individually and include only valid ones
  if (
    rawData.ageLimits &&
    ageLimitsSchema.safeParse(rawData.ageLimits).success
  ) {
    partialData.ageLimits = rawData.ageLimits as ExtractedCriteria["ageLimits"];
  }
  if (
    rawData.faceAmountLimits &&
    faceAmountLimitsSchema.safeParse(rawData.faceAmountLimits).success
  ) {
    partialData.faceAmountLimits =
      rawData.faceAmountLimits as ExtractedCriteria["faceAmountLimits"];
  }
  if (
    rawData.knockoutConditions &&
    knockoutConditionsSchema.safeParse(rawData.knockoutConditions).success
  ) {
    partialData.knockoutConditions =
      rawData.knockoutConditions as ExtractedCriteria["knockoutConditions"];
  }
  if (
    rawData.buildRequirements &&
    buildRequirementsSchema.safeParse(rawData.buildRequirements).success
  ) {
    partialData.buildRequirements =
      rawData.buildRequirements as ExtractedCriteria["buildRequirements"];
  }
  if (
    rawData.tobaccoRules &&
    tobaccoRulesSchema.safeParse(rawData.tobaccoRules).success
  ) {
    partialData.tobaccoRules =
      rawData.tobaccoRules as ExtractedCriteria["tobaccoRules"];
  }
  if (
    rawData.medicationRestrictions &&
    medicationRestrictionsSchema.safeParse(rawData.medicationRestrictions)
      .success
  ) {
    partialData.medicationRestrictions =
      rawData.medicationRestrictions as ExtractedCriteria["medicationRestrictions"];
  }
  if (
    rawData.stateAvailability &&
    stateAvailabilitySchema.safeParse(rawData.stateAvailability).success
  ) {
    partialData.stateAvailability =
      rawData.stateAvailability as ExtractedCriteria["stateAvailability"];
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
