// src/features/policies/hooks/useDeletePolicy.ts
// Hook for deleting a policy with optimistic updates and error handling

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { policyService } from "@/services/policies/policyService";
import { policyKeys } from "../queries";
import type { Policy } from "@/types/policy.types";
import { toast } from "sonner";

/**
 * Delete a policy with optimistic updates
 *
 * Features:
 * - Optimistic removal from list cache for instant UI feedback
 * - Automatic rollback on error
 * - Toast notifications for success/error
 *
 * @returns Mutation with mutate/mutateAsync functions
 *
 * @example
 * const deletePolicy = useDeletePolicy();
 * deletePolicy.mutate(policyId, { onSuccess: () => { ... } });
 */
export function useDeletePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string): Promise<void> => {
      return policyService.delete(id);
    },

    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: policyKeys.lists() });

      // Snapshot previous list data for rollback
      const previousListQueries = queryClient.getQueriesData<Policy[]>({
        queryKey: policyKeys.lists(),
      });

      // Optimistically remove from all list caches
      queryClient.setQueriesData<Policy[]>(
        { queryKey: policyKeys.lists() },
        (old) => {
          if (!old) return old;
          return old.filter((policy) => policy.id !== deletedId);
        },
      );

      // Return context for rollback
      return { previousListQueries };
    },

    onSuccess: (_, deletedId) => {
      // Invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: policyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: policyKeys.count() });
      queryClient.invalidateQueries({ queryKey: policyKeys.metrics() });
      queryClient.invalidateQueries({
        queryKey: policyKeys.dashboardMetrics(),
      });

      // Remove from detail cache
      queryClient.removeQueries({ queryKey: policyKeys.detail(deletedId) });

      // Also invalidate commissions (cascade delete from trigger)
      queryClient.invalidateQueries({ queryKey: ["commissions"] });

      // Also invalidate clients (may be deleted by trigger if orphaned)
      queryClient.invalidateQueries({ queryKey: ["clients"] });

      toast.success("Policy deleted successfully");
    },

    onError: (error, _deletedId, context) => {
      // Rollback optimistic update on error
      if (context?.previousListQueries) {
        context.previousListQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      const message =
        error instanceof Error ? error.message : "Failed to delete policy";
      toast.error(message);
    },
  });
}

/**
 * Check if a policy shares its client with other policies
 * Use this before deletion to warn the user
 */
export function useCheckSharedClient() {
  return useMutation({
    mutationFn: (policyId: string) => policyService.checkSharedClient(policyId),
  });
}
