// src/services/underwriting/criteriaService.ts
// Service for managing AI-extracted underwriting criteria

import { supabase } from "@/services/base/supabase";
import { supabaseFunctionsUrl } from "@/services/base";
import type {
  CriteriaWithRelations,
  ExtractedCriteria,
  ExtractionResponse,
  ReviewStatus,
} from "@/features/underwriting/types/underwriting.types";
import { validateCriteriaForSave } from "@/features/underwriting/utils/criteria/criteriaValidation";

/**
 * Trigger AI extraction of underwriting criteria from a parsed guide
 */
export async function triggerExtraction(
  guideId: string,
  productId?: string,
): Promise<ExtractionResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(
    `${supabaseFunctionsUrl}/extract-underwriting-criteria`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ guideId, productId }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Extraction failed");
  }

  return result as ExtractionResponse;
}

/**
 * Fetch criteria extraction record for a specific guide
 */
export async function getCriteriaByGuide(
  guideId: string,
): Promise<CriteriaWithRelations | null> {
  const { data, error } = await supabase
    .from("carrier_underwriting_criteria")
    .select(
      `
      *,
      carrier:carriers(id, name),
      guide:underwriting_guides(id, name),
      product:products(id, name)
    `,
    )
    .eq("guide_id", guideId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch criteria: ${error.message}`);
  }

  return data as CriteriaWithRelations | null;
}

/**
 * Fetch all criteria for an IMO
 */
export async function getCriteriaList(
  imoId: string,
): Promise<CriteriaWithRelations[]> {
  const { data, error } = await supabase
    .from("carrier_underwriting_criteria")
    .select(
      `
      *,
      carrier:carriers(id, name),
      guide:underwriting_guides(id, name),
      product:products(id, name)
    `,
    )
    .eq("imo_id", imoId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch criteria list: ${error.message}`);
  }

  return (data || []) as CriteriaWithRelations[];
}

/**
 * Update the review status of a criteria record
 */
export async function updateCriteriaReviewStatus(
  criteriaId: string,
  reviewStatus: ReviewStatus,
  reviewNotes?: string,
  reviewerId?: string,
): Promise<CriteriaWithRelations> {
  const updateData: Record<string, unknown> = {
    review_status: reviewStatus,
    review_notes: reviewNotes || null,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (reviewerId) {
    updateData.reviewed_by = reviewerId;
  }

  // If approved, set is_active to true
  if (reviewStatus === "approved") {
    updateData.is_active = true;
  }

  const { data, error } = await supabase
    .from("carrier_underwriting_criteria")
    .update(updateData)
    .eq("id", criteriaId)
    .select(
      `
      *,
      carrier:carriers(id, name),
      guide:underwriting_guides(id, name),
      product:products(id, name)
    `,
    )
    .single();

  if (error) {
    throw new Error(`Failed to update review status: ${error.message}`);
  }

  return data as CriteriaWithRelations;
}

/**
 * Delete a criteria record
 */
export async function deleteCriteria(criteriaId: string): Promise<void> {
  const { error } = await supabase
    .from("carrier_underwriting_criteria")
    .delete()
    .eq("id", criteriaId);

  if (error) {
    throw new Error(`Failed to delete criteria: ${error.message}`);
  }
}

/**
 * Update the criteria content (for manual edits)
 * Validates the criteria structure before saving
 */
export async function updateCriteriaContent(
  criteriaId: string,
  criteria: Record<string, unknown>,
): Promise<CriteriaWithRelations> {
  // Validate criteria structure before saving
  const validatedCriteria = validateCriteriaForSave(criteria);

  const { data, error } = await supabase
    .from("carrier_underwriting_criteria")
    .update({
      criteria: validatedCriteria,
      updated_at: new Date().toISOString(),
    })
    .eq("id", criteriaId)
    .select(
      `
      *,
      carrier:carriers(id, name),
      guide:underwriting_guides(id, name),
      product:products(id, name)
    `,
    )
    .single();

  if (error) {
    throw new Error(`Failed to update criteria content: ${error.message}`);
  }

  return data as CriteriaWithRelations;
}

export interface CreateCriteriaInput {
  imoId: string;
  carrierId: string;
  productId?: string;
  criteria: ExtractedCriteria;
  notes?: string;
}

/**
 * Create a manual criteria record (not from AI extraction)
 */
export async function createCriteria(
  input: CreateCriteriaInput,
): Promise<CriteriaWithRelations> {
  // Validate criteria structure before saving
  const validatedCriteria = validateCriteriaForSave(
    input.criteria as unknown as Record<string, unknown>,
  );

  const { data, error } = await supabase
    .from("carrier_underwriting_criteria")
    .insert({
      imo_id: input.imoId,
      carrier_id: input.carrierId,
      product_id: input.productId || null,
      criteria: validatedCriteria,
      is_active: true,
      review_status: "approved",
      extraction_status: "completed",
      extraction_confidence: 1.0, // Manual = 100% confidence
      extracted_at: new Date().toISOString(),
      review_notes: input.notes || "Manually created criteria",
      reviewed_at: new Date().toISOString(),
    })
    .select(
      `
      *,
      carrier:carriers(id, name),
      guide:underwriting_guides(id, name),
      product:products(id, name)
    `,
    )
    .single();

  if (error) {
    throw new Error(`Failed to create criteria: ${error.message}`);
  }

  return data as CriteriaWithRelations;
}

export const criteriaService = {
  triggerExtraction,
  getCriteriaByGuide,
  getCriteriaList,
  updateCriteriaReviewStatus,
  deleteCriteria,
  updateCriteriaContent,
  createCriteria,
};
