/**
 * Underwriting Rule Engine DSL v2
 *
 * Strongly typed predicate language for underwriting rules.
 * Supports compound logic (all/any/not), typed operators, and
 * proper unknown propagation.
 */

import { z } from "zod";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const TABLE_RATINGS = [
  "none",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
] as const;

export const HEALTH_CLASSES = [
  "preferred_plus",
  "preferred",
  "standard_plus",
  "standard",
  "substandard",
  "graded",
  "modified",
  "guaranteed_issue",
  "refer",
  "decline",
  "unknown",
] as const;

export const ELIGIBILITY_STATUSES = [
  "eligible",
  "ineligible",
  "refer",
] as const;

export const RULE_SET_SCOPES = ["condition", "global"] as const;

export const REVIEW_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
] as const;

// Health class rank mapping (higher = worse)
export const HEALTH_CLASS_RANK: Record<
  (typeof HEALTH_CLASSES)[number],
  number
> = {
  preferred_plus: 1,
  preferred: 2,
  standard_plus: 3,
  standard: 4,
  substandard: 5,
  graded: 6,
  modified: 7,
  guaranteed_issue: 8,
  refer: 9,
  unknown: 10,
  decline: 11,
};

// Table rating to units mapping
export const TABLE_RATING_UNITS: Record<
  (typeof TABLE_RATINGS)[number],
  number
> = {
  none: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  I: 9,
  J: 10,
  K: 11,
  L: 12,
  M: 13,
  N: 14,
  O: 15,
  P: 16,
};

// =============================================================================
// TYPE SCHEMAS
// =============================================================================

export const TableRatingSchema = z.enum(TABLE_RATINGS);
export const HealthClassSchema = z.enum(HEALTH_CLASSES);
export const EligibilityStatusSchema = z.enum(ELIGIBILITY_STATUSES);
export const RuleSetScopeSchema = z.enum(RULE_SET_SCOPES);
export const ReviewStatusSchema = z.enum(REVIEW_STATUSES);

export type TableRating = z.infer<typeof TableRatingSchema>;
export type HealthClass = z.infer<typeof HealthClassSchema>;
export type EligibilityStatus = z.infer<typeof EligibilityStatusSchema>;
export type RuleSetScope = z.infer<typeof RuleSetScopeSchema>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

// =============================================================================
// PREDICATE DSL v2 SCHEMAS
// =============================================================================

// Null handling strategy
export const NullHandlerSchema = z.enum(["fail", "unknown"]).default("unknown");
export type NullHandler = z.infer<typeof NullHandlerSchema>;

// Numeric operators
export const NumericOperatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
]);
export type NumericOperator = z.infer<typeof NumericOperatorSchema>;

// Set operators (for enums, arrays of allowed values)
export const SetOperatorSchema = z.enum(["in", "not_in"]);
export type SetOperator = z.infer<typeof SetOperatorSchema>;

// Array operators (for checking array contents)
export const ArrayOperatorSchema = z.enum([
  "includes_any",
  "includes_all",
  "is_empty",
  "is_not_empty",
]);
export type ArrayOperator = z.infer<typeof ArrayOperatorSchema>;

// String operators
export const StringOperatorSchema = z.enum([
  "eq",
  "neq",
  "contains",
  "starts_with",
  "ends_with",
]);
export type StringOperator = z.infer<typeof StringOperatorSchema>;

// Boolean operators
export const BooleanOperatorSchema = z.enum(["eq", "neq"]);
export type BooleanOperator = z.infer<typeof BooleanOperatorSchema>;

// Date operators (calculate time since date)
export const DateOperatorSchema = z.enum([
  "years_since_gte",
  "years_since_lte",
  "months_since_gte",
  "months_since_lte",
]);
export type DateOperator = z.infer<typeof DateOperatorSchema>;

// Null check operators
export const NullOperatorSchema = z.enum(["is_null", "is_not_null"]);
export type NullOperator = z.infer<typeof NullOperatorSchema>;

// =============================================================================
// FIELD CONDITION SCHEMAS (discriminated by type)
// =============================================================================

// Base fields common to all conditions
const BaseConditionSchema = z.object({
  field: z.string().min(1),
  treatNullAs: NullHandlerSchema.optional(),
});

// Numeric condition (e.g., a1c <= 7.0, age between [40, 60])
// Note: Runtime validation checks between operator has tuple value
export const NumericConditionSchema = BaseConditionSchema.extend({
  type: z.literal("numeric"),
  operator: NumericOperatorSchema,
  value: z.union([
    z.number(),
    z.tuple([z.number(), z.number()]), // For 'between' operator
  ]),
});

// Date condition (e.g., years_since_gte diagnosis_date 5)
export const DateConditionSchema = BaseConditionSchema.extend({
  type: z.literal("date"),
  operator: DateOperatorSchema,
  value: z.number().int().nonnegative(),
});

// Array condition (e.g., complications includes_any ['retinopathy', 'neuropathy'])
// Note: Runtime validation checks includes_any/all have non-empty value
export const ArrayConditionSchema = BaseConditionSchema.extend({
  type: z.literal("array"),
  operator: ArrayOperatorSchema,
  value: z.array(z.string()).optional(),
});

// Boolean condition (e.g., insulin_use eq false)
export const BooleanConditionSchema = BaseConditionSchema.extend({
  type: z.literal("boolean"),
  operator: BooleanOperatorSchema,
  value: z.boolean(),
});

// String condition (e.g., treatment_status eq 'remission')
export const StringConditionSchema = BaseConditionSchema.extend({
  type: z.literal("string"),
  operator: StringOperatorSchema,
  value: z.string(),
});

// Set membership condition (e.g., cancer_stage in ['1', '2'])
export const SetConditionSchema = BaseConditionSchema.extend({
  type: z.literal("set"),
  operator: SetOperatorSchema,
  value: z.array(z.union([z.string(), z.number()])),
});

// Null check condition (e.g., remission_date is_not_null)
export const NullCheckConditionSchema = BaseConditionSchema.extend({
  type: z.literal("null_check"),
  operator: NullOperatorSchema,
});

// Condition presence check (for global rules checking which conditions are present)
export const ConditionPresenceSchema = z.object({
  type: z.literal("condition_presence"),
  field: z.literal("conditions"),
  operator: z.enum(["includes_any", "includes_all"]),
  value: z.array(z.string()).min(1),
});

// Union of all field conditions
export const FieldConditionSchema = z.discriminatedUnion("type", [
  NumericConditionSchema,
  DateConditionSchema,
  ArrayConditionSchema,
  BooleanConditionSchema,
  StringConditionSchema,
  SetConditionSchema,
  NullCheckConditionSchema,
  ConditionPresenceSchema,
]);

export type FieldCondition = z.infer<typeof FieldConditionSchema>;
export type NumericCondition = z.infer<typeof NumericConditionSchema>;
export type DateCondition = z.infer<typeof DateConditionSchema>;
export type ArrayCondition = z.infer<typeof ArrayConditionSchema>;
export type BooleanCondition = z.infer<typeof BooleanConditionSchema>;
export type StringCondition = z.infer<typeof StringConditionSchema>;
export type SetCondition = z.infer<typeof SetConditionSchema>;
export type NullCheckCondition = z.infer<typeof NullCheckConditionSchema>;
export type ConditionPresence = z.infer<typeof ConditionPresenceSchema>;

// =============================================================================
// PREDICATE GROUP SCHEMA (recursive)
// =============================================================================

// Forward declaration for recursive type
export type PredicateGroup = {
  all?: (FieldCondition | PredicateGroup)[];
  any?: (FieldCondition | PredicateGroup)[];
  not?: FieldCondition | PredicateGroup;
};

// Helper to check if something is a field condition (exported for evaluation engine)
export function isFieldCondition(item: unknown): item is FieldCondition {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    "field" in item
  );
}

// Lazy schema for recursive predicate groups
export const PredicateGroupSchema: z.ZodType<PredicateGroup> = z.lazy(() =>
  z
    .object({
      all: z
        .array(z.union([FieldConditionSchema, PredicateGroupSchema]))
        .optional(),
      any: z
        .array(z.union([FieldConditionSchema, PredicateGroupSchema]))
        .optional(),
      not: z.union([FieldConditionSchema, PredicateGroupSchema]).optional(),
    })
    .refine(
      (data) => {
        const count =
          (data.all ? 1 : 0) + (data.any ? 1 : 0) + (data.not ? 1 : 0);
        // Allow empty predicate (always matches) or exactly one operator
        return count <= 1;
      },
      { message: "At most one of all, any, or not may be specified per group" },
    ),
);

// Full predicate with version
export const RulePredicateV2Schema = z.object({
  version: z.literal(2),
  root: PredicateGroupSchema,
});

export type RulePredicateV2 = z.infer<typeof RulePredicateV2Schema>;

// =============================================================================
// OUTCOME SCHEMAS
// =============================================================================

export const RuleOutcomeSchema = z.object({
  eligibility: EligibilityStatusSchema,
  health_class: HealthClassSchema,
  table_rating: TableRatingSchema.default("none"),
  flat_extra_per_thousand: z.number().nonnegative().optional(),
  flat_extra_years: z.number().int().positive().optional(),
  reason: z.string().min(1),
  concerns: z.array(z.string()).default([]),
});

export type RuleOutcome = z.infer<typeof RuleOutcomeSchema>;

// Default safe outcome (unknown, not decline)
export const DEFAULT_SAFE_OUTCOME: RuleOutcome = {
  eligibility: "refer",
  health_class: "unknown",
  table_rating: "none",
  reason: "No matching rule - manual review required",
  concerns: [],
};

// =============================================================================
// RULE & RULE SET SCHEMAS
// =============================================================================

export const UnderwritingRuleSchema = z.object({
  id: z.string().uuid(),
  rule_set_id: z.string().uuid(),
  priority: z.number().int(),
  name: z.string().min(1),
  description: z.string().optional(),
  age_band_min: z.number().int().min(0).max(120).optional().nullable(),
  age_band_max: z.number().int().min(0).max(120).optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  predicate: z.unknown(), // Will be parsed separately
  predicate_version: z.number().int().default(2),
  outcome_eligibility: EligibilityStatusSchema,
  outcome_health_class: HealthClassSchema,
  outcome_table_rating: TableRatingSchema.default("none"),
  outcome_flat_extra_per_thousand: z
    .number()
    .nonnegative()
    .optional()
    .nullable(),
  outcome_flat_extra_years: z.number().int().positive().optional().nullable(),
  outcome_reason: z.string().min(1),
  outcome_concerns: z.array(z.string()).default([]),
  extraction_confidence: z.number().min(0).max(1).optional().nullable(),
  source_pages: z.array(z.number().int()).optional().nullable(),
  source_snippet: z.string().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type UnderwritingRule = z.infer<typeof UnderwritingRuleSchema>;

export const UnderwritingRuleSetSchema = z.object({
  id: z.string().uuid(),
  imo_id: z.string().uuid(),
  carrier_id: z.string().uuid(),
  product_id: z.string().uuid().optional().nullable(),
  scope: RuleSetScopeSchema,
  condition_code: z.string().optional().nullable(),
  variant: z.string().default("default"),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  version: z.number().int().default(1),
  default_outcome: RuleOutcomeSchema.optional(),
  source: z.enum(["manual", "ai_extracted", "imported"]).optional().nullable(),
  source_guide_id: z.string().uuid().optional().nullable(),
  review_status: ReviewStatusSchema,
  reviewed_by: z.string().uuid().optional().nullable(),
  reviewed_at: z.string().optional().nullable(),
  review_notes: z.string().optional().nullable(),
  created_by: z.string().uuid().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  rules: z.array(UnderwritingRuleSchema).optional(),
});

export type UnderwritingRuleSet = z.infer<typeof UnderwritingRuleSetSchema>;

// =============================================================================
// EVALUATION RESULT TYPES
// =============================================================================

export interface MissingField {
  field: string;
  conditionCode?: string;
  reason: string;
  requiredFor: "all" | "any";
}

export interface MatchedRule {
  ruleId: string;
  ruleName: string;
  ruleSetId: string;
  conditionCode?: string;
  matchedConditions: FieldCondition[];
  outcome: RuleOutcome;
}

export interface FlatExtra {
  perThousand: number;
  years: number;
  source: string; // Which condition/rule contributed this
}

export interface ConditionOutcome {
  conditionCode: string;
  eligibility: EligibilityStatus | "unknown";
  healthClass: HealthClass;
  tableUnits: number;
  flatExtra: FlatExtra | null;
  concerns: string[];
  matchedRules: MatchedRule[];
  missingFields: MissingField[];
}

export interface AggregatedOutcome {
  eligibility: EligibilityStatus | "unknown";
  healthClass: HealthClass;
  tableRating: TableRating;
  tableUnits: number;
  flatExtras: FlatExtra[];
  totalFlatExtraPerThousand: number;
  maxFlatExtraDuration: number;
  concerns: string[];
  matchedRules: MatchedRule[];
  missingFields: MissingField[];
  globalOutcome: ConditionOutcome | null;
  conditionOutcomes: ConditionOutcome[];
}

// =============================================================================
// FACT MAP TYPE
// =============================================================================

// Canonical fact map structure for evaluation
// NOTE: bmi and state are optional - wizard may not collect them
// Missing fields will produce "unknown" evaluations (safe default)
export interface FactMap {
  // Client basics
  "client.age": number;
  "client.gender": "male" | "female";
  "client.bmi"?: number;
  "client.state"?: string;
  "client.tobacco": boolean;

  // List of condition codes present
  conditions: string[];

  // Dynamic condition fields: {conditionCode}.{fieldId}
  [key: `${string}.${string}`]: unknown;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get table rating units from letter
 */
export function getTableRatingUnits(rating: TableRating): number {
  return TABLE_RATING_UNITS[rating] ?? 0;
}

/**
 * Get table rating letter from units
 */
export function getTableRatingFromUnits(units: number): TableRating {
  if (units <= 0) return "none";
  if (units >= 16) return "P";
  const letters: TableRating[] = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
  ];
  return letters[units - 1] ?? "none";
}

/**
 * Get health class rank (higher = worse)
 */
export function getHealthClassRank(hc: HealthClass): number {
  return HEALTH_CLASS_RANK[hc] ?? 7; // Default to unknown
}

/**
 * Get health class from rank
 */
export function getHealthClassFromRank(rank: number): HealthClass {
  const ranked = Object.entries(HEALTH_CLASS_RANK).find(([_, r]) => r === rank);
  return (ranked?.[0] as HealthClass) ?? "unknown";
}

/**
 * Get worse of two eligibility statuses
 */
export function getWorseEligibility(
  a: EligibilityStatus | "unknown",
  b: EligibilityStatus | "unknown",
): EligibilityStatus | "unknown" {
  const rank: Record<EligibilityStatus | "unknown", number> = {
    eligible: 1,
    refer: 2,
    unknown: 3,
    ineligible: 4,
  };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Parse predicate JSON into typed structure
 */
export function parsePredicate(predicateJson: unknown): PredicateGroup {
  if (!predicateJson || typeof predicateJson !== "object") {
    return {}; // Empty predicate (always matches)
  }

  const obj = predicateJson as Record<string, unknown>;

  // Handle versioned format
  if (obj.version === 2 && obj.root) {
    return obj.root as PredicateGroup;
  }

  // Handle direct predicate group
  return predicateJson as PredicateGroup;
}

/**
 * Extract condition code from field path (e.g., "diabetes_type_2.a1c" -> "diabetes_type_2")
 */
export function extractConditionCode(field: string): string | undefined {
  if (field.startsWith("client.") || field === "conditions") {
    return undefined;
  }
  const parts = field.split(".");
  return parts.length >= 2 ? parts[0] : undefined;
}

/**
 * Validate a rule's predicate
 */
export function validatePredicate(predicate: unknown): {
  valid: boolean;
  errors: string[];
} {
  try {
    if (
      !predicate ||
      (typeof predicate === "object" && Object.keys(predicate).length === 0)
    ) {
      return { valid: true, errors: [] }; // Empty predicate is valid (always matches)
    }

    const parsed = parsePredicate(predicate);
    PredicateGroupSchema.parse(parsed);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      };
    }
    return { valid: false, errors: [String(error)] };
  }
}
