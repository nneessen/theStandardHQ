// src/features/underwriting/hooks/useRates.ts
// React Query hooks for product rate table management

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getRatesForProduct,
  getRatesForCarrier,
  getRate,
  getProductsWithRates,
  upsertRate,
  bulkUpsertRates,
  deleteRate,
  deleteRatesForProduct,
  type RateEntryInput,
  type BulkRateEntry,
  type GenderType,
  type TobaccoClass,
  type HealthClass,
} from "@/services/underwriting/repositories/rateService";

// ============================================================================
// Query Keys
// ============================================================================

export const rateKeys = {
  all: ["rates"] as const,
  forProduct: (productId: string, imoId: string) =>
    [...rateKeys.all, "product", productId, imoId] as const,
  forCarrier: (carrierId: string, imoId: string) =>
    [...rateKeys.all, "carrier", carrierId, imoId] as const,
  lookup: (
    productId: string,
    age: number,
    gender: string,
    tobacco: string,
    health: string,
    imoId: string,
  ) =>
    [
      ...rateKeys.all,
      "lookup",
      productId,
      age,
      gender,
      tobacco,
      health,
      imoId,
    ] as const,
  productsWithRates: (imoId: string) =>
    [...rateKeys.all, "productsWithRates", imoId] as const,
};

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all rates for a specific product
 */
export function useProductRates(productId: string | undefined) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: rateKeys.forProduct(productId || "", imoId || ""),
    queryFn: () => getRatesForProduct(productId!, imoId!),
    enabled: !!productId && !!imoId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch all rates for a carrier (all products)
 */
export function useCarrierRates(carrierId: string | undefined) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: rateKeys.forCarrier(carrierId || "", imoId || ""),
    queryFn: () => getRatesForCarrier(carrierId!, imoId!),
    enabled: !!carrierId && !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Lookup a specific rate for a client profile
 */
export function useRateLookup(
  productId: string | undefined,
  age: number | undefined,
  gender: GenderType | undefined,
  tobaccoClass: TobaccoClass | undefined,
  healthClass: HealthClass | undefined,
) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: rateKeys.lookup(
      productId || "",
      age || 0,
      gender || "",
      tobaccoClass || "",
      healthClass || "",
      imoId || "",
    ),
    queryFn: () =>
      getRate(productId!, age!, gender!, tobaccoClass!, healthClass!, imoId!),
    enabled:
      !!productId &&
      !!age &&
      !!gender &&
      !!tobaccoClass &&
      !!healthClass &&
      !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get list of products that have rates entered
 */
export function useProductsWithRates() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: rateKeys.productsWithRates(imoId || ""),
    queryFn: () => getProductsWithRates(imoId!),
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Upsert a single rate entry
 */
export function useUpsertRate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;
  const userId = user?.id;

  return useMutation({
    mutationFn: (input: RateEntryInput) => {
      if (!imoId || !userId) {
        throw new Error("User not authenticated");
      }
      return upsertRate(input, imoId, userId);
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: rateKeys.forProduct(variables.productId, imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: rateKeys.productsWithRates(imoId || ""),
      });
    },
  });
}

/**
 * Bulk upsert rates for a product
 */
export function useBulkUpsertRates() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;
  const userId = user?.id;

  return useMutation({
    mutationFn: (input: BulkRateEntry) => {
      if (!imoId || !userId) {
        throw new Error("User not authenticated");
      }
      return bulkUpsertRates(input, imoId, userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: rateKeys.forProduct(variables.productId, imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: rateKeys.productsWithRates(imoId || ""),
      });
    },
  });
}

/**
 * Delete a single rate entry
 */
export function useDeleteRate() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      rateId,
      // productId is used by onSuccess via variables.productId
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      productId,
    }: {
      rateId: string;
      productId: string;
    }) => deleteRate(rateId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: rateKeys.forProduct(variables.productId, imoId || ""),
      });
    },
  });
}

/**
 * Delete all rates for a product
 */
export function useDeleteProductRates() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: (productId: string) => {
      if (!imoId) {
        throw new Error("User not authenticated");
      }
      return deleteRatesForProduct(productId, imoId);
    },
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({
        queryKey: rateKeys.forProduct(productId, imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: rateKeys.productsWithRates(imoId || ""),
      });
    },
  });
}
