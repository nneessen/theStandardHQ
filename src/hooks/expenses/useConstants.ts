// src/hooks/expenses/useConstants.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logger } from "../../services/base/logger";
// Define Constants type locally since it's not exported from expense.types
interface Constants {
  avgAP: number;
  target1: number;
  target2: number;
  [key: string]: number; // Allow indexing
}
import { constantsService } from "../../services";
import { useImo } from "../../contexts/ImoContext";

const DEFAULT_CONSTANTS: Constants = {
  avgAP: 0,
  target1: 0,
  target2: 0,
};

export type UseConstantsResult = ReturnType<typeof useConstants>;

/**
 * Hook to fetch and manage constants using TanStack Query
 * Returns standard TanStack Query result with data property
 */
export function useConstants() {
  const { imo } = useImo();

  return useQuery({
    queryKey: ["constants", imo?.id ?? "no-imo"],
    queryFn: async () => {
      try {
        const data = await constantsService.getAll();
        return data;
      } catch (err) {
        logger.error(
          "Error loading constants",
          err instanceof Error ? err : String(err),
          "Migration",
        );
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: DEFAULT_CONSTANTS, // Use default constants while loading
  });
}

/**
 * Mutation hook to update a single constant
 */
export function useUpdateConstant() {
  const queryClient = useQueryClient();
  const { imo } = useImo();

  return useMutation({
    mutationFn: async ({
      field,
      value,
    }: {
      field: keyof Constants;
      value: number;
    }) => {
      // Validate value
      if (value < 0) {
        throw new Error(`${field} cannot be negative`);
      }

      await constantsService.setValue(String(field), value);
      return { field, value };
    },
    onSuccess: (data) => {
      // Optimistically update the cache
      queryClient.setQueryData(
        ["constants", imo?.id ?? "no-imo"],
        (old: Constants | undefined) => {
          if (!old) return DEFAULT_CONSTANTS;
          return {
            ...old,
            [data.field]: data.value,
          };
        },
      );
    },
    onError: (err) => {
      logger.error(
        "Error updating constant",
        err instanceof Error ? err : String(err),
        "Migration",
      );
    },
  });
}

/**
 * Mutation hook to reset all constants to defaults
 */
export function useResetConstants() {
  const queryClient = useQueryClient();
  const { imo } = useImo();

  return useMutation({
    mutationFn: async () => {
      const updatedConstants = await constantsService.updateMultiple(
        Object.entries(DEFAULT_CONSTANTS).map(([key, value]) => ({
          key: String(key),
          value,
        })),
      );
      return updatedConstants;
    },
    onSuccess: (data) => {
      // Update the cache with the reset constants
      queryClient.setQueryData(["constants", imo?.id ?? "no-imo"], data);
    },
    onError: (err) => {
      logger.error(
        "Error resetting constants",
        err instanceof Error ? err : String(err),
        "Migration",
      );
    },
  });
}
