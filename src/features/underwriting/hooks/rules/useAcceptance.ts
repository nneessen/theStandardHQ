// src/features/underwriting/hooks/useAcceptance.ts
// React Query hooks for carrier condition acceptance rules

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAcceptanceForCarrier,
  getAcceptanceForCondition,
  getAllAcceptanceRules,
  lookupAcceptance,
  getCarriersWithAcceptanceRules,
  getHealthConditions,
  upsertAcceptanceRule,
  bulkUpsertAcceptanceRules,
  deleteAcceptanceRule,
  deleteAcceptanceForCarrier,
  type AcceptanceRuleInput,
} from "@/services/underwriting/repositories/acceptanceService";

// ============================================================================
// Query Keys
// ============================================================================

export const acceptanceKeys = {
  all: ["acceptance"] as const,
  forCarrier: (carrierId: string, imoId: string) =>
    [...acceptanceKeys.all, "carrier", carrierId, imoId] as const,
  forCondition: (conditionCode: string, imoId: string) =>
    [...acceptanceKeys.all, "condition", conditionCode, imoId] as const,
  allRules: (imoId: string) =>
    [...acceptanceKeys.all, "allRules", imoId] as const,
  lookup: (
    carrierId: string,
    conditionCode: string,
    imoId: string,
    productType?: string,
  ) =>
    [
      ...acceptanceKeys.all,
      "lookup",
      carrierId,
      conditionCode,
      imoId,
      productType || "all",
    ] as const,
  carriersWithRules: (imoId: string) =>
    [...acceptanceKeys.all, "carriersWithRules", imoId] as const,
  healthConditions: () => [...acceptanceKeys.all, "healthConditions"] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all acceptance rules for a carrier
 */
export function useCarrierAcceptance(carrierId: string | undefined) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: acceptanceKeys.forCarrier(carrierId || "", imoId || ""),
    queryFn: () => getAcceptanceForCarrier(carrierId!, imoId!),
    enabled: !!carrierId && !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch all acceptance rules for a condition
 */
export function useConditionAcceptance(conditionCode: string | undefined) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: acceptanceKeys.forCondition(conditionCode || "", imoId || ""),
    queryFn: () => getAcceptanceForCondition(conditionCode!, imoId!),
    enabled: !!conditionCode && !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch all acceptance rules for the IMO
 */
export function useAllAcceptanceRules() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: acceptanceKeys.allRules(imoId || ""),
    queryFn: () => getAllAcceptanceRules(imoId!),
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Lookup a specific acceptance rule
 */
export function useAcceptanceLookup(
  carrierId: string | undefined,
  conditionCode: string | undefined,
  productType?: string,
) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: acceptanceKeys.lookup(
      carrierId || "",
      conditionCode || "",
      imoId || "",
      productType,
    ),
    queryFn: () =>
      lookupAcceptance(carrierId!, conditionCode!, imoId!, productType),
    enabled: !!carrierId && !!conditionCode && !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get list of carriers that have acceptance rules
 */
export function useCarriersWithAcceptanceRules() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: acceptanceKeys.carriersWithRules(imoId || ""),
    queryFn: () => getCarriersWithAcceptanceRules(imoId!),
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get all health conditions for the selector
 */
export function useHealthConditions() {
  return useQuery({
    queryKey: acceptanceKeys.healthConditions(),
    queryFn: getHealthConditions,
    staleTime: 30 * 60 * 1000, // 30 minutes - these rarely change
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Upsert an acceptance rule
 */
export function useUpsertAcceptanceRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;
  const userId = user?.id;

  return useMutation({
    mutationFn: (input: AcceptanceRuleInput) => {
      if (!imoId || !userId) {
        throw new Error("User not authenticated");
      }
      return upsertAcceptanceRule(input, imoId, userId);
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.forCarrier(variables.carrierId, imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.forCondition(
          variables.conditionCode,
          imoId || "",
        ),
      });
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.allRules(imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.carriersWithRules(imoId || ""),
      });
    },
  });
}

/**
 * Bulk upsert acceptance rules
 */
export function useBulkUpsertAcceptanceRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;
  const userId = user?.id;

  return useMutation({
    mutationFn: (rules: AcceptanceRuleInput[]) => {
      if (!imoId || !userId) {
        throw new Error("User not authenticated");
      }
      return bulkUpsertAcceptanceRules(rules, imoId, userId);
    },
    onSuccess: () => {
      // Invalidate all acceptance queries
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.all,
      });
    },
  });
}

/**
 * Delete an acceptance rule
 */
export function useDeleteAcceptanceRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      ruleId,
      // carrierId is used by onSuccess via variables.carrierId
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      carrierId,
    }: {
      ruleId: string;
      carrierId: string;
    }) => {
      if (!imoId) {
        throw new Error("User must have an IMO to delete acceptance rules");
      }
      return deleteAcceptanceRule(ruleId, imoId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.forCarrier(variables.carrierId, imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.allRules(imoId || ""),
      });
    },
  });
}

/**
 * Delete all acceptance rules for a carrier
 */
export function useDeleteCarrierAcceptance() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: (carrierId: string) => {
      if (!imoId) {
        throw new Error("User not authenticated");
      }
      return deleteAcceptanceForCarrier(carrierId, imoId);
    },
    onSuccess: (_, carrierId) => {
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.forCarrier(carrierId, imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.allRules(imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: acceptanceKeys.carriersWithRules(imoId || ""),
      });
    },
  });
}
