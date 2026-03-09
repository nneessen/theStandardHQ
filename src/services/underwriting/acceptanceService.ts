// src/services/underwriting/acceptanceService.ts
// Service for managing carrier condition acceptance rules

import { supabase } from "@/services/base/supabase";
import type { Database } from "@/types/database.types";

type AcceptanceRow =
  Database["public"]["Tables"]["carrier_condition_acceptance"]["Row"];
type AcceptanceInsert =
  Database["public"]["Tables"]["carrier_condition_acceptance"]["Insert"];

// ============================================================================
// Types
// ============================================================================

export type AcceptanceDecision =
  | "approved"
  | "table_rated"
  | "declined"
  | "case_by_case";

export interface CarrierAcceptance extends AcceptanceRow {
  carrier?: {
    id: string;
    name: string;
  };
  condition?: {
    code: string;
    name: string;
    category: string;
  };
}

// Review status type
export type RuleReviewStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected";

export interface AcceptanceRuleInput {
  carrierId: string;
  conditionCode: string;
  productType?: string | null;
  acceptance: AcceptanceDecision;
  healthClassResult?: string | null;
  approvalLikelihood?: number | null;
  notes?: string | null;
}

// Acceptance decision options for UI
export const ACCEPTANCE_OPTIONS: {
  value: AcceptanceDecision;
  label: string;
  description: string;
}[] = [
  { value: "approved", label: "Approved", description: "Standard approval" },
  {
    value: "table_rated",
    label: "Table Rated",
    description: "Approved with rating",
  },
  {
    value: "case_by_case",
    label: "Case by Case",
    description: "Requires underwriter review",
  },
  { value: "declined", label: "Declined", description: "Not insurable" },
];

// Health class result options
export const HEALTH_CLASS_RESULT_OPTIONS: { value: string; label: string }[] = [
  { value: "preferred_plus", label: "Preferred Plus" },
  { value: "preferred", label: "Preferred" },
  { value: "standard_plus", label: "Standard Plus" },
  { value: "standard", label: "Standard" },
  { value: "substandard", label: "Substandard" },
  { value: "graded", label: "Graded Benefit" },
  { value: "modified", label: "Modified Benefit" },
  { value: "guaranteed_issue", label: "Guaranteed Issue" },
  { value: "table_a", label: "Table A (+25%)" },
  { value: "table_b", label: "Table B (+50%)" },
  { value: "table_c", label: "Table C (+75%)" },
  { value: "table_d", label: "Table D (+100%)" },
  { value: "table_e", label: "Table E (+125%)" },
  { value: "table_f", label: "Table F (+150%)" },
  { value: "table_g", label: "Table G (+175%)" },
  { value: "table_h", label: "Table H (+200%)" },
  { value: "decline", label: "Decline" },
];

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Get all acceptance rules for a carrier
 */
export async function getAcceptanceForCarrier(
  carrierId: string,
  imoId: string,
): Promise<CarrierAcceptance[]> {
  const { data, error } = await supabase
    .from("carrier_condition_acceptance")
    .select(
      `
      *,
      carrier:carriers(id, name),
      condition:underwriting_health_conditions(code, name, category)
    `,
    )
    .eq("carrier_id", carrierId)
    .eq("imo_id", imoId)
    .order("condition_code", { ascending: true });

  if (error) {
    console.error("Error fetching carrier acceptance rules:", error);
    throw new Error(`Failed to fetch acceptance rules: ${error.message}`);
  }

  return (data || []) as CarrierAcceptance[];
}

/**
 * Get all acceptance rules for a condition (across all carriers)
 */
export async function getAcceptanceForCondition(
  conditionCode: string,
  imoId: string,
): Promise<CarrierAcceptance[]> {
  const { data, error } = await supabase
    .from("carrier_condition_acceptance")
    .select(
      `
      *,
      carrier:carriers(id, name),
      condition:underwriting_health_conditions(code, name, category)
    `,
    )
    .eq("condition_code", conditionCode)
    .eq("imo_id", imoId)
    .order("carrier_id", { ascending: true });

  if (error) {
    console.error("Error fetching condition acceptance rules:", error);
    throw new Error(`Failed to fetch acceptance rules: ${error.message}`);
  }

  return (data || []) as CarrierAcceptance[];
}

/**
 * Get all acceptance rules for an IMO
 */
export async function getAllAcceptanceRules(
  imoId: string,
): Promise<CarrierAcceptance[]> {
  const { data, error } = await supabase
    .from("carrier_condition_acceptance")
    .select(
      `
      *,
      carrier:carriers(id, name),
      condition:underwriting_health_conditions(code, name, category)
    `,
    )
    .eq("imo_id", imoId)
    .order("carrier_id", { ascending: true })
    .order("condition_code", { ascending: true });

  if (error) {
    console.error("Error fetching all acceptance rules:", error);
    throw new Error(`Failed to fetch acceptance rules: ${error.message}`);
  }

  return (data || []) as CarrierAcceptance[];
}

/**
 * Lookup a specific acceptance rule
 * By default, only returns approved rules for use in recommendations.
 *
 * @param carrierId - Carrier ID to look up
 * @param conditionCode - Condition code to look up
 * @param imoId - IMO ID for tenant isolation
 * @param productType - Optional product type for product-specific rules
 * @param includeUnapproved - If true, returns rules regardless of review status
 */
export async function lookupAcceptance(
  carrierId: string,
  conditionCode: string,
  imoId: string,
  productType?: string,
  includeUnapproved: boolean = false,
): Promise<CarrierAcceptance | null> {
  let query = supabase
    .from("carrier_condition_acceptance")
    .select(
      `
      *,
      carrier:carriers(id, name),
      condition:underwriting_health_conditions(code, name, category)
    `,
    )
    .eq("carrier_id", carrierId)
    .eq("condition_code", conditionCode)
    .eq("imo_id", imoId);

  // Filter by review status - only approved rules by default
  // This ensures draft/pending rules don't affect recommendations
  if (!includeUnapproved) {
    query = query.eq("review_status", "approved");
  }

  // If product type specified, prefer product-specific rules
  if (productType) {
    query = query.or(`product_type.eq.${productType},product_type.is.null`);
  }

  const { data, error } = await query
    .order("product_type", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    console.error("Error looking up acceptance:", error);
    throw new Error(`Failed to lookup acceptance: ${error.message}`);
  }

  return (data && data.length > 0 ? data[0] : null) as CarrierAcceptance | null;
}

/**
 * Get draft rules for conditions (for FYI display, not used in scoring)
 * Only returns rules that are in draft or pending_review status.
 */
export async function getDraftRulesForConditions(
  carrierId: string,
  conditionCodes: string[],
  imoId: string,
): Promise<CarrierAcceptance[]> {
  if (conditionCodes.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("carrier_condition_acceptance")
    .select(
      `
      *,
      carrier:carriers(id, name),
      condition:underwriting_health_conditions(code, name, category)
    `,
    )
    .eq("carrier_id", carrierId)
    .in("condition_code", conditionCodes)
    .eq("imo_id", imoId)
    .in("review_status", ["draft", "pending_review"]);

  if (error) {
    console.error("Error fetching draft rules:", error);
    throw new Error(`Failed to fetch draft rules: ${error.message}`);
  }

  return (data || []) as CarrierAcceptance[];
}

/**
 * Get all rules that need review (for admin review dashboard)
 */
export async function getRulesNeedingReview(
  imoId: string,
): Promise<CarrierAcceptance[]> {
  const { data, error } = await supabase
    .from("carrier_condition_acceptance")
    .select(
      `
      *,
      carrier:carriers(id, name),
      condition:underwriting_health_conditions(code, name, category)
    `,
    )
    .eq("imo_id", imoId)
    .in("review_status", ["draft", "pending_review"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching rules needing review:", error);
    throw new Error(`Failed to fetch rules: ${error.message}`);
  }

  return (data || []) as CarrierAcceptance[];
}

/**
 * Get carriers that have acceptance rules entered
 */
export async function getCarriersWithAcceptanceRules(
  imoId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("carrier_condition_acceptance")
    .select("carrier_id")
    .eq("imo_id", imoId);

  if (error) {
    console.error("Error fetching carriers with acceptance rules:", error);
    throw new Error(`Failed to fetch carriers: ${error.message}`);
  }

  return [...new Set((data || []).map((r) => r.carrier_id))];
}

/**
 * Get all health conditions for the condition selector
 */
export async function getHealthConditions(): Promise<
  Array<{
    code: string;
    name: string;
    category: string;
  }>
> {
  const { data, error } = await supabase
    .from("underwriting_health_conditions")
    .select("code, name, category")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching health conditions:", error);
    throw new Error(`Failed to fetch conditions: ${error.message}`);
  }

  return data || [];
}

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Create or update an acceptance rule
 */
export async function upsertAcceptanceRule(
  input: AcceptanceRuleInput,
  imoId: string,
  userId: string,
): Promise<CarrierAcceptance> {
  const insertData: AcceptanceInsert = {
    carrier_id: input.carrierId,
    condition_code: input.conditionCode,
    product_type: input.productType,
    acceptance: input.acceptance,
    health_class_result: input.healthClassResult,
    approval_likelihood: input.approvalLikelihood,
    notes: input.notes,
    imo_id: imoId,
    created_by: userId,
    source: "manual",
  };

  const { data, error } = await supabase
    .from("carrier_condition_acceptance")
    .upsert(insertData, {
      onConflict: "carrier_id,condition_code,product_type,imo_id",
    })
    .select(
      `
      *,
      carrier:carriers(id, name),
      condition:underwriting_health_conditions(code, name, category)
    `,
    )
    .single();

  if (error) {
    console.error("Error upserting acceptance rule:", error);
    throw new Error(`Failed to save acceptance rule: ${error.message}`);
  }

  return data as CarrierAcceptance;
}

/**
 * Bulk upsert acceptance rules
 */
export async function bulkUpsertAcceptanceRules(
  rules: AcceptanceRuleInput[],
  imoId: string,
  userId: string,
): Promise<{ inserted: number }> {
  const insertData: AcceptanceInsert[] = rules.map((rule) => ({
    carrier_id: rule.carrierId,
    condition_code: rule.conditionCode,
    product_type: rule.productType,
    acceptance: rule.acceptance,
    health_class_result: rule.healthClassResult,
    approval_likelihood: rule.approvalLikelihood,
    notes: rule.notes,
    imo_id: imoId,
    created_by: userId,
    source: "manual",
  }));

  const { data, error } = await supabase
    .from("carrier_condition_acceptance")
    .upsert(insertData, {
      onConflict: "carrier_id,condition_code,product_type,imo_id",
    })
    .select();

  if (error) {
    console.error("Error bulk upserting acceptance rules:", error);
    throw new Error(`Failed to save acceptance rules: ${error.message}`);
  }

  return { inserted: data?.length || 0 };
}

/**
 * Delete an acceptance rule
 */
export async function deleteAcceptanceRule(
  ruleId: string,
  imoId: string,
): Promise<void> {
  const { error } = await supabase
    .from("carrier_condition_acceptance")
    .delete()
    .eq("id", ruleId)
    .eq("imo_id", imoId);

  if (error) {
    console.error("Error deleting acceptance rule:", error);
    throw new Error(`Failed to delete acceptance rule: ${error.message}`);
  }
}

/**
 * Delete all acceptance rules for a carrier
 */
export async function deleteAcceptanceForCarrier(
  carrierId: string,
  imoId: string,
): Promise<void> {
  const { error } = await supabase
    .from("carrier_condition_acceptance")
    .delete()
    .eq("carrier_id", carrierId)
    .eq("imo_id", imoId);

  if (error) {
    console.error("Error deleting carrier acceptance rules:", error);
    throw new Error(`Failed to delete acceptance rules: ${error.message}`);
  }
}

// ============================================================================
// AI Extraction Support (Phase 4)
// ============================================================================

/**
 * Input for creating a draft acceptance rule from AI extraction
 */
export interface AIExtractedRuleInput {
  carrierId: string;
  conditionCode: string;
  productType?: string | null;
  acceptance: AcceptanceDecision;
  healthClassResult?: string | null;
  approvalLikelihood?: number | null;
  notes?: string | null;
  // Provenance
  sourceGuideId?: string;
  sourcePages?: number[];
  sourceSnippet?: string;
  extractionConfidence?: number;
}

/**
 * Create an acceptance rule from AI extraction.
 * ALWAYS creates as draft - never auto-approved.
 * Requires manual review before affecting recommendations.
 */
export async function createDraftRuleFromExtraction(
  input: AIExtractedRuleInput,
  imoId: string,
  userId: string,
): Promise<CarrierAcceptance> {
  // Type assertion for extended fields (will be available after migration)
  const insertData = {
    carrier_id: input.carrierId,
    condition_code: input.conditionCode,
    product_type: input.productType,
    acceptance: input.acceptance,
    health_class_result: input.healthClassResult,
    approval_likelihood: input.approvalLikelihood,
    notes: input.notes
      ? `[AI-extracted] ${input.notes}`
      : "[AI-extracted - requires human review]",
    imo_id: imoId,
    created_by: userId,
    source: "ai_extraction",
    // CRITICAL: Always draft - never auto-approve AI-extracted rules
    review_status: "draft",
    // Provenance
    source_guide_id: input.sourceGuideId,
    source_pages: input.sourcePages,
    source_snippet: input.sourceSnippet,
    extraction_confidence: input.extractionConfidence,
    rule_schema_version: 1,
  };

  const { data, error } = await supabase
    .from("carrier_condition_acceptance")
    .upsert(insertData, {
      onConflict: "carrier_id,condition_code,product_type,imo_id",
    })
    .select(
      `
      *,
      carrier:carriers(id, name),
      condition:underwriting_health_conditions(code, name, category)
    `,
    )
    .single();

  if (error) {
    console.error("Error creating draft rule from extraction:", error);
    throw new Error(`Failed to create draft rule: ${error.message}`);
  }

  return data as CarrierAcceptance;
}

/**
 * Bulk create draft acceptance rules from AI extraction.
 * All rules are created as draft regardless of confidence level.
 */
export async function bulkCreateDraftRulesFromExtraction(
  rules: AIExtractedRuleInput[],
  imoId: string,
  userId: string,
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  for (const rule of rules) {
    try {
      await createDraftRuleFromExtraction(rule, imoId, userId);
      created++;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      errors.push(`${rule.conditionCode}: ${error}`);
    }
  }

  return { created, errors };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get acceptance display info
 */
export function getAcceptanceDisplay(acceptance: string): {
  label: string;
  color: "green" | "yellow" | "orange" | "red";
} {
  switch (acceptance) {
    case "approved":
      return { label: "Approved", color: "green" };
    case "table_rated":
      return { label: "Table Rated", color: "yellow" };
    case "case_by_case":
      return { label: "Case by Case", color: "orange" };
    case "declined":
      return { label: "Declined", color: "red" };
    default:
      return { label: acceptance, color: "orange" };
  }
}

/**
 * Group conditions by category for UI
 */
export function groupConditionsByCategory(
  conditions: Array<{ code: string; name: string; category: string }>,
): Record<string, Array<{ code: string; name: string }>> {
  return conditions.reduce(
    (acc, condition) => {
      if (!acc[condition.category]) {
        acc[condition.category] = [];
      }
      acc[condition.category].push({
        code: condition.code,
        name: condition.name,
      });
      return acc;
    },
    {} as Record<string, Array<{ code: string; name: string }>>,
  );
}
