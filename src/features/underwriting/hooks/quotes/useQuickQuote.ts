// src/features/underwriting/hooks/useQuickQuote.ts
// TanStack Query hooks for the quoting service

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useImo } from "@/contexts/ImoContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getQuotesForCoverage,
  getQuotesForBudget,
  getTopQuotes,
  type QuoteInput,
  type QuoteResult,
} from "@/services/underwriting/workflows/quotingService";
import {
  getAllPremiumMatricesForIMO,
  type PremiumMatrixWithCarrier,
} from "@/services/underwriting/repositories/premiumMatrixService";
import {
  quickQuotePresetsService,
  type QuickQuotePresets,
} from "@/services/underwriting/repositories/quickQuotePresetsService";

// Re-export types for convenience
export type {
  QuoteInput,
  QuoteResult,
  QuoteMode,
  EligibilityStatus,
  ProductType,
} from "@/services/underwriting/workflows/quotingService";

// ============================================================================
// Query Keys
// ============================================================================

export const quoteKeys = {
  all: ["quotes"] as const,
  coverage: (input: QuoteInput, imoId: string) =>
    [...quoteKeys.all, "coverage", input, imoId] as const,
  budget: (input: QuoteInput, imoId: string) =>
    [...quoteKeys.all, "budget", input, imoId] as const,
  // Quick Quote - all premium matrices for instant calculations
  allMatrices: (imoId: string) =>
    [...quoteKeys.all, "all-matrices", imoId] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for coverage-first quoting mode.
 * Returns quotes for a fixed coverage amount.
 *
 * Usage:
 * ```tsx
 * const { data: quotes, isLoading, error } = useQuotesForCoverage(input, {
 *   enabled: input.faceAmount > 0
 * });
 * ```
 */
export function useQuotesForCoverage(
  input: QuoteInput | null,
  options?: { enabled?: boolean },
) {
  const { imo } = useImo();
  const imoId = imo?.id ?? "";

  return useQuery({
    queryKey: quoteKeys.coverage(input ?? ({} as QuoteInput), imoId),
    queryFn: () => {
      if (!input || !imoId) {
        throw new Error("Input and IMO ID are required");
      }
      return getQuotesForCoverage(input, imoId);
    },
    enabled:
      !!input &&
      !!imoId &&
      input.mode === "coverage" &&
      !!input.faceAmount &&
      input.faceAmount > 0 &&
      options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for budget-first quoting mode.
 * Returns quotes with max coverage within budget.
 *
 * Usage:
 * ```tsx
 * const { data: quotes, isLoading, error } = useQuotesForBudget(input, {
 *   enabled: input.monthlyBudget > 0
 * });
 * ```
 */
export function useQuotesForBudget(
  input: QuoteInput | null,
  options?: { enabled?: boolean },
) {
  const { imo } = useImo();
  const imoId = imo?.id ?? "";

  return useQuery({
    queryKey: quoteKeys.budget(input ?? ({} as QuoteInput), imoId),
    queryFn: () => {
      if (!input || !imoId) {
        throw new Error("Input and IMO ID are required");
      }
      return getQuotesForBudget(input, imoId);
    },
    enabled:
      !!input &&
      !!imoId &&
      input.mode === "budget" &&
      !!input.monthlyBudget &&
      input.monthlyBudget > 0 &&
      options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Unified hook that automatically selects the correct mode.
 * Use this when you want a single hook that handles both modes.
 *
 * Usage:
 * ```tsx
 * const { data: quotes, isLoading, error } = useQuotes(input);
 * ```
 */
export function useQuotes(
  input: QuoteInput | null,
  options?: { enabled?: boolean },
) {
  const { imo } = useImo();
  const imoId = imo?.id ?? "";

  const isCoverageMode = input?.mode === "coverage";
  const isBudgetMode = input?.mode === "budget";

  const coverageQuery = useQuery({
    queryKey: quoteKeys.coverage(input ?? ({} as QuoteInput), imoId),
    queryFn: () => {
      if (!input || !imoId) {
        throw new Error("Input and IMO ID are required");
      }
      return getQuotesForCoverage(input, imoId);
    },
    enabled:
      !!input &&
      !!imoId &&
      isCoverageMode &&
      !!input.faceAmount &&
      input.faceAmount > 0 &&
      options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });

  const budgetQuery = useQuery({
    queryKey: quoteKeys.budget(input ?? ({} as QuoteInput), imoId),
    queryFn: () => {
      if (!input || !imoId) {
        throw new Error("Input and IMO ID are required");
      }
      return getQuotesForBudget(input, imoId);
    },
    enabled:
      !!input &&
      !!imoId &&
      isBudgetMode &&
      !!input.monthlyBudget &&
      input.monthlyBudget > 0 &&
      options?.enabled !== false,
    staleTime: 5 * 60 * 1000,
  });

  // Return the active query based on mode
  if (isBudgetMode) {
    return budgetQuery;
  }
  return coverageQuery;
}

/**
 * Mutation hook for on-demand quote generation.
 * Useful when you want explicit control over when quotes are fetched.
 *
 * Usage:
 * ```tsx
 * const quoteMutation = useQuoteMutation();
 *
 * // Trigger quote generation
 * quoteMutation.mutate(input);
 *
 * // Access results
 * quoteMutation.data // QuoteResult[]
 * ```
 */
export function useQuoteMutation() {
  const { imo } = useImo();
  const imoId = imo?.id ?? "";

  return useMutation<QuoteResult[], Error, QuoteInput>({
    mutationFn: async (input) => {
      if (!imoId) {
        throw new Error("IMO ID is required");
      }
      if (input.mode === "budget") {
        return getQuotesForBudget(input, imoId);
      }
      return getQuotesForCoverage(input, imoId);
    },
    onError: (error) => {
      console.error("Quote generation error:", error);
    },
  });
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook that returns top quotes by different criteria.
 * Wraps the base hook and applies getTopQuotes utility.
 *
 * Usage:
 * ```tsx
 * const { topQuotes, isLoading, error } = useTopQuotes(input, 3);
 * // topQuotes.byScore - best overall
 * // topQuotes.byPrice - cheapest
 * // topQuotes.byCoverage - highest coverage
 * ```
 */
export function useTopQuotes(input: QuoteInput | null, count: number = 3) {
  const { data: quotes, isLoading, error, refetch } = useQuotes(input);

  const topQuotes = quotes ? getTopQuotes(quotes, count) : null;

  return {
    topQuotes,
    allQuotes: quotes ?? [],
    isLoading,
    error,
    refetch,
  };
}

// ============================================================================
// Quick Quote Hooks (Blazingly Fast - Pre-fetch Strategy)
// ============================================================================

/**
 * Pre-fetch ALL premium matrices for the IMO.
 * This enables instant in-memory calculations for Quick Quote.
 *
 * - Fetches once on component mount
 * - Long cache duration (rates don't change often)
 * - Subsequent calculations are pure functions with no DB calls
 *
 * Usage:
 * ```tsx
 * const { data: matrices, isLoading } = useAllPremiumMatrices();
 *
 * // Then calculate quotes instantly with useMemo:
 * const quotes = useMemo(() => {
 *   if (!matrices) return [];
 *   return calculateQuotesForCoverage(matrices, input, amounts);
 * }, [matrices, input, amounts]);
 * ```
 */
export function useAllPremiumMatrices(): {
  data: PremiumMatrixWithCarrier[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { imo } = useImo();
  const imoId = imo?.id ?? "";

  const query = useQuery({
    queryKey: quoteKeys.allMatrices(imoId),
    queryFn: () => getAllPremiumMatricesForIMO(imoId),
    enabled: !!imoId,
    staleTime: 10 * 60 * 1000, // 10 minutes - rates rarely change
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// Quick Quote Presets Hooks
// ============================================================================

export const presetKeys = {
  all: ["quick-quote-presets"] as const,
  user: (userId: string) => [...presetKeys.all, userId] as const,
};

/**
 * Hook to fetch the current user's Quick Quote presets.
 */
export function useQuickQuotePresets() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery<QuickQuotePresets | null>({
    queryKey: presetKeys.user(userId),
    queryFn: () => quickQuotePresetsService.getPresets(userId),
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Mutation hook to upsert the current user's Quick Quote presets.
 */
export function useUpdatePresets() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  return useMutation<QuickQuotePresets, Error, Partial<QuickQuotePresets>>({
    mutationFn: (presets) => {
      if (!userId) throw new Error("User not authenticated");
      return quickQuotePresetsService.upsertPresets(userId, presets);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: presetKeys.user(userId) });
    },
  });
}
