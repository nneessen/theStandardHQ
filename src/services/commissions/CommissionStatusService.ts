// src/services/commissions/CommissionStatusService.ts
/**
 * Commission Status Management Service
 *
 * Handles commission status lifecycle operations:
 * - Update months_paid tracking
 * - Mark commissions as cancelled
 * - Process chargebacks
 * - Reverse chargebacks (for policy reinstatement)
 * - Get chargeback summaries and reporting
 */

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import {
  DatabaseError,
  NotFoundError,
  ValidationError,
} from "../../errors/ServiceErrors";
import { formatDateForDB, parseLocalDate } from "../../lib/date";
import { calculateCommissionProgress } from "../../utils/commissionProgress";

export interface UpdateMonthsPaidParams {
  commissionId: string;
  lastPaymentDate?: Date; // Optional - defaults to today if not provided
  // monthsPaid is now automatically calculated from effective_date
}

export interface UpdateCommissionStatusParams {
  commissionId: string;
  status: "pending" | "unpaid" | "paid" | "charged_back";
  paymentDate?: Date;
}

export interface UpdateMonthsPaidResult {
  success: boolean;
  commissionId: string;
  monthsPaid: number;
  earnedAmount: number;
  unearnedAmount: number;
  message: string;
}

export interface UpdateCommissionStatusResult {
  id: string;
  user_id: string;
  status: string;
  payment_date: string | null;
  months_paid: number;
  earned_amount: number;
  unearned_amount: number;
}

export interface MarkAsCancelledParams {
  commissionId: string;
  reason: string;
  cancelledDate?: Date;
}

export interface ProcessChargebackParams {
  commissionId: string;
  policyId: string;
  lapseDate?: Date;
}

export interface ChargebackResult {
  success: boolean;
  commissionId: string;
  chargebackAmount: number;
  earnedAmount: number;
  monthsPaid: number;
  chargebackReason: string;
  message: string;
}

export interface ChargebackSummary {
  totalChargebacks: number;
  totalChargebackAmount: number;
  totalAdvances: number;
  totalEarned: number;
  chargebackRatePercentage: number;
  chargedBackCount: number;
  highRiskCount: number;
  atRiskAmount: number;
}

/**
 * Chargebacks that occurred in the CURRENT calendar month only (by
 * chargeback_date) — distinct from the all-time {@link ChargebackSummary}.
 */
export interface CurrentMonthChargebacks {
  count: number;
  amount: number;
}

export interface AtRiskCommission {
  commissionId: string;
  policyId: string;
  advanceAmount: number;
  monthsPaid: number;
  earnedAmount: number;
  unearnedAmount: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  effectiveDate: Date;
  policyStatus: string;
}

/**
 * Commission Status Management Service
 */
class CommissionStatusService {
  constructor() {}

  /**
   * Update months_paid for a commission
   *
   * Automatically calculates months_paid based on policy effective_date and current date.
   * This automatically recalculates earned/unearned amounts.
   *
   * @param params - Update parameters (only commissionId and optionally lastPaymentDate)
   * @returns Updated commission details
   */
  async updateMonthsPaid(
    params: UpdateMonthsPaidParams,
  ): Promise<UpdateMonthsPaidResult> {
    const { commissionId, lastPaymentDate } = params;

    try {
      // Get commission and policy to calculate months_paid automatically
      const { data: commission, error: fetchError } = await supabase
        .from("commissions")
        .select(
          `
          id,
          months_paid,
          advance_months,
          amount,
          policy_id,
          policies!inner (
            effective_date,
            lifecycle_status,
            cancellation_date
          )
        `,
        )
        .eq("id", commissionId)
        .single();

      if (fetchError) {
        throw new DatabaseError("updateMonthsPaid", fetchError);
      }

      if (!commission) {
        throw new NotFoundError("Commission", commissionId);
      }

      // Get policy effective_date
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase response type
      const policy = (commission as any).policies;
      const effectiveDate = policy?.effective_date;

      const progress = calculateCommissionProgress({
        amount: Number(commission.amount || 0),
        advanceMonths: commission.advance_months,
        fallbackMonthsPaid: commission.months_paid,
        effectiveDate: effectiveDate || null,
        lifecycleStatus: policy?.lifecycle_status || null,
        cancellationDate: policy?.cancellation_date || null,
        asOfDate: lastPaymentDate,
      });

      // Update commission with calculated values
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record has dynamic schema
      const updateData: any = {
        months_paid: progress.monthsPaid,
        earned_amount: progress.earnedAmount,
        unearned_amount: progress.unearnedAmount,
        updated_at: new Date().toISOString(),
      };

      if (lastPaymentDate) {
        updateData.last_payment_date = formatDateForDB(lastPaymentDate);
      }

      const { data: updated, error: updateError } = await supabase
        .from("commissions")
        .update(updateData)
        .eq("id", commissionId)
        .select("id, months_paid, earned_amount, unearned_amount")
        .single();

      if (updateError) {
        throw new DatabaseError("updateMonthsPaid", updateError);
      }

      logger.info(
        "Months paid auto-calculated and updated",
        {
          commissionId,
          effectiveDate,
          monthsPaid: progress.monthsPaid,
          earnedAmount: updated.earned_amount,
          unearnedAmount: updated.unearned_amount,
        },
        "CommissionStatusService",
      );

      return {
        success: true,
        commissionId: updated.id,
        monthsPaid: updated.months_paid,
        earnedAmount: parseFloat(updated.earned_amount || "0"),
        unearnedAmount: parseFloat(updated.unearned_amount || "0"),
        message: `Auto-calculated months paid: ${progress.monthsPaid} months`,
      };
    } catch (error) {
      logger.error(
        "CommissionStatusService.updateMonthsPaid",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async updateCommissionStatus(
    params: UpdateCommissionStatusParams,
  ): Promise<UpdateCommissionStatusResult> {
    const { commissionId, status, paymentDate } = params;

    try {
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === "paid") {
        updateData.payment_date = (paymentDate || new Date()).toISOString();
        updateData.chargeback_amount = 0;
        updateData.chargeback_date = null;
        updateData.chargeback_reason = null;
      } else if (status === "pending" || status === "unpaid") {
        updateData.payment_date = null;
        updateData.chargeback_amount = 0;
        updateData.chargeback_date = null;
        updateData.chargeback_reason = null;
      } else if (status === "charged_back") {
        updateData.chargeback_date = formatDateForDB(new Date());
        updateData.chargeback_reason = "Manual chargeback";
      }

      const { error: updateError } = await supabase
        .from("commissions")
        .update(updateData)
        .eq("id", commissionId)
        .select("id")
        .single();

      if (updateError) {
        throw new DatabaseError("updateCommissionStatus", updateError);
      }

      const progress = await this.updateMonthsPaid({ commissionId });

      if (status === "charged_back") {
        const { error: chargebackError } = await supabase
          .from("commissions")
          .update({
            chargeback_amount: progress.unearnedAmount,
            chargeback_date: formatDateForDB(new Date()),
            chargeback_reason: "Manual chargeback",
            updated_at: new Date().toISOString(),
          })
          .eq("id", commissionId)
          .select("id")
          .single();

        if (chargebackError) {
          throw new DatabaseError("updateCommissionStatus", chargebackError);
        }
      }

      const { data: refreshed, error: refreshedError } = await supabase
        .from("commissions")
        .select(
          "id, user_id, status, payment_date, months_paid, earned_amount, unearned_amount",
        )
        .eq("id", commissionId)
        .single();

      if (refreshedError) {
        throw new DatabaseError("updateCommissionStatus", refreshedError);
      }

      return refreshed as UpdateCommissionStatusResult;
    } catch (error) {
      logger.error(
        "CommissionStatusService.updateCommissionStatus",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Mark a commission as cancelled (manual cancellation)
   *
   * Use this for manual commission cancellations that are NOT triggered by
   * policy status changes (which are handled automatically by the trigger).
   *
   * @param params - Cancellation parameters
   * @returns Success indicator
   */
  async markAsCancelled(
    params: MarkAsCancelledParams,
  ): Promise<{ success: boolean; message: string }> {
    const { commissionId, reason, cancelledDate } = params;

    try {
      // Validate reason is provided
      if (!reason || reason.trim().length === 0) {
        throw new ValidationError("Cancellation reason is required", [
          { field: "reason", message: "Reason cannot be empty", value: reason },
        ]);
      }

      // Check if commission exists (user_id needed for the workflow recipient)
      const { data: commission, error: fetchError } = await supabase
        .from("commissions")
        .select("id, status, user_id")
        .eq("id", commissionId)
        .single();

      if (fetchError) {
        throw new DatabaseError("markAsCancelled", fetchError);
      }

      if (!commission) {
        throw new NotFoundError("Commission", commissionId);
      }

      // Update commission status to cancelled
      const { error: updateError } = await supabase
        .from("commissions")
        .update({
          status: "cancelled",
          chargeback_reason: reason,
          chargeback_date: formatDateForDB(cancelledDate || new Date()),
          updated_at: new Date().toISOString(),
        })
        .eq("id", commissionId);

      if (updateError) {
        throw new DatabaseError("markAsCancelled", updateError);
      }

      // Emit commission cancelled event (non-fatal). recipientId = the agent.
      await workflowEventEmitter.emit(WORKFLOW_EVENTS.COMMISSION_CANCELLED, {
        recipientId: commission.user_id ?? undefined,
        commissionId,
        cancelReason: reason,
        cancelledAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      });

      logger.info(
        "Commission marked as cancelled",
        {
          commissionId,
          reason,
        },
        "CommissionStatusService",
      );

      return {
        success: true,
        message: `Commission cancelled: ${reason}`,
      };
    } catch (error) {
      logger.error(
        "CommissionStatusService.markAsCancelled",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Process chargeback for a commission
   *
   * This method manually triggers chargeback calculation for a commission.
   * Typically called via the database trigger when policy status changes,
   * but can also be called manually if needed.
   *
   * @param params - Chargeback parameters
   * @returns Chargeback calculation result
   */
  async processChargeback(
    params: ProcessChargebackParams,
  ): Promise<ChargebackResult> {
    const { commissionId, policyId, lapseDate } = params;

    try {
      // Call the database function to calculate chargeback
      const { data, error } = await supabase.rpc(
        "calculate_chargeback_on_policy_lapse",
        {
          p_policy_id: policyId,
          p_lapse_date: formatDateForDB(lapseDate || new Date()),
        },
      );

      if (error) {
        throw new DatabaseError("processChargeback", error);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- return type varies based on processing
      const result = data as any;

      if (!result.success) {
        throw new Error(`Chargeback calculation failed: ${result.error}`);
      }

      logger.info(
        "Chargeback processed",
        {
          commissionId,
          policyId,
          chargebackAmount: result.chargeback_amount,
          monthsPaid: result.months_paid,
        },
        "CommissionStatusService",
      );

      return {
        success: true,
        commissionId: result.commission_id,
        chargebackAmount: parseFloat(result.chargeback_amount || "0"),
        earnedAmount: parseFloat(result.earned_amount || "0"),
        monthsPaid: result.months_paid || 0,
        chargebackReason: result.chargeback_reason || "Chargeback processed",
        message: "Chargeback successfully processed",
      };
    } catch (error) {
      logger.error(
        "CommissionStatusService.processChargeback",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Reverse a chargeback or restore a cancelled commission (for policy reinstatement)
   *
   * When a policy is reinstated after being cancelled/lapsed,
   * reverse the chargeback and restore the commission status.
   * Handles both "charged_back" and "cancelled" commission statuses.
   *
   * @param commissionId - Commission ID to reverse chargeback for
   * @returns Success indicator
   */
  async reverseChargeback(
    commissionId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Get commission details
      // Note: Remote DB uses 'amount' column, not 'commission_amount'
      const { data: commission, error: fetchError } = await supabase
        .from("commissions")
        .select("id, status, chargeback_amount, amount, user_id")
        .eq("id", commissionId)
        .single();

      if (fetchError) {
        throw new DatabaseError("reverseChargeback", fetchError);
      }

      if (!commission) {
        throw new NotFoundError("Commission", commissionId);
      }

      // Validate commission is in a restorable state (charged_back, cancelled, or lapsed)
      const restorableStatuses = ["charged_back", "cancelled", "lapsed"];
      if (!restorableStatuses.includes(commission.status)) {
        throw new ValidationError(
          "Cannot restore commission - must be charged_back, cancelled, or lapsed",
          [
            {
              field: "status",
              message: `Commission status must be one of: ${restorableStatuses.join(", ")}`,
              value: commission.status,
            },
          ],
        );
      }

      // Restore the commission to earned status
      const { error: updateError } = await supabase
        .from("commissions")
        .update({
          status: "earned", // Restore to earned status
          chargeback_amount: 0,
          chargeback_date: null,
          chargeback_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", commissionId);

      if (updateError) {
        throw new DatabaseError("reverseChargeback", updateError);
      }

      // Emit chargeback-reversed event (non-fatal). recipientId = the agent.
      await workflowEventEmitter.emit(
        WORKFLOW_EVENTS.COMMISSION_CHARGEBACK_REVERSED,
        {
          recipientId: commission.user_id ?? undefined,
          commissionId,
          previousStatus: commission.status,
          originalChargebackAmount: commission.chargeback_amount,
          timestamp: new Date().toISOString(),
        },
      );

      logger.info(
        "Commission restored to earned status",
        {
          commissionId,
          previousStatus: commission.status,
          originalChargebackAmount: commission.chargeback_amount,
        },
        "CommissionStatusService",
      );

      return {
        success: true,
        message: "Commission successfully restored to earned status",
      };
    } catch (error) {
      logger.error(
        "CommissionStatusService.reverseChargeback",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get chargeback summary for a user
   *
   * Returns aggregate chargeback metrics for reporting and dashboard.
   *
   * @param userId - User ID to get summary for
   * @returns Chargeback summary metrics
   */
  async getChargebackSummary(_userId: string): Promise<ChargebackSummary> {
    try {
      // Use RPC function - direct SELECT on view is revoked for security
      const { data, error } = await supabase.rpc(
        "get_user_commission_chargeback_summary",
      );

      if (error) {
        throw new DatabaseError("getChargebackSummary", error);
      }

      // If no data found (user has no commissions), return zeros
      if (!data) {
        return {
          totalChargebacks: 0,
          totalChargebackAmount: 0,
          totalAdvances: 0,
          totalEarned: 0,
          chargebackRatePercentage: 0,
          chargedBackCount: 0,
          highRiskCount: 0,
          atRiskAmount: 0,
        };
      }

      return {
        totalChargebacks: data.total_chargebacks || 0,
        totalChargebackAmount: parseFloat(data.total_chargeback_amount || "0"),
        totalAdvances: parseFloat(data.total_advances || "0"),
        totalEarned: parseFloat(data.total_earned || "0"),
        chargebackRatePercentage: parseFloat(
          data.chargeback_rate_percentage || "0",
        ),
        chargedBackCount: data.charged_back_count || 0,
        highRiskCount: data.high_risk_count || 0,
        atRiskAmount: parseFloat(data.at_risk_amount || "0"),
      };
    } catch (error) {
      logger.error(
        "CommissionStatusService.getChargebackSummary",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get chargebacks that occurred in the CURRENT calendar month.
   *
   * Unlike {@link getChargebackSummary} (which is an all-time portfolio
   * aggregate), this returns only chargebacks whose `chargeback_date` falls in
   * the current month — the correct figure for a "this month" dashboard alert.
   *
   * @returns Count + summed amount of this month's chargebacks
   */
  async getCurrentMonthChargebacks(): Promise<CurrentMonthChargebacks> {
    try {
      const { data, error } = await supabase.rpc(
        "get_user_current_month_chargebacks",
      );

      if (error) {
        throw new DatabaseError("getCurrentMonthChargebacks", error);
      }

      // RPC returns a single-row set: [{ chargeback_count, chargeback_amount }]
      const row = Array.isArray(data) ? data[0] : data;

      return {
        count: Number(row?.chargeback_count ?? 0),
        amount: Number(row?.chargeback_amount ?? 0),
      };
    } catch (error) {
      logger.error(
        "CommissionStatusService.getCurrentMonthChargebacks",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get at-risk commissions for a user
   *
   * Returns commissions with low months_paid and high unearned amounts.
   * Useful for monitoring portfolio health and identifying potential chargebacks.
   *
   * @param userId - User ID to get at-risk commissions for
   * @param riskThreshold - Months paid threshold for "high risk" (default: 3)
   * @returns List of at-risk commissions
   */
  async getAtRiskCommissions(
    userId: string,
    riskThreshold: number = 3,
  ): Promise<AtRiskCommission[]> {
    try {
      const { data, error } = await supabase.rpc("get_at_risk_commissions", {
        puser_id: userId,
        p_risk_threshold: riskThreshold,
      });

      if (error) {
        throw new DatabaseError("getAtRiskCommissions", error);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase response type
      return (data || []).map((item: any) => ({
        commissionId: item.commission_id,
        policyId: item.policy_id,
        advanceAmount: parseFloat(item.advance_amount || "0"),
        monthsPaid: item.months_paid || 0,
        earnedAmount: parseFloat(item.earned_amount || "0"),
        unearnedAmount: parseFloat(item.unearned_amount || "0"),
        riskLevel: item.risk_level as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
        effectiveDate: parseLocalDate(item.effective_date),
        policyStatus: item.policy_status,
      }));
    } catch (error) {
      logger.error(
        "CommissionStatusService.getAtRiskCommissions",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }
}

// Export service instance
export const commissionStatusService = new CommissionStatusService();

// Export class for testing
export { CommissionStatusService };
