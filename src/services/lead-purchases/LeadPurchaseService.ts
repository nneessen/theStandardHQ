// src/services/lead-purchases/LeadPurchaseService.ts
import { BaseService, type ServiceResponse } from "../base/BaseService";
import { LeadPurchaseRepository } from "./LeadPurchaseRepository";
import type {
  LeadPurchase,
  CreateLeadPurchaseData,
  UpdateLeadPurchaseData,
  LeadPurchaseStats,
  VendorStats,
  VendorStatsAggregate,
  VendorAdminOverview,
  VendorUserBreakdown,
  VendorPolicyTimelineRecord,
  VendorHeatMetrics,
  LeadPurchaseFilters,
  LeadPackRow,
  LeadRecentPolicy,
  PackHeatMetrics,
} from "@/types/lead-purchase.types";
import {
  workflowEventEmitter,
  WORKFLOW_EVENTS,
} from "@/services/events/workflowEventEmitter";

export class LeadPurchaseService extends BaseService<
  LeadPurchase,
  CreateLeadPurchaseData,
  UpdateLeadPurchaseData
> {
  declare protected repository: LeadPurchaseRepository;

  constructor(repository: LeadPurchaseRepository) {
    super(repository);
  }

  protected initializeValidationRules(): void {
    this.validationRules = [
      {
        field: "vendorId",
        validate: (value) => {
          return typeof value === "string" && value.length > 0;
        },
        message: "Vendor is required",
      },
      {
        field: "leadCount",
        validate: (value) => {
          const num = Number(value);
          return !isNaN(num) && num > 0 && Number.isInteger(num);
        },
        message: "Lead count must be a positive integer",
      },
      {
        field: "totalCost",
        validate: (value) => {
          const num = Number(value);
          return !isNaN(num) && num >= 0;
        },
        message: "Total cost must be a non-negative number",
      },
      {
        field: "purchaseDate",
        validate: (value) => {
          if (typeof value !== "string") return false;
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(value)) return false;
          const date = new Date(value);
          return !isNaN(date.getTime());
        },
        message: "Purchase date must be a valid date (YYYY-MM-DD)",
      },
      {
        field: "policiesSold",
        validate: (value) => {
          if (value === undefined || value === null) return true;
          const num = Number(value);
          return !isNaN(num) && num >= 0 && Number.isInteger(num);
        },
        message: "Policies sold must be a non-negative integer",
      },
      {
        field: "commissionEarned",
        validate: (value) => {
          if (value === undefined || value === null) return true;
          const num = Number(value);
          return !isNaN(num) && num >= 0;
        },
        message: "Commission earned must be a non-negative number",
      },
    ];
  }

  private async emitLeadPackPurchasedEvent(
    purchase: LeadPurchase,
  ): Promise<void> {
    // Look up vendor name for context
    try {
      const vendorName = purchase.vendor?.name || "Unknown Vendor";
      await workflowEventEmitter.emit(WORKFLOW_EVENTS.LEAD_PACK_PURCHASED, {
        vendorName,
        agentName: "", // Resolved by workflow at runtime
        leadCount: purchase.leadCount,
        totalCost: purchase.totalCost,
        leadFreshness: purchase.leadFreshness,
        costPerLead: purchase.costPerLead,
        purchaseName: purchase.purchaseName || "Unnamed Pack",
        purchaseId: purchase.id,
      });
    } catch (err) {
      console.warn(
        "[LeadPurchaseService] Failed to emit pack_purchased event:",
        err,
      );
    }
  }

  /**
   * Get all purchases with optional filters
   */
  async getAllWithFilters(
    filters?: LeadPurchaseFilters,
  ): Promise<ServiceResponse<LeadPurchase[]>> {
    try {
      const purchases = await this.repository.findAllWithFilters(filters);
      return { success: true, data: purchases };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get a single purchase by ID with vendor data
   */
  async getByIdWithVendor(id: string): Promise<ServiceResponse<LeadPurchase>> {
    try {
      const purchase = await this.repository.findByIdWithVendor(id);
      if (!purchase) {
        return {
          success: false,
          error: new Error("Lead purchase not found"),
        };
      }
      return { success: true, data: purchase };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get purchase linked to an expense
   */
  async getByExpenseId(
    expenseId: string,
  ): Promise<ServiceResponse<LeadPurchase | null>> {
    try {
      const purchase = await this.repository.findByExpenseId(expenseId);
      return { success: true, data: purchase };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get overall stats for the current user
   */
  async getStats(
    startDate?: string,
    endDate?: string,
  ): Promise<ServiceResponse<LeadPurchaseStats>> {
    try {
      const stats = await this.repository.getStats(startDate, endDate);
      return { success: true, data: stats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get stats grouped by vendor
   */
  async getStatsByVendor(
    startDate?: string,
    endDate?: string,
  ): Promise<ServiceResponse<VendorStats[]>> {
    try {
      const stats = await this.repository.getStatsByVendor(startDate, endDate);
      return { success: true, data: stats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get stats grouped by vendor - aggregated across ALL users in the IMO
   */
  async getStatsByVendorImoAggregate(
    startDate?: string,
    endDate?: string,
  ): Promise<ServiceResponse<VendorStatsAggregate[]>> {
    try {
      const stats = await this.repository.getStatsByVendorImoAggregate(
        startDate,
        endDate,
      );
      return { success: true, data: stats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get vendor admin overview - all vendors with full stats for admin tab
   */
  async getVendorAdminOverview(
    startDate?: string,
    endDate?: string,
  ): Promise<ServiceResponse<VendorAdminOverview[]>> {
    try {
      const data = await this.repository.getVendorAdminOverview(
        startDate,
        endDate,
      );
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get per-user breakdown for a specific vendor
   */
  async getVendorUserBreakdown(
    vendorId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ServiceResponse<VendorUserBreakdown[]>> {
    try {
      const data = await this.repository.getVendorUserBreakdown(
        vendorId,
        startDate,
        endDate,
      );
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Link a purchase to an expense
   */
  async linkToExpense(
    purchaseId: string,
    expenseId: string,
  ): Promise<ServiceResponse<LeadPurchase>> {
    try {
      const purchase = await this.repository.linkToExpense(
        purchaseId,
        expenseId,
      );
      return { success: true, data: purchase };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Unlink a purchase from an expense
   */
  async unlinkFromExpense(
    purchaseId: string,
  ): Promise<ServiceResponse<LeadPurchase>> {
    try {
      const purchase = await this.repository.unlinkFromExpense(purchaseId);
      return { success: true, data: purchase };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Update ROI tracking fields (policies sold, commission earned)
   */
  async updateRoi(
    id: string,
    policiesSold: number,
    commissionEarned: number,
  ): Promise<ServiceResponse<LeadPurchase>> {
    const result = await this.update(id, {
      policiesSold,
      commissionEarned,
    });
    // Emit lead_pack.roi_updated (non-fatal). recipientId = the owning agent.
    if (result.success && result.data) {
      await workflowEventEmitter.emit(WORKFLOW_EVENTS.LEAD_PACK_ROI_UPDATED, {
        recipientId: result.data.userId,
        leadPurchaseId: id,
        policiesSold,
        commissionEarned,
        timestamp: new Date().toISOString(),
      });
    }
    return result;
  }

  /**
   * Create a lead purchase and mirrored expense record in a single DB transaction.
   * Scoped for the Expense page's Lead Purchases tab.
   */
  async createWithExpense(
    data: CreateLeadPurchaseData,
  ): Promise<ServiceResponse<LeadPurchase>> {
    try {
      if (data.expenseId) {
        return {
          success: false,
          error: new Error(
            "createWithExpense does not accept expenseId. Use linkToExpense for existing expenses.",
          ),
        };
      }

      const errors = this.validate(data as unknown as Record<string, unknown>);
      if (errors.length > 0) {
        return {
          success: false,
          error: new Error(errors.map((e) => e.message).join(", ")),
        };
      }

      const purchase = await this.repository.createWithMirroredExpense(data);
      await this.emitLeadPackPurchasedEvent(purchase);

      return { success: true, data: purchase };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Update a lead purchase and mirrored expense record in a single DB transaction.
   * Expects a full payload (same shape as create) from the Lead Purchases management dialog.
   */
  async updateWithExpense(
    id: string,
    data: CreateLeadPurchaseData,
  ): Promise<ServiceResponse<LeadPurchase>> {
    try {
      if (data.expenseId) {
        return {
          success: false,
          error: new Error(
            "updateWithExpense does not accept expenseId in payload. The existing link is managed server-side.",
          ),
        };
      }

      const errors = this.validate(data as unknown as Record<string, unknown>);
      if (errors.length > 0) {
        return {
          success: false,
          error: new Error(errors.map((e) => e.message).join(", ")),
        };
      }

      const purchase = await this.repository.updateWithMirroredExpense(
        id,
        data,
      );
      return { success: true, data: purchase };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Delete a lead purchase and mirrored expense record in a single DB transaction.
   */
  async deleteWithExpense(id: string): Promise<ServiceResponse<void>> {
    try {
      await this.repository.deleteWithMirroredExpense(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async getVendorPolicyTimeline(
    vendorId: string,
    userId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ServiceResponse<VendorPolicyTimelineRecord[]>> {
    try {
      const data = await this.repository.getVendorPolicyTimeline(
        vendorId,
        userId,
        startDate,
        endDate,
      );
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Override create to emit lead.pack_purchased workflow event
   */
  async create(
    data: CreateLeadPurchaseData,
  ): Promise<ServiceResponse<LeadPurchase>> {
    const result = await super.create(data);

    if (result.success && result.data) {
      await this.emitLeadPackPurchasedEvent(result.data);
    }

    return result;
  }

  /**
   * Get pack-level list for admin tables (V2)
   */
  async getLeadPackList(
    freshness?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ServiceResponse<LeadPackRow[]>> {
    try {
      const data = await this.repository.getLeadPackList(
        freshness,
        startDate,
        endDate,
      );
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get recent policies from lead packs (V2)
   */
  async getLeadRecentPolicies(
    limit?: number,
  ): Promise<ServiceResponse<LeadRecentPolicy[]>> {
    try {
      const data = await this.repository.getLeadRecentPolicies(limit);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get per-pack heat metrics for V2 heat score computation
   */
  async getPackHeatMetrics(): Promise<ServiceResponse<PackHeatMetrics[]>> {
    try {
      const data = await this.repository.getPackHeatMetrics();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async getVendorHeatMetrics(): Promise<ServiceResponse<VendorHeatMetrics[]>> {
    try {
      const data = await this.repository.getVendorHeatMetrics();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

// Create singleton instance
const leadPurchaseRepository = new LeadPurchaseRepository();
export const leadPurchaseService = new LeadPurchaseService(
  leadPurchaseRepository,
);
