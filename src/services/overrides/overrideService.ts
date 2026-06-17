// src/services/overrides/overrideService.ts
// Service layer for override commission management

import { supabase } from "../base/supabase";
import { logger } from "../base/logger";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "../events/workflowEventEmitter";
import type {
  OverrideCommission,
  OverrideCommissionWithAgents,
  OverrideSummary,
  OverrideByDownlineSummary,
  OverrideFilters,
} from "../../types/hierarchy.types";
import { DatabaseError } from "../../errors/ServiceErrors";

/**
 * Service layer for override commission operations
 * Handles all override commission business logic
 */
class OverrideService {
  /**
   * Get all override commissions earned by current user
   * @param filters - Optional filters to apply
   */
  async getMyOverrides(
    filters?: OverrideFilters,
  ): Promise<OverrideCommissionWithAgents[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Use inner join with policies to filter by active status only
      // This ensures we only show overrides for currently active policies
      let query = supabase
        .from("override_commissions")
        .select(
          `
          *,
          base_agent:user_profiles!override_commissions_base_agent_id_fkey(email),
          override_agent:user_profiles!override_commissions_override_agent_id_fkey(email),
          policy:policies!inner(policy_number, status, lifecycle_status),
          carrier:carriers(name),
          product:products(name)
        `,
        )
        .eq("override_agent_id", user.id)
        .eq("policy.lifecycle_status", "active");

      // Apply filters
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in("status", filters.status);
        } else {
          query = query.eq("status", filters.status);
        }
      }

      if (filters?.downline_id) {
        query = query.eq("base_agent_id", filters.downline_id);
      }

      if (filters?.hierarchy_depth) {
        query = query.eq("hierarchy_depth", filters.hierarchy_depth);
      }

      if (filters?.start_date) {
        query = query.gte("created_at", filters.start_date.toISOString());
      }

      if (filters?.end_date) {
        query = query.lte("created_at", filters.end_date.toISOString());
      }

      if (filters?.min_amount) {
        query = query.gte("override_commission_amount", filters.min_amount);
      }

      if (filters?.max_amount) {
        query = query.lte("override_commission_amount", filters.max_amount);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError("getMyOverrides", error);
      }

      // Transform to include agent details
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record with joined relations
      return (data || []).map((override: any) => ({
        ...override,
        base_agent_email: override.base_agent?.email || "",
        override_agent_email: override.override_agent?.email || "",
        policy_number: override.policy?.policy_number,
        carrier_name: override.carrier?.name,
        product_name: override.product?.name,
      }));
    } catch (error) {
      logger.error(
        "OverrideService.getMyOverrides",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get override commission summary for current user
   * Aggregates all override earnings
   */
  async getMyOverrideSummary(): Promise<OverrideSummary> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      // Use the override_commission_summary view created in migration
      const { data, error } = await supabase
        .from("override_commission_summary")
        .select("*")
        .eq("override_agent_id", user.id)
        .maybeSingle();

      if (error) {
        throw new DatabaseError("getMyOverrideSummary", error);
      }

      // If no data, return zeros
      if (!data) {
        return {
          override_agent_id: user.id,
          total_overrides: 0,
          total_override_amount: 0,
          pending_amount: 0,
          earned_amount: 0,
          paid_amount: 0,
          charged_back_amount: 0,
          total_earned: 0,
          total_unearned: 0,
        };
      }

      return data;
    } catch (error) {
      logger.error(
        "OverrideService.getMyOverrideSummary",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get override commissions grouped by downline
   * Shows how much each downline has generated in overrides
   */
  async getOverridesByDownline(): Promise<OverrideByDownlineSummary[]> {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase
        .from("override_commissions")
        .select(
          `
          base_agent_id,
          hierarchy_depth,
          override_commission_amount,
          earned_amount,
          status,
          base_agent:user_profiles!override_commissions_base_agent_id_fkey(email)
        `,
        )
        .eq("override_agent_id", user.id);

      if (error) {
        throw new DatabaseError("getOverridesByDownline", error);
      }

      // Group by downline and aggregate
      const grouped = new Map<string, OverrideByDownlineSummary>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record with joined relations
      (data || []).forEach((override: any) => {
        const key = override.base_agent_id;

        if (!grouped.has(key)) {
          grouped.set(key, {
            downline_id: override.base_agent_id,
            downline_email: override.base_agent?.email || "",
            hierarchy_depth: override.hierarchy_depth,
            total_policies: 0,
            total_premium: 0,
            total_override_generated: 0,
            pending_override: 0,
            earned_override: 0,
            paid_override: 0,
          });
        }

        const summary = grouped.get(key)!;
        const amount = parseFloat(
          String(override.override_commission_amount) || "0",
        );
        // earned_override is the earned PORTION, not a status bucket. Override
        // rows never carry an "earned" status (lifecycle is pending -> paid),
        // so the old `status === "earned"` check always summed to $0. The real
        // earned figure is the earned_amount column (null-coalesced to 0).
        const earned = Number(override.earned_amount ?? 0);

        summary.total_policies++;
        summary.total_override_generated += amount;
        summary.earned_override += earned;

        if (override.status === "pending") summary.pending_override += amount;
        if (override.status === "paid") summary.paid_override += amount;
      });

      return Array.from(grouped.values()).sort(
        (a, b) => b.total_override_generated - a.total_override_generated,
      );
    } catch (error) {
      logger.error(
        "OverrideService.getOverridesByDownline",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get override commissions for a specific policy
   * Shows the entire override chain for a policy
   */
  async getOverridesForPolicy(
    policyId: string,
  ): Promise<OverrideCommissionWithAgents[]> {
    try {
      const { data, error } = await supabase
        .from("override_commissions")
        .select(
          `
          *,
          base_agent:user_profiles!override_commissions_base_agent_id_fkey(email),
          override_agent:user_profiles!override_commissions_override_agent_id_fkey(email)
        `,
        )
        .eq("policy_id", policyId)
        .order("hierarchy_depth", { ascending: true });

      if (error) {
        throw new DatabaseError("getOverridesForPolicy", error);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB record with joined relations
      return (data || []).map((override: any) => ({
        ...override,
        base_agent_email: override.base_agent?.email || "",
        override_agent_email: override.override_agent?.email || "",
      }));
    } catch (error) {
      logger.error(
        "OverrideService.getOverridesForPolicy",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Update payment status for override commission (admin only)
   */
  async updateOverrideStatus(
    overrideId: string,
    status: string,
    paymentDate?: Date,
  ): Promise<OverrideCommission> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic update object
      const updates: any = { status };

      if (paymentDate && status === "paid") {
        updates.payment_date = paymentDate.toISOString();
      }

      const { data, error } = await supabase
        .from("override_commissions")
        .update(updates)
        .eq("id", overrideId)
        .select()
        .single();

      if (error) {
        throw new DatabaseError("updateOverrideStatus", error);
      }

      // Emit override.paid (non-fatal) ONLY when actually paid — recipientId is
      // the upline agent receiving the override income.
      if (status === "paid") {
        await workflowEventEmitter.emit(WORKFLOW_EVENTS.OVERRIDE_PAID, {
          recipientId: data.override_agent_id ?? undefined,
          overrideId,
          baseAgentId: data.base_agent_id ?? undefined,
          policyId: data.policy_id ?? undefined,
          overrideAmount: data.override_commission_amount ?? undefined,
          paymentDate: (paymentDate ?? new Date()).toISOString(),
          timestamp: new Date().toISOString(),
        });
      }

      logger.info(
        "Override status updated",
        {
          overrideId,
          status,
          paymentDate,
        },
        "OverrideService",
      );

      return data;
    } catch (error) {
      logger.error(
        "OverrideService.updateOverrideStatus",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Recalculate overrides for a policy (admin only)
   * Useful if commission rates changed or hierarchy was adjusted
   */
  async recalculateOverridesForPolicy(policyId: string): Promise<void> {
    try {
      // Delete existing overrides for this policy first
      const { error: deleteError } = await supabase
        .from("override_commissions")
        .delete()
        .eq("policy_id", policyId);

      if (deleteError) {
        throw new DatabaseError(
          "recalculateOverridesForPolicy.delete",
          deleteError,
        );
      }

      // Call the database function to regenerate overrides
      // This function properly walks the hierarchy and creates override records
      const { data: createdCount, error: rpcError } = await supabase.rpc(
        "regenerate_override_commissions",
        { p_policy_id: policyId },
      );

      if (rpcError) {
        throw new DatabaseError("recalculateOverridesForPolicy.rpc", rpcError);
      }

      logger.info(
        "Override recalculated for policy",
        { policyId, createdCount },
        "OverrideService",
      );
    } catch (error) {
      logger.error(
        "OverrideService.recalculateOverridesForPolicy",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }
}

export { OverrideService };
export const overrideService = new OverrideService();
