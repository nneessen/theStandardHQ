// src/hooks/commissions/useUpdateCommissionStatus.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hierarchyKeys } from "../hierarchy/hierarchyKeys";
import { invalidateHierarchyForNode } from "../hierarchy/invalidation";
import { supabase } from "../../services/base/supabase";

interface UpdateCommissionStatusParams {
  commissionId: string;
  status: "pending" | "unpaid" | "paid" | "charged_back";
  policyId?: string;
}

/**
 * Commission Status Architecture
 *
 * This hook handles manual commission status updates for the normal lifecycle:
 * - pending → paid
 *
 * IMPORTANT: Terminal states (reversed, disputed, clawback, charged_back) should NOT be set manually.
 * They are set automatically by database triggers when policies lapse/cancel.
 *
 * To cancel/lapse a policy, use policy action buttons which trigger database automation.
 */
export const useUpdateCommissionStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commissionId,
      status,
      policyId: _policyId,
    }: UpdateCommissionStatusParams) => {
      // First, get the commission record to access advance_months
      // Use select without .single() to handle potential RLS issues
      const { data: commissionRecords, error: fetchError } = await supabase
        .from("commissions")
        .select("advance_months, amount")
        .eq("id", commissionId);

      if (fetchError) {
        console.error("Failed to fetch commission:", fetchError);
        throw new Error(`Failed to fetch commission: ${fetchError.message}`);
      }

      if (!commissionRecords || commissionRecords.length === 0) {
        throw new Error(
          "Commission not found or you do not have permission to access it",
        );
      }

      // Use the first record (should only be one with matching ID)
      const existingCommission = commissionRecords[0];

      // Prepare update data based on status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic data shape
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      // CRITICAL: Update months_paid based on status to trigger earned/unearned recalculation
      // The database trigger 'trigger_update_commission_earned' fires when months_paid changes
      if (status === "paid") {
        // Fully earned - set months_paid to advance_months
        updateData.months_paid = existingCommission.advance_months;
        // Clear all chargeback fields since commission is paid
        updateData.chargeback_amount = 0;
        updateData.chargeback_date = null;
        updateData.chargeback_reason = null;
        // Explicitly set payment_date
        updateData.payment_date = new Date().toISOString();
      } else if (status === "pending" || status === "unpaid") {
        // Not yet earned - reset months_paid to 0
        // "pending" = policy under review, "unpaid" = policy approved but carrier hasn't paid
        updateData.months_paid = 0;
        // Clear chargeback fields (in case transitioning from cancelled)
        updateData.chargeback_amount = 0;
        updateData.chargeback_date = null;
        updateData.chargeback_reason = null;
        updateData.payment_date = null;
      } else if (status === "charged_back") {
        // For charged_back status, the policy cancel/lapse handlers should calculate chargebacks
        // But if manually setting to charged_back, reset to 0 months paid
        updateData.months_paid = 0;
      }

      // Update commission (this will trigger the database trigger to recalculate amounts)
      // Using maybeSingle() to handle edge cases where multiple rows might be visible
      const { data: commissionResults, error: commissionError } = await supabase
        .from("commissions")
        .update(updateData)
        .eq("id", commissionId)
        .select();

      if (commissionError) {
        console.error("Commission update error:", commissionError);
        throw new Error(
          `Failed to update commission: ${commissionError.message}`,
        );
      }

      // Handle multiple results edge case (shouldn't happen with ID match, but being defensive)
      if (!commissionResults || commissionResults.length === 0) {
        throw new Error(
          "Commission not found or you do not have permission to update it",
        );
      }

      // Use the first result (they should all be the same since we're updating by ID)
      const commissionData = commissionResults[0];

      // NOTE: Commission status is now DECOUPLED from policy status.
      // Policy status (application outcome) and lifecycle status are controlled independently.
      // Commission status changes do NOT automatically update policy status.
      // Database triggers handle chargeback calculations when lifecycle_status changes.

      return commissionData;
    },
    onSuccess: (commissionData) => {
      // Invalidate all related queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      queryClient.invalidateQueries({ queryKey: ["commission-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["chargeback-summary"] });
      // Invalidate override-related queries (commission status changes trigger override status sync)
      queryClient.invalidateQueries({ queryKey: ["overrides"] });
      const agentId =
        commissionData && typeof commissionData === "object"
          ? (commissionData as { user_id?: string }).user_id
          : undefined;
      if (agentId) {
        invalidateHierarchyForNode(queryClient, agentId);
      }
      queryClient.invalidateQueries({
        queryKey: hierarchyKeys.rollup("me", undefined, "stats"),
      });
      queryClient.invalidateQueries({
        queryKey: hierarchyKeys.rollup("me", undefined, "team-comparison"),
      });
    },
  });
};
