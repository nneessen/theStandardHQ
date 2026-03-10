// src/features/underwriting/hooks/useGenerateRules.ts
// React Query hooks for deterministic rule generation

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";
import {
  getAvailableKnockoutCodes,
  generateKnockoutRules,
  generateAgeRulesFromProducts,
  generateGuaranteedIssueRulesFromProducts,
  type GenerationStrategy,
  type KnockoutCondition,
  type GenerationResult,
} from "@/services/underwriting/repositories/generateRulesService";
import { ruleEngineKeys } from "./useRuleSets";

// ============================================================================
// Query Keys
// ============================================================================

export const generateRulesKeys = {
  all: ["generate-rules"] as const,
  knockoutCodes: () => [...generateRulesKeys.all, "knockout-codes"] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch available knockout condition codes
 */
export function useKnockoutCodes() {
  return useQuery({
    queryKey: generateRulesKeys.knockoutCodes(),
    queryFn: getAvailableKnockoutCodes,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - these are static
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Generate global knockout rule sets for a carrier
 */
export function useGenerateKnockoutRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { imo } = useImo();

  return useMutation({
    mutationFn: async ({
      carrierId,
      knockoutCodes,
      strategy = "skip_if_exists",
    }: {
      carrierId: string;
      knockoutCodes?: string[];
      strategy?: GenerationStrategy;
    }) => {
      if (!user?.id) throw new Error("User not authenticated");
      if (!imo?.id) throw new Error("No IMO selected");

      return generateKnockoutRules({
        carrierId,
        imoId: imo.id,
        userId: user.id,
        knockoutCodes,
        strategy,
      });
    },
    onSuccess: (_result, { carrierId }) => {
      // Invalidate rule sets cache for this carrier
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imo?.id, carrierId),
      });
      // Also invalidate the "needing review" list
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imo?.id),
      });
    },
  });
}

/**
 * Generate age eligibility rule sets from product metadata
 */
export function useGenerateAgeRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { imo } = useImo();

  return useMutation({
    mutationFn: async ({
      carrierId,
      productIds,
      strategy = "skip_if_exists",
    }: {
      carrierId: string;
      productIds?: string[];
      strategy?: GenerationStrategy;
    }) => {
      if (!user?.id) throw new Error("User not authenticated");
      if (!imo?.id) throw new Error("No IMO selected");

      return generateAgeRulesFromProducts({
        carrierId,
        imoId: imo.id,
        userId: user.id,
        productIds,
        strategy,
      });
    },
    onSuccess: (_result, { carrierId }) => {
      // Invalidate rule sets cache for this carrier
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imo?.id, carrierId),
      });
      // Also invalidate the "needing review" list
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imo?.id),
      });
    },
  });
}

/**
 * Generate guaranteed-issue draft rules for explicitly selected products.
 */
export function useGenerateGuaranteedIssueRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { imo } = useImo();

  return useMutation({
    mutationFn: async ({
      carrierId,
      productIds,
      strategy = "skip_if_exists",
    }: {
      carrierId: string;
      productIds: string[];
      strategy?: GenerationStrategy;
    }) => {
      if (!user?.id) throw new Error("User not authenticated");
      if (!imo?.id) throw new Error("No IMO selected");

      return generateGuaranteedIssueRulesFromProducts({
        carrierId,
        imoId: imo.id,
        productIds,
        strategy,
        userId: user.id,
      });
    },
    onSuccess: (_result, { carrierId }) => {
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.ruleSetsForCarrier(imo?.id, carrierId),
      });
      queryClient.invalidateQueries({
        queryKey: ruleEngineKeys.needingReview(imo?.id),
      });
    },
  });
}

// ============================================================================
// Types Re-export
// ============================================================================

export type { GenerationStrategy, KnockoutCondition, GenerationResult };
