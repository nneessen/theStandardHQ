/**
 * Underwriting Rule Service
 *
 * CRUD operations for rule sets and rules with proper
 * tenant isolation and review workflow support.
 */

import { supabase } from "@/services/base/supabase";
import type { Database } from "@/types/database.types";
import {
  type RuleSetScope,
  type ReviewStatus,
  type PredicateGroup,
  validatePredicate,
} from "../core/ruleEngineDSL";

// =============================================================================
// TYPES (from generated database.types.ts)
// =============================================================================

type Tables = Database["public"]["Tables"];

// Rule set types
type RuleSetRow = Tables["underwriting_rule_sets"]["Row"];
type RuleSetInsert = Tables["underwriting_rule_sets"]["Insert"];
type RuleSetUpdate = Tables["underwriting_rule_sets"]["Update"];

// Rule types
type RuleRow = Tables["underwriting_rules"]["Row"];
type RuleInsert = Tables["underwriting_rules"]["Insert"];
type RuleUpdate = Tables["underwriting_rules"]["Update"];

// Enum types
export type HealthClass = Database["public"]["Enums"]["health_class"];
export type TableRating = Database["public"]["Enums"]["table_rating"];
export type RuleReviewStatus =
  Database["public"]["Enums"]["rule_review_status"];
export type RuleSetScopeEnum = Database["public"]["Enums"]["rule_set_scope"];

// Composite type
export interface RuleSetWithRules extends RuleSetRow {
  rules: RuleRow[];
}

export interface CreateRuleSetInput {
  carrierId: string;
  productId?: string | null;
  scope: RuleSetScope;
  conditionCode?: string | null;
  variant?: string;
  name: string;
  description?: string;
  source?: "manual" | "ai_extracted" | "imported";
  sourceGuideId?: string;
}

export interface CreateRuleInput {
  ruleSetId: string;
  priority: number;
  name: string;
  description?: string;
  ageBandMin?: number | null;
  ageBandMax?: number | null;
  gender?: "male" | "female" | null;
  predicate: PredicateGroup;
  outcomeEligibility: "eligible" | "ineligible" | "refer";
  outcomeHealthClass: HealthClass;
  outcomeTableRating?: TableRating;
  outcomeFlatExtraPerThousand?: number | null;
  outcomeFlatExtraYears?: number | null;
  outcomeReason: string;
  outcomeConcerns?: string[];
  extractionConfidence?: number;
  sourcePages?: number[];
  sourceSnippet?: string;
}

interface ReorderRulesResult {
  success: boolean;
  updated?: number;
  error?: string;
}

// =============================================================================
// RULE SET OPERATIONS
// =============================================================================

/**
 * Load approved rule sets for evaluation
 */
export async function loadApprovedRuleSets(
  imoId: string,
  carrierId: string,
  productId: string | null,
  options: {
    scope?: RuleSetScope;
    conditionCode?: string;
    conditionCodes?: string[];
  } = {},
): Promise<RuleSetWithRules[]> {
  let query = supabase
    .from("underwriting_rule_sets")
    .select(
      `
      *,
      rules:underwriting_rules(*)
    `,
    )
    .eq("imo_id", imoId)
    .eq("carrier_id", carrierId)
    .eq("review_status", "approved")
    .eq("is_active", true);

  // Handle product_id - NULL means carrier-wide rules
  if (productId) {
    // Get both product-specific and carrier-wide rules
    query = query.or(`product_id.is.null,product_id.eq.${productId}`);
  } else {
    // Only carrier-wide rules
    query = query.is("product_id", null);
  }

  // Filter by scope
  if (options.scope) {
    query = query.eq("scope", options.scope);
  }

  // Filter by condition code(s)
  if (options.conditionCode) {
    query = query.eq("condition_code", options.conditionCode);
  } else if (options.conditionCodes && options.conditionCodes.length > 0) {
    query = query.in("condition_code", options.conditionCodes);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading rule sets:", error);
    throw error;
  }

  // Sort rules by priority within each rule set
  return (data ?? []).map((rs) => ({
    ...rs,
    rules: (rs.rules ?? []).sort(
      (a: RuleRow, b: RuleRow) => a.priority - b.priority,
    ),
  }));
}

/**
 * Get all rule sets for a carrier (admin view)
 *
 * @param carrierId - Carrier ID to filter by
 * @param imoId - IMO ID for explicit tenant isolation (defense in depth)
 * @param options - Additional filters
 */
export async function getRuleSetsForCarrier(
  carrierId: string,
  imoId: string,
  options: {
    includeInactive?: boolean;
    reviewStatus?: ReviewStatus | ReviewStatus[];
  } = {},
): Promise<RuleSetWithRules[]> {
  let query = supabase
    .from("underwriting_rule_sets")
    .select(
      `
      *,
      rules:underwriting_rules(*)
    `,
    )
    .eq("carrier_id", carrierId)
    .eq("imo_id", imoId);

  if (!options.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (options.reviewStatus) {
    if (Array.isArray(options.reviewStatus)) {
      query = query.in("review_status", options.reviewStatus);
    } else {
      query = query.eq("review_status", options.reviewStatus);
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading rule sets:", error);
    throw error;
  }

  return (data ?? []).map((rs) => ({
    ...rs,
    rules: (rs.rules ?? []).sort(
      (a: RuleRow, b: RuleRow) => a.priority - b.priority,
    ),
  }));
}

/**
 * Get rule sets pending review
 *
 * @param imoId - IMO ID for explicit tenant isolation (defense in depth)
 */
export async function getRulesNeedingReview(
  imoId: string,
): Promise<RuleSetWithRules[]> {
  const { data, error } = await supabase
    .from("underwriting_rule_sets")
    .select(
      `
      *,
      rules:underwriting_rules(*)
    `,
    )
    .eq("imo_id", imoId)
    .in("review_status", ["draft", "pending_review"])
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading rules for review:", error);
    throw error;
  }

  return (data ?? []).map((rs) => ({
    ...rs,
    rules: (rs.rules ?? []).sort(
      (a: RuleRow, b: RuleRow) => a.priority - b.priority,
    ),
  }));
}

/**
 * Get a single rule set by ID
 */
export async function getRuleSet(
  id: string,
  imoId: string,
): Promise<RuleSetWithRules | null> {
  const { data, error } = await supabase
    .from("underwriting_rule_sets")
    .select(
      `
      *,
      rules:underwriting_rules(*)
    `,
    )
    .eq("id", id)
    .eq("imo_id", imoId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return {
    ...data,
    rules: (data.rules ?? []).sort(
      (a: RuleRow, b: RuleRow) => a.priority - b.priority,
    ),
  };
}

/**
 * Get all rule sets that came from a specific underwriting guide.
 *
 * Used by the Rule Review UI on /underwriting/guides/:guideId/extracted-rules
 * to show every candidate the AI extractor produced from this guide so the
 * admin can approve, reject, or edit them in one place.
 */
export async function getRuleSetsByGuide(
  guideId: string,
  imoId: string,
): Promise<RuleSetWithRules[]> {
  const { data, error } = await supabase
    .from("underwriting_rule_sets")
    .select(
      `
      *,
      rules:underwriting_rules(*)
    `,
    )
    .eq("imo_id", imoId)
    .eq("source_guide_id", guideId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading rule sets by guide:", error);
    throw error;
  }

  return (data ?? []).map((rs) => ({
    ...rs,
    rules: (rs.rules ?? []).sort(
      (a: RuleRow, b: RuleRow) => a.priority - b.priority,
    ),
  }));
}

/**
 * Create a new rule set
 */
export async function createRuleSet(
  imoId: string,
  input: CreateRuleSetInput,
  userId: string,
): Promise<RuleSetRow> {
  const insert: RuleSetInsert = {
    imo_id: imoId,
    carrier_id: input.carrierId,
    product_id: input.productId ?? null,
    scope: input.scope,
    condition_code: input.conditionCode ?? null,
    variant: input.variant ?? "default",
    name: input.name,
    description: input.description ?? null,
    source: input.source ?? "manual",
    source_guide_id: input.sourceGuideId ?? null,
    review_status: "draft",
    created_by: userId,
  };

  const { data, error } = await supabase
    .from("underwriting_rule_sets")
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error("Error creating rule set:", error);
    throw error;
  }

  return data;
}

/**
 * Update a rule set
 */
export async function updateRuleSet(
  id: string,
  updates: Partial<RuleSetUpdate>,
): Promise<RuleSetRow> {
  const { data, error } = await supabase
    .from("underwriting_rule_sets")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating rule set:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a rule set (cascades to rules)
 */
export async function deleteRuleSet(id: string, imoId: string): Promise<void> {
  const { error } = await supabase
    .from("underwriting_rule_sets")
    .delete()
    .eq("id", id)
    .eq("imo_id", imoId);

  if (error) {
    console.error("Error deleting rule set:", error);
    throw error;
  }
}

// =============================================================================
// RULE OPERATIONS
// =============================================================================

/**
 * Create a new rule within a rule set
 */
export async function createRule(input: CreateRuleInput): Promise<RuleRow> {
  // Validate predicate
  const validation = validatePredicate(input.predicate);
  if (!validation.valid) {
    throw new Error(`Invalid predicate: ${validation.errors.join(", ")}`);
  }

  const insert: RuleInsert = {
    rule_set_id: input.ruleSetId,
    priority: input.priority,
    name: input.name,
    description: input.description ?? null,
    age_band_min: input.ageBandMin ?? null,
    age_band_max: input.ageBandMax ?? null,
    gender: input.gender ?? null,
    predicate: { version: 2, root: input.predicate },
    predicate_version: 2,
    outcome_eligibility: input.outcomeEligibility,
    outcome_health_class: input.outcomeHealthClass,
    outcome_table_rating: input.outcomeTableRating ?? "none",
    outcome_flat_extra_per_thousand: input.outcomeFlatExtraPerThousand ?? null,
    outcome_flat_extra_years: input.outcomeFlatExtraYears ?? null,
    outcome_reason: input.outcomeReason,
    outcome_concerns: input.outcomeConcerns ?? [],
    extraction_confidence: input.extractionConfidence ?? null,
    source_pages: input.sourcePages ?? null,
    source_snippet: input.sourceSnippet ?? null,
  };

  const { data, error } = await supabase
    .from("underwriting_rules")
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error("Error creating rule:", error);
    throw error;
  }

  return data;
}

/**
 * Update a rule
 */
export async function updateRule(
  id: string,
  updates: Partial<{
    priority: number;
    name: string;
    description: string | null;
    ageBandMin: number | null;
    ageBandMax: number | null;
    gender: "male" | "female" | null;
    predicate: PredicateGroup;
    outcomeEligibility: "eligible" | "ineligible" | "refer";
    outcomeHealthClass: HealthClass;
    outcomeTableRating: TableRating;
    outcomeFlatExtraPerThousand: number | null;
    outcomeFlatExtraYears: number | null;
    outcomeReason: string;
    outcomeConcerns: string[];
  }>,
): Promise<RuleRow> {
  // Validate predicate if provided
  if (updates.predicate) {
    const validation = validatePredicate(updates.predicate);
    if (!validation.valid) {
      throw new Error(`Invalid predicate: ${validation.errors.join(", ")}`);
    }
  }

  const dbUpdates: RuleUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined)
    dbUpdates.description = updates.description;
  if (updates.ageBandMin !== undefined)
    dbUpdates.age_band_min = updates.ageBandMin;
  if (updates.ageBandMax !== undefined)
    dbUpdates.age_band_max = updates.ageBandMax;
  if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
  if (updates.predicate !== undefined) {
    dbUpdates.predicate = { version: 2, root: updates.predicate };
  }
  if (updates.outcomeEligibility !== undefined)
    dbUpdates.outcome_eligibility = updates.outcomeEligibility;
  if (updates.outcomeHealthClass !== undefined)
    dbUpdates.outcome_health_class = updates.outcomeHealthClass;
  if (updates.outcomeTableRating !== undefined)
    dbUpdates.outcome_table_rating = updates.outcomeTableRating;
  if (updates.outcomeFlatExtraPerThousand !== undefined)
    dbUpdates.outcome_flat_extra_per_thousand =
      updates.outcomeFlatExtraPerThousand;
  if (updates.outcomeFlatExtraYears !== undefined)
    dbUpdates.outcome_flat_extra_years = updates.outcomeFlatExtraYears;
  if (updates.outcomeReason !== undefined)
    dbUpdates.outcome_reason = updates.outcomeReason;
  if (updates.outcomeConcerns !== undefined)
    dbUpdates.outcome_concerns = updates.outcomeConcerns;

  const { data, error } = await supabase
    .from("underwriting_rules")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating rule:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a rule
 */
export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase
    .from("underwriting_rules")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting rule:", error);
    throw error;
  }
}

/**
 * Reorder rules within a rule set
 */
export async function reorderRules(
  ruleSetId: string,
  ruleIds: string[],
): Promise<void> {
  const { data, error } = await supabase.rpc("reorder_underwriting_rules", {
    p_rule_set_id: ruleSetId,
    p_rule_ids: ruleIds,
  });

  if (error) {
    console.error("Error reordering rules:", error);
    throw error;
  }

  const result = data as ReorderRulesResult;
  if (!result.success) {
    throw new Error(result.error || "Failed to reorder rules");
  }
}

// =============================================================================
// APPROVAL WORKFLOW
// =============================================================================

/**
 * Submit a rule set for review
 */
export async function submitForReview(
  ruleSetId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("submit_rule_set_for_review", {
    p_rule_set_id: ruleSetId,
  });

  if (error) {
    console.error("Error submitting for review:", error);
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}

/**
 * Approve a rule set
 */
export async function approveRuleSet(
  ruleSetId: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("approve_underwriting_rule_set", {
    p_rule_set_id: ruleSetId,
    p_notes: notes ?? null,
  });

  if (error) {
    console.error("Error approving rule set:", error);
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}

/**
 * Reject a rule set
 */
export async function rejectRuleSet(
  ruleSetId: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("reject_underwriting_rule_set", {
    p_rule_set_id: ruleSetId,
    p_notes: notes,
  });

  if (error) {
    console.error("Error rejecting rule set:", error);
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}

/**
 * Revert a rule set to draft
 */
export async function revertToDraft(
  ruleSetId: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc("revert_rule_set_to_draft", {
    p_rule_set_id: ruleSetId,
  });

  if (error) {
    console.error("Error reverting to draft:", error);
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}

// =============================================================================
// EVALUATION LOGGING
// =============================================================================

/**
 * Log a rule evaluation (for audit trail)
 */
export async function logEvaluation(
  _sessionId: string,
  _ruleSetId: string | null,
  _ruleId: string | null,
  _conditionCode: string | null,
  _result: "matched" | "failed" | "unknown" | "skipped",
  _details: {
    matchedConditions?: unknown;
    failedConditions?: unknown;
    missingFields?: unknown;
    outcomeApplied?: unknown;
    inputHash?: string;
  },
): Promise<void> {
  throw new Error(
    "Client-side underwriting audit writes are disabled. Persist audit logs via the backend authoritative save path.",
  );
}
