// src/features/underwriting/hooks/useExtractCriteria.ts
// Mutation hook for triggering AI criteria extraction

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { criteriaService } from "@/services/underwriting/repositories/criteriaService";
import { criteriaQueryKeys } from "./useCriteria";
import type { ExtractionResponse } from "../../types/underwriting.types";

interface ExtractCriteriaInput {
  guideId: string;
  productId?: string;
}

/**
 * Mutation hook to trigger AI extraction of underwriting criteria
 */
export function useExtractCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: ExtractCriteriaInput,
    ): Promise<ExtractionResponse> => {
      const result = await criteriaService.triggerExtraction(
        input.guideId,
        input.productId,
      );

      if (!result.success) {
        throw new Error(result.error || "Extraction failed");
      }

      return result;
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to refetch criteria
      queryClient.invalidateQueries({
        queryKey: criteriaQueryKeys.byGuide(variables.guideId),
      });
      queryClient.invalidateQueries({
        queryKey: criteriaQueryKeys.all,
      });

      const confidence = data.confidence
        ? `${(data.confidence * 100).toFixed(0)}%`
        : "N/A";
      toast.success(`Criteria extraction started`, {
        description: `Processing ${data.chunksProcessed || 1} chunk(s). Confidence: ${confidence}`,
      });
    },
    onError: (error) => {
      toast.error("Extraction failed", {
        description: error.message,
      });
    },
  });
}

interface UpdateReviewInput {
  criteriaId: string;
  reviewStatus: "pending" | "approved" | "rejected" | "needs_revision";
  reviewNotes?: string;
  reviewerId?: string;
}

/**
 * Mutation hook to update criteria review status
 */
export function useUpdateCriteriaReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateReviewInput) => {
      return criteriaService.updateCriteriaReviewStatus(
        input.criteriaId,
        input.reviewStatus,
        input.reviewNotes,
        input.reviewerId,
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: criteriaQueryKeys.all });

      const statusMessages: Record<string, string> = {
        approved: "Criteria approved and activated",
        rejected: "Criteria rejected",
        needs_revision: "Criteria marked for revision",
        pending: "Criteria reset to pending",
      };

      toast.success(statusMessages[data.review_status || "pending"]);
    },
    onError: (error) => {
      toast.error("Failed to update review status", {
        description: error.message,
      });
    },
  });
}

/**
 * Mutation hook to delete criteria
 */
export function useDeleteCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (criteriaId: string) => {
      return criteriaService.deleteCriteria(criteriaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: criteriaQueryKeys.all });
      toast.success("Criteria deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete criteria", {
        description: error.message,
      });
    },
  });
}

interface UpdateCriteriaContentInput {
  criteriaId: string;
  criteria: Record<string, unknown>;
}

/**
 * Mutation hook to update criteria content (manual edits)
 */
export function useUpdateCriteriaContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCriteriaContentInput) => {
      return criteriaService.updateCriteriaContent(
        input.criteriaId,
        input.criteria,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: criteriaQueryKeys.all });
      toast.success("Criteria updated");
    },
    onError: (error) => {
      toast.error("Failed to update criteria", {
        description: error.message,
      });
    },
  });
}
