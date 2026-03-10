// src/features/underwriting/hooks/usePremiumMatrix.ts
// React Query hooks for premium matrix management

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPremiumMatrixForProduct,
  getPremiumMatrixForClassification,
  getProductsWithPremiumMatrix,
  getTermYearsForProduct,
  bulkUpsertPremiumMatrix,
  deletePremiumMatrixEntry,
  deletePremiumMatrixForProduct,
  deletePremiumMatrixForTerm,
  interpolatePremium,
  type BulkPremiumEntry,
  type GenderType,
  type TobaccoClass,
  type HealthClass,
  type TermYears,
} from "@/services/underwriting/repositories/premiumMatrixService";

// =============================================================================
// Query Keys
// =============================================================================

export const premiumMatrixKeys = {
  all: ["premium-matrix"] as const,
  forProduct: (productId: string, imoId: string) =>
    [...premiumMatrixKeys.all, "product", productId, imoId] as const,
  forClassification: (
    productId: string,
    gender: string,
    tobacco: string,
    health: string,
    imoId: string,
    termYears?: number | null,
  ) =>
    [
      ...premiumMatrixKeys.all,
      "classification",
      productId,
      gender,
      tobacco,
      health,
      imoId,
      termYears ?? "none",
    ] as const,
  productsWithMatrix: (imoId: string) =>
    [...premiumMatrixKeys.all, "products", imoId] as const,
  termYears: (productId: string, imoId: string) =>
    [...premiumMatrixKeys.all, "termYears", productId, imoId] as const,
};

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Fetch all premium matrix entries for a product
 */
export function usePremiumMatrix(productId: string | undefined) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: premiumMatrixKeys.forProduct(productId || "", imoId || ""),
    queryFn: () => getPremiumMatrixForProduct(productId!, imoId!),
    enabled: !!productId && !!imoId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch premium matrix entries for a specific classification
 * For term products, pass termYears; for non-term products, pass null/undefined
 */
export function usePremiumMatrixForClassification(
  productId: string | undefined,
  gender: GenderType | undefined,
  tobaccoClass: TobaccoClass | undefined,
  healthClass: HealthClass | undefined,
  termYears?: TermYears | null,
) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: premiumMatrixKeys.forClassification(
      productId || "",
      gender || "",
      tobaccoClass || "",
      healthClass || "",
      imoId || "",
      termYears,
    ),
    queryFn: () =>
      getPremiumMatrixForClassification(
        productId!,
        gender!,
        tobaccoClass!,
        healthClass!,
        imoId!,
        termYears,
      ),
    enabled:
      !!productId && !!gender && !!tobaccoClass && !!healthClass && !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get list of products that have premium matrix entries
 */
export function useProductsWithPremiumMatrix() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: premiumMatrixKeys.productsWithMatrix(imoId || ""),
    queryFn: () => getProductsWithPremiumMatrix(imoId!),
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get available term years for a product
 */
export function useTermYearsForProduct(productId: string | undefined) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: premiumMatrixKeys.termYears(productId || "", imoId || ""),
    queryFn: () => getTermYearsForProduct(productId!, imoId!),
    enabled: !!productId && !!imoId,
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Bulk upsert premium matrix entries
 */
export function useBulkUpsertPremiumMatrix() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;
  const userId = user?.id;

  return useMutation({
    mutationFn: (input: BulkPremiumEntry) => {
      if (!imoId || !userId) {
        throw new Error("User not authenticated");
      }
      return bulkUpsertPremiumMatrix(input, imoId, userId);
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: premiumMatrixKeys.forProduct(
          variables.productId,
          imoId || "",
        ),
      });
      queryClient.invalidateQueries({
        queryKey: premiumMatrixKeys.forClassification(
          variables.productId,
          variables.gender,
          variables.tobaccoClass,
          variables.healthClass,
          imoId || "",
          variables.termYears,
        ),
      });
      queryClient.invalidateQueries({
        queryKey: premiumMatrixKeys.productsWithMatrix(imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: premiumMatrixKeys.termYears(variables.productId, imoId || ""),
      });
    },
  });
}

/**
 * Delete a single premium matrix entry
 */
export function useDeletePremiumMatrixEntry() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      entryId,
      // productId is used by onSuccess via variables.productId
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      productId,
    }: {
      entryId: string;
      productId: string;
    }) => deletePremiumMatrixEntry(entryId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: premiumMatrixKeys.forProduct(
          variables.productId,
          imoId || "",
        ),
      });
    },
  });
}

/**
 * Delete all premium matrix entries for a product
 */
export function useDeleteProductPremiumMatrix() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: (productId: string) => {
      if (!imoId) {
        throw new Error("User not authenticated");
      }
      return deletePremiumMatrixForProduct(productId, imoId);
    },
    onSuccess: (_, productId) => {
      queryClient.invalidateQueries({
        queryKey: premiumMatrixKeys.forProduct(productId, imoId || ""),
      });
      queryClient.invalidateQueries({
        queryKey: premiumMatrixKeys.productsWithMatrix(imoId || ""),
      });
    },
  });
}

/**
 * Delete premium matrix entries for a specific term
 */
export function useDeleteTermPremiumMatrix() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useMutation({
    mutationFn: ({
      productId,
      termYears,
    }: {
      productId: string;
      termYears: TermYears;
    }) => {
      if (!imoId) {
        throw new Error("User not authenticated");
      }
      return deletePremiumMatrixForTerm(productId, termYears, imoId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: premiumMatrixKeys.forProduct(
          variables.productId,
          imoId || "",
        ),
      });
      queryClient.invalidateQueries({
        queryKey: premiumMatrixKeys.termYears(variables.productId, imoId || ""),
      });
    },
  });
}

// =============================================================================
// Premium Estimation Hook
// =============================================================================

/**
 * Estimate premium using interpolation from available data
 */
export function useEstimatePremium(
  productId: string | undefined,
  age: number | undefined,
  faceAmount: number | undefined,
  gender: GenderType | undefined,
  tobaccoClass: TobaccoClass | undefined,
  healthClass: HealthClass | undefined,
  termYears?: TermYears | null,
) {
  const { data: matrix } = usePremiumMatrix(productId);

  if (
    !matrix ||
    !age ||
    !faceAmount ||
    !gender ||
    !tobaccoClass ||
    !healthClass
  ) {
    return { premium: null, isInterpolated: false };
  }

  // Check for exact match first
  const exactMatch = matrix.find(
    (m) =>
      m.age === age &&
      m.face_amount === faceAmount &&
      m.gender === gender &&
      m.tobacco_class === tobaccoClass &&
      m.health_class === healthClass &&
      (termYears ? m.term_years === termYears : m.term_years === null),
  );

  if (exactMatch) {
    return {
      premium: Number(exactMatch.monthly_premium),
      isInterpolated: false,
    };
  }

  // Use interpolation with health class fallback
  const result = interpolatePremium(
    matrix,
    age,
    faceAmount,
    gender,
    tobaccoClass,
    healthClass,
    termYears,
  );

  // Extract premium from result (health class fallback is handled internally)
  return { premium: result.premium, isInterpolated: result.premium !== null };
}
