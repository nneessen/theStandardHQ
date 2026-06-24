// src/features/policies/hooks/useCreatePolicy.ts
// Hook for creating a new policy

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { policyService } from "@/services/policies/policyService";
import { policyKeys } from "../queries";
import type { CreatePolicyData, Policy } from "@/types/policy.types";

import { chatBotApi } from "@/features/chat-bot/hooks/useChatBot";

/**
 * Create a new policy
 *
 * @returns Mutation with mutate/mutateAsync functions
 *
 * @example
 * const createPolicy = useCreatePolicy();
 * createPolicy.mutate(policyData, { onSuccess: (policy) => { ... } });
 */
export function useCreatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newPolicy: CreatePolicyData): Promise<Policy> => {
      return policyService.create(newPolicy);
    },
    onSuccess: (newPolicy) => {
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: policyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: policyKeys.count() });
      queryClient.invalidateQueries({ queryKey: policyKeys.metrics() });
      queryClient.invalidateQueries({
        queryKey: policyKeys.dashboardMetrics(),
      });
      // Also invalidate commissions (policy creation may create commission)
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      // Set the new policy in detail cache
      queryClient.setQueryData(policyKeys.detail(newPolicy.id), newPolicy);

      // Non-blocking: check if this policy matches a bot conversation
      chatBotApi("check_attribution", { policyId: newPolicy.id }).catch(
        () => {},
      );
    },
  });
}
