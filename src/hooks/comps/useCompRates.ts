import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  compGuideService,
  CompGuideFormData,
} from "../../services/settings/comp-guide";
import { Database } from "../../types/database.types";

// TODO: multiple signautre issues

type CompGuideInsert = Database["public"]["Tables"]["comp_guide"]["Insert"];

// Query keys
export const compRatesKeys = {
  all: ["comp-rates"] as const,
  lists: () => [...compRatesKeys.all, "list"] as const,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic filter type
  list: (filters?: Record<string, any>) =>
    [...compRatesKeys.lists(), filters] as const,
  details: () => [...compRatesKeys.all, "detail"] as const,
  detail: (id: string) => [...compRatesKeys.details(), id] as const,
  byProduct: (productId: string) =>
    [...compRatesKeys.all, "product", productId] as const,
  byCarrier: (carrierId: string) =>
    [...compRatesKeys.all, "carrier", carrierId] as const,
};

/**
 * Fetch all comp rates with carrier information
 */
export function useCompRates() {
  return useQuery({
    queryKey: compRatesKeys.lists(),
    queryFn: async () => {
      const { data, error } = await compGuideService.getAllEntries();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/**
 * Fetch comp rates for a specific product
 */
export function useCompRatesByProduct(productId: string | undefined) {
  return useQuery({
    queryKey: productId
      ? compRatesKeys.byProduct(productId)
      : ["comp-rates", "empty"],
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } =
        await compGuideService.getEntriesByProduct(productId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!productId,
  });
}

/**
 * Fetch comp rates for a specific carrier
 */
export function useCompRatesByCarrier(carrierId: string | undefined) {
  return useQuery({
    queryKey: carrierId
      ? compRatesKeys.byCarrier(carrierId)
      : ["comp-rates", "empty"],
    queryFn: async () => {
      if (!carrierId) return [];
      const { data, error } =
        await compGuideService.getEntriesByCarrier(carrierId);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!carrierId,
  });
}

/**
 * Update a single comp rate
 */
export function useUpdateCompRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CompGuideFormData>;
    }) => {
      const { data, error } = await compGuideService.updateEntry(id, updates);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: compRatesKeys.all });
    },
  });
}

/**
 * Create a new comp rate entry
 */
export function useCreateCompRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: CompGuideFormData) => {
      const { data, error } = await compGuideService.createEntry(entry);
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: compRatesKeys.all });
    },
  });
}

/**
 * Delete a comp rate entry
 */
export function useDeleteCompRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await compGuideService.deleteEntry(id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: compRatesKeys.all });
    },
  });
}

/**
 * Bulk create comp rate entries (for new products)
 */
export function useBulkCreateCompRates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entries: CompGuideInsert[]) => {
      const result = await compGuideService.createBulkEntries(entries);
      if ("error" in result && result.error) {
        const err = result.error as Error;
        throw new Error(err.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: compRatesKeys.all });
    },
  });
}

/**
 * Bulk update comp rate entries
 */
export function useBulkUpdateCompRates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: Array<{ id: string; updates: Partial<CompGuideFormData> }>,
    ) => {
      const promises = updates.map(({ id, updates: data }) =>
        compGuideService.updateEntry(id, data),
      );
      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} entries`);
      }
      return results.map((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: compRatesKeys.all });
    },
  });
}
