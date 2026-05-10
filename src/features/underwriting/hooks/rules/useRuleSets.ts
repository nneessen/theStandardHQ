// src/features/underwriting/hooks/useRuleSets.ts
// React Query hooks for v2 rule sets (compound predicates with approval workflow)

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getRuleSetsForCarrier,
  getRuleSet,
  getRulesNeedingReview,
  createRuleSet,
  updateRuleSet,
  deleteRuleSet,
  type CreateRuleSetInput,
  type RuleSetWithRules,
  type RuleReviewStatus,
} from "@/services/underwriting/repositories/ruleService";
import type {
  HealthClass,
  TableRating,
} from "@/services/underwriting/repositories/ruleService";
import { parsePredicate } from "@/services/underwriting/core/ruleEngineDSL";
import type {
  PredicateGroup,
  RuleSetScope,
} from "@/services/underwriting/core/ruleEngineDSL";
function normalizeRuleReviewStatusKey(
  reviewStatus?: RuleReviewStatus | RuleReviewStatus[],
): RuleReviewStatus[] | ["all"] {
  if (!reviewStatus) {
    return ["all"];
  }

  return Array.isArray(reviewStatus)
    ? [...reviewStatus].sort()
    : [reviewStatus];
}

// ============================================================================
// Query Keys
// ============================================================================

export const ruleEngineKeys = {
  all: ["rule-engine"] as const,
  ruleSets: (
    imoId: string | null | undefined,
    carrierId: string,
    options?: {
      productId?: string | null;
      includeInactive?: boolean;
      reviewStatus?: RuleReviewStatus | RuleReviewStatus[];
    },
  ) =>
    [
      ...ruleEngineKeys.all,
      "rule-sets",
      imoId || "no-imo",
      carrierId,
      {
        includeInactive: options?.includeInactive ?? false,
        productId: options?.productId ?? null,
        reviewStatus: normalizeRuleReviewStatusKey(options?.reviewStatus),
      },
    ] as const,
  ruleSetsForCarrier: (imoId: string | null | undefined, carrierId: string) =>
    [...ruleEngineKeys.all, "rule-sets", imoId || "no-imo", carrierId] as const,
  ruleSet: (imoId: string | null | undefined, ruleSetId: string) =>
    [...ruleEngineKeys.all, "rule-set", imoId || "no-imo", ruleSetId] as const,
  needingReview: (imoId: string | null | undefined) =>
    [...ruleEngineKeys.all, "needing-review", imoId || "no-imo"] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all rule sets for a carrier
 */
export function useRuleSets(
  carrierId: string | undefined,
  options?: {
    productId?: string | null;
    includeInactive?: boolean;
    reviewStatus?: RuleReviewStatus | RuleReviewStatus[];
  },
) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: ruleEngineKeys.ruleSets(imoId, carrierId || "", options),
    queryFn: () =>
      getRuleSetsForCarrier(carrierId!, imoId!, {
        includeInactive: options?.includeInactive,
        reviewStatus: options?.reviewStatus,
      }),
    enabled: !!carrierId && !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single rule set by ID with all rules
 */
export function useRuleSet(ruleSetId: string | undefined) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: ruleEngineKeys.ruleSet(imoId, ruleSetId || ""),
    queryFn: () => {
      if (!imoId) {
        throw new Error("User must have an IMO to fetch rule sets");
      }
      return getRuleSet(ruleSetId!, imoId);
    },
    enabled: !!ruleSetId && !!imoId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Fetch rule sets needing review (draft or pending_review)
 */
export function useRulesNeedingReview() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: ruleEngineKeys.needingReview(imoId),
    queryFn: () => getRulesNeedingReview(imoId!),
    enabled: !!imoId,
    staleTime: 2 * 60 * 1000, // 2 minutes - check more frequently
    gcTime: 10 * 60 * 1000,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new rule set
 */
export function useCreateRuleSet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;
  const userId = user?.id;

  return useMutation({
    mutationFn: (input: CreateRuleSetInput) => {
      if (!imoId || !userId) {
        throw new Error("User not authenticated");
      }
      return createRuleSet(imoId, input, userId);
    },
    onSuccess: (data) => {
      // Invalidate rule sets list for this carrier
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imoId, data.carrier_id),
      });
      // Also invalidate needing review since new rule sets are drafts
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imoId),
      });
    },
  });
}

/**
 * Update a rule set
 */
export function useUpdateRuleSet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Parameters<typeof updateRuleSet>[1];
    }) => updateRuleSet(id, updates),
    onSuccess: (data) => {
      // Invalidate the specific rule set
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSet(imoId, data.id),
      });
      // Invalidate rule sets list for this carrier
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imoId, data.carrier_id),
      });
      // Invalidate needing review
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imoId),
      });
    },
  });
}

/**
 * Delete a rule set
 */
export function useDeleteRuleSet() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      id,
      carrierId: _carrierId,
    }: {
      id: string;
      carrierId: string;
    }) => {
      if (!imoId) {
        throw new Error("User must have an IMO to delete rule sets");
      }
      return deleteRuleSet(id, imoId);
    },
    onSuccess: (_, variables) => {
      // Invalidate rule sets list for this carrier
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imoId, variables.carrierId),
      });
      // Remove the specific rule set from cache
      queryClient.removeQueries({
        queryKey: ruleEngineKeys.ruleSet(imoId, variables.id),
      });
      // Invalidate needing review
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imoId),
      });
    },
  });
}

// Re-export types for convenience
export type {
  RuleSetWithRules,
  CreateRuleSetInput,
  RuleReviewStatus,
  HealthClass,
  TableRating,
  PredicateGroup,
  RuleSetScope,
};
export { parsePredicate, deleteRuleSet };
