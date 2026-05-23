// /home/nneessen/projects/commissionTracker/src/hooks/carriers/useCarriers.ts
import { logger } from "../../services/base/logger";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { carrierService } from "../../services/settings/carriers";
import { NewCarrierForm } from "../../types/carrier.types";
import { useImo } from "../../contexts/ImoContext";

// Query keys for React Query cache management
export const carrierQueryKeys = {
  all: ["carriers"] as const,
  lists: () => [...carrierQueryKeys.all, "list"] as const,
  list: () => [...carrierQueryKeys.lists()] as const,
  detail: (id: string) => [...carrierQueryKeys.all, "detail", id] as const,
  active: () => [...carrierQueryKeys.all, "active"] as const,
  byName: (name: string) => [...carrierQueryKeys.all, "byName", name] as const,
  search: (term: string) => [...carrierQueryKeys.all, "search", term] as const,
};

/**
 * Hook to fetch all carriers
 */
export function useCarriers(options?: {
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
}) {
  const { imo } = useImo();
  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus = false,
  } = options || {};

  return useQuery({
    queryKey: [...carrierQueryKeys.list(), imo?.id ?? "no-imo"],
    queryFn: async () => {
      const result = await carrierService.getAll();
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error?.message || "Failed to fetch carriers");
    },
    enabled,
    staleTime,
    refetchOnWindowFocus,
  });
}

/**
 * Hook to fetch a carrier by ID
 */
export function useCarrier(
  id: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  },
) {
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options || {};

  return useQuery({
    queryKey: carrierQueryKeys.detail(id),
    queryFn: async () => {
      const result = await carrierService.getById(id);
      if (result.success) {
        return result.data;
      }
      throw new Error(result.error?.message || "Failed to fetch carrier");
    },
    enabled: enabled && !!id,
    staleTime,
  });
}

/**
 * Hook to fetch active carriers only
 */
export function useActiveCarriers(options?: {
  enabled?: boolean;
  staleTime?: number;
}) {
  const { imo } = useImo();
  const { enabled = true, staleTime = 5 * 60 * 1000 } = options || {};

  return useQuery({
    queryKey: [...carrierQueryKeys.active(), imo?.id ?? "no-imo"],
    queryFn: async () => {
      const result = await carrierService.getActive();
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(
        result.error?.message || "Failed to fetch active carriers",
      );
    },
    enabled,
    staleTime,
  });
}

/**
 * Hook to search carriers by name
 */
export function useSearchCarriers(
  searchTerm: string,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  },
) {
  const { imo } = useImo();
  const {
    enabled = true,
    staleTime = 30 * 1000, // 30 seconds for search results
  } = options || {};

  return useQuery({
    queryKey: [...carrierQueryKeys.search(searchTerm), imo?.id ?? "no-imo"],
    queryFn: async () => {
      if (!searchTerm.trim()) {
        return [];
      }
      const result = await carrierService.search(searchTerm);
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error?.message || "Failed to search carriers");
    },
    enabled: enabled && searchTerm.length > 0,
    staleTime,
  });
}

/**
 * Hook to create a new carrier
 */
export function useCreateCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: NewCarrierForm) => {
      const result = await carrierService.createFromForm(data);
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error?.message || "Failed to create carrier");
    },
    onSuccess: (newCarrier) => {
      // Invalidate and refetch carriers list
      queryClient.invalidateQueries({ queryKey: carrierQueryKeys.lists() });
      // Add the new carrier to the cache
      queryClient.setQueryData(
        carrierQueryKeys.detail(newCarrier.id),
        newCarrier,
      );
    },
    onError: (error) => {
      logger.error(
        "Error creating carrier",
        error instanceof Error ? error : String(error),
        "Migration",
      );
    },
  });
}

/**
 * Hook to update a carrier
 */
export function useUpdateCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<NewCarrierForm>;
    }) => {
      const result = await carrierService.updateFromForm(id, data);
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error?.message || "Failed to update carrier");
    },
    onSuccess: (updatedCarrier) => {
      // Update the specific carrier in cache
      queryClient.setQueryData(
        carrierQueryKeys.detail(updatedCarrier.id),
        updatedCarrier,
      );
      // Invalidate lists to ensure they're fresh
      queryClient.invalidateQueries({ queryKey: carrierQueryKeys.lists() });
    },
    onError: (error) => {
      logger.error(
        "Error updating carrier",
        error instanceof Error ? error : String(error),
        "Migration",
      );
    },
  });
}

/**
 * Hook to delete a carrier
 */
export function useDeleteCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await carrierService.delete(id);
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to delete carrier");
      }
    },
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: carrierQueryKeys.detail(deletedId),
      });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: carrierQueryKeys.lists() });
    },
    onError: (error) => {
      logger.error(
        "Error deleting carrier",
        error instanceof Error ? error : String(error),
        "Migration",
      );
    },
  });
}
