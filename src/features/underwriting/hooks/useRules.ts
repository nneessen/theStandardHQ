// src/features/underwriting/hooks/useRules.ts
// React Query hooks for v2 rules (individual rules within rule sets)

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  createRule,
  updateRule,
  deleteRule,
  reorderRules,
  type CreateRuleInput,
} from "@/services/underwriting/ruleService";
import { ruleEngineKeys } from "./useRuleSets";
import { coverageStatsKeys } from "./useCoverageStats";

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new rule within a rule set
 */
export function useCreateRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: (input: CreateRuleInput) => createRule(input),
    onSuccess: (_, variables) => {
      // Invalidate the parent rule set to refresh rules list
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSet(imoId, variables.ruleSetId),
      });
      // Also invalidate needing review since rule changes may affect status
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imoId),
      });
    },
  });
}

/**
 * Update an existing rule
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      id,
      carrierId: _carrierId,
      ruleSetId: _ruleSetId,
      updates,
    }: {
      id: string;
      carrierId: string;
      ruleSetId: string;
      updates: Parameters<typeof updateRule>[1];
    }) => updateRule(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSet(imoId, variables.ruleSetId),
      });
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imoId, variables.carrierId),
      });
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imoId),
      });
      queryClient.invalidateQueries({
        queryKey: coverageStatsKeys.all,
      });
    },
  });
}

/**
 * Delete a rule
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      id,
      carrierId: _carrierId,
      ruleSetId: _ruleSetId,
    }: {
      id: string;
      carrierId: string;
      ruleSetId: string;
    }) => deleteRule(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSet(imoId, variables.ruleSetId),
      });
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imoId, variables.carrierId),
      });
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imoId),
      });
      queryClient.invalidateQueries({
        queryKey: coverageStatsKeys.all,
      });
    },
  });
}

/**
 * Reorder rules within a rule set
 */
export function useReorderRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      ruleSetId,
      carrierId: _carrierId,
      ruleIds,
    }: {
      ruleSetId: string;
      carrierId: string;
      ruleIds: string[];
    }) => reorderRules(ruleSetId, ruleIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSet(imoId, variables.ruleSetId),
      });
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imoId, variables.carrierId),
      });
    },
  });
}

// Re-export types for convenience
export type { CreateRuleInput };
