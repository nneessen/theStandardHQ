// src/features/policies/hooks/useUpdatePolicy.ts
// Hook for updating a policy (including lifecycle status changes like cancel/lapse/reinstate)

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { policyService } from "@/services/policies/policyService";
import { commissionService } from "@/services/commissions/commissionService";
import { policyKeys } from "../queries";
import { leadPurchaseKeys } from "@/hooks/lead-purchases";
import type { CreatePolicyData, Policy } from "@/types/policy.types";
import type { Commission } from "@/types/commission.types";

// Basic update params
interface BasicUpdateParams {
  id: string;
  updates: Partial<CreatePolicyData>;
}

// Cancel-specific params - operates on lifecycle_status
interface CancelParams {
  id: string;
  lifecycleStatus: "cancelled";
  reason: string;
  cancelDate?: Date;
}

// Lapse-specific params - operates on lifecycle_status
interface LapseParams {
  id: string;
  lifecycleStatus: "lapsed";
  lapseDate?: Date;
  reason?: string;
}

// Reinstate-specific params - operates on lifecycle_status
interface ReinstateParams {
  id: string;
  lifecycleStatus: "active";
  previousLifecycleStatus: "cancelled" | "lapsed";
  reason: string;
}

export type UpdatePolicyParams =
  | BasicUpdateParams
  | CancelParams
  | LapseParams
  | ReinstateParams;

// Type guards
function isCancelParams(params: UpdatePolicyParams): params is CancelParams {
  return (
    "lifecycleStatus" in params &&
    params.lifecycleStatus === "cancelled" &&
    "reason" in params
  );
}

function isLapseParams(params: UpdatePolicyParams): params is LapseParams {
  return "lifecycleStatus" in params && params.lifecycleStatus === "lapsed";
}

function isReinstateParams(
  params: UpdatePolicyParams,
): params is ReinstateParams {
  return (
    "lifecycleStatus" in params &&
    params.lifecycleStatus === "active" &&
    "previousLifecycleStatus" in params
  );
}

function isBasicUpdateParams(
  params: UpdatePolicyParams,
): params is BasicUpdateParams {
  return "updates" in params;
}

/**
 * Checks if any fields that affect commission calculation have changed
 * This triggers commission recalculation when premium, carrier, product, or the
 * (manually entered) commission percentage changes.
 *
 * commissionPercentage is included so the documented manual-commission workflow
 * works end-to-end: an agent can save a policy with a blank/0 commission ($0
 * advance) and later edit just the % to populate the advance.
 */
function requiresCommissionRecalc(updates: Partial<CreatePolicyData>): boolean {
  return (
    updates.annualPremium !== undefined ||
    updates.monthlyPremium !== undefined ||
    updates.carrierId !== undefined ||
    updates.productId !== undefined ||
    updates.product !== undefined ||
    updates.commissionPercentage !== undefined
  );
}

/**
 * Checks if carrier or product changed - requires full recalculation from comp_guide
 * because commission rate may be different
 */
function hasCarrierOrProductChange(
  updates: Partial<CreatePolicyData>,
): boolean {
  return (
    updates.carrierId !== undefined ||
    updates.productId !== undefined ||
    updates.product !== undefined
  );
}

/**
 * Update a policy - handles all update types including lifecycle status changes
 *
 * NOTE: Commission status is now DECOUPLED from policy status.
 * Commission status changes happen automatically via database triggers when
 * lifecycle_status changes, but are otherwise independently controlled.
 *
 * For basic field updates:
 * @example
 * updatePolicy.mutate({ id: policyId, updates: { notes: 'New note' } });
 *
 * For cancellation (lifecycle):
 * @example
 * updatePolicy.mutate({ id: policyId, lifecycleStatus: 'cancelled', reason: 'Client request' });
 *
 * For lapse (lifecycle):
 * @example
 * updatePolicy.mutate({ id: policyId, lifecycleStatus: 'lapsed', reason: 'Non-payment' });
 *
 * For reinstatement (lifecycle):
 * @example
 * updatePolicy.mutate({ id: policyId, lifecycleStatus: 'active', previousLifecycleStatus: 'cancelled', reason: 'Client paid' });
 */
export function useUpdatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdatePolicyParams): Promise<Policy> => {
      // Route to appropriate service method based on params
      if (isCancelParams(params)) {
        const result = await policyService.cancelPolicy(
          params.id,
          params.reason,
          params.cancelDate,
        );
        return result.policy;
      }

      if (isLapseParams(params)) {
        const result = await policyService.lapsePolicy(
          params.id,
          params.lapseDate,
          params.reason,
        );
        return result.policy;
      }

      if (isReinstateParams(params)) {
        // reinstatePolicy returns Policy directly (not wrapped)
        return policyService.reinstatePolicy(params.id, params.reason);
      }

      // Basic update
      return policyService.update(params.id, params.updates);
    },
    onSuccess: async (updatedPolicy, params) => {
      // Always invalidate list and metrics
      queryClient.invalidateQueries({ queryKey: policyKeys.lists() });
      queryClient.invalidateQueries({ queryKey: policyKeys.count() });
      queryClient.invalidateQueries({ queryKey: policyKeys.metrics() });

      // Update detail cache
      queryClient.setQueryData(
        policyKeys.detail(updatedPolicy.id),
        updatedPolicy,
      );

      // If premium, carrier, or product changed, recalculate the commission
      if (
        isBasicUpdateParams(params) &&
        requiresCommissionRecalc(params.updates)
      ) {
        try {
          const newAnnualPremium =
            params.updates.annualPremium ?? updatedPolicy.annualPremium;
          const newMonthlyPremium =
            params.updates.monthlyPremium ?? updatedPolicy.monthlyPremium;

          // Determine if we need full recalculation (carrier/product changed)
          const fullRecalculate = hasCarrierOrProductChange(params.updates);

          // Recalculate commission with new values
          const result =
            await commissionService.recalculateCommissionByPolicyId(
              updatedPolicy.id,
              newAnnualPremium,
              newMonthlyPremium,
              fullRecalculate,
            );

          // Update cache with new commission data
          if (result) {
            const allQueries = queryClient.getQueriesData({
              queryKey: ["commissions"],
            });

            // Update ALL commission queries that match
            allQueries.forEach(([queryKey, existingData]) => {
              if (Array.isArray(existingData)) {
                queryClient.setQueryData<Commission[]>(queryKey, (oldData) => {
                  if (!oldData) return [result];
                  return oldData.map((commission) =>
                    commission.id === result.id ? result : commission,
                  );
                });
              }
            });
          }
        } catch {
          // Don't throw - we don't want to fail the policy update if commission recalculation fails
        }
      }

      // Invalidate commission queries to trigger refetch while keeping previous data visible
      // Using invalidateQueries instead of resetQueries to prevent UI from blanking out during refetch
      await queryClient.invalidateQueries({ queryKey: ["commissions"] });
      // Also invalidate commission metrics which may be affected
      queryClient.invalidateQueries({ queryKey: ["commission-metrics"] });

      // Also invalidate chargeback summary for lifecycle status changes
      if (
        isCancelParams(params) ||
        isLapseParams(params) ||
        isReinstateParams(params)
      ) {
        queryClient.invalidateQueries({ queryKey: ["chargeback-summary"] });
      }

      // Invalidate lead purchase cache when policies are unlinked
      if (
        isCancelParams(params) ||
        isLapseParams(params) ||
        (isBasicUpdateParams(params) &&
          (params.updates.status === "denied" ||
            params.updates.status === "withdrawn"))
      ) {
        queryClient.invalidateQueries({ queryKey: leadPurchaseKeys.all });
      }
    },
  });
}
