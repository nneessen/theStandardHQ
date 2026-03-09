// src/features/underwriting/hooks/useRuleWorkflow.ts
// React Query hooks for rule set approval workflow

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  submitForReview,
  approveRuleSet,
  rejectRuleSet,
  revertToDraft,
} from "@/services/underwriting/ruleService";
import { ruleEngineKeys } from "./useRuleSets";

// ============================================================================
// Workflow Mutation Hooks
// ============================================================================

/**
 * Submit a rule set for review (draft → pending_review)
 */
export function useSubmitForReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      ruleSetId,
      carrierId: _carrierId,
    }: {
      ruleSetId: string;
      carrierId: string;
    }) => submitForReview(ruleSetId),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate the specific rule set
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.ruleSet(imoId, variables.ruleSetId),
        });
        // Invalidate rule sets list for this carrier
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.ruleSetsForCarrier(
            imoId,
            variables.carrierId,
          ),
        });
        // Invalidate needing review list
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.needingReview(imoId),
        });
      }
    },
  });
}

/**
 * Approve a rule set (pending_review → approved)
 */
export function useApproveRuleSet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      ruleSetId,
      carrierId: _carrierId,
      notes,
    }: {
      ruleSetId: string;
      carrierId: string;
      notes?: string;
    }) => approveRuleSet(ruleSetId, notes),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate the specific rule set
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.ruleSet(imoId, variables.ruleSetId),
        });
        // Invalidate rule sets list for this carrier
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.ruleSetsForCarrier(
            imoId,
            variables.carrierId,
          ),
        });
        // Invalidate needing review list
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.needingReview(imoId),
        });
      }
    },
  });
}

/**
 * Reject a rule set (pending_review → rejected)
 */
export function useRejectRuleSet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      ruleSetId,
      carrierId: _carrierId,
      notes,
    }: {
      ruleSetId: string;
      carrierId: string;
      notes: string;
    }) => rejectRuleSet(ruleSetId, notes),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate the specific rule set
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.ruleSet(imoId, variables.ruleSetId),
        });
        // Invalidate rule sets list for this carrier
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.ruleSetsForCarrier(
            imoId,
            variables.carrierId,
          ),
        });
        // Invalidate needing review list
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.needingReview(imoId),
        });
      }
    },
  });
}

/**
 * Revert a rule set to draft (any status → draft)
 */
export function useRevertToDraft() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      ruleSetId,
      carrierId: _carrierId,
    }: {
      ruleSetId: string;
      carrierId: string;
    }) => revertToDraft(ruleSetId),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate the specific rule set
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.ruleSet(imoId, variables.ruleSetId),
        });
        // Invalidate rule sets list for this carrier
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.ruleSetsForCarrier(
            imoId,
            variables.carrierId,
          ),
        });
        // Invalidate needing review list
        queryClient.invalidateQueries({
          queryKey: ruleEngineKeys.needingReview(imoId),
        });
      }
    },
  });
}
