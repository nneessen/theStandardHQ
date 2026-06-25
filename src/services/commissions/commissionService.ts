// src/services/commissions/commissionService.ts
// Facade service that delegates to specialized services
// Maintains backward compatibility while providing cleaner architecture

import { Commission } from "../../types/commission.types";
import {
  commissionCRUDService,
  CreateCommissionData,
  UpdateCommissionData,
  CommissionFilters,
} from "./CommissionCRUDService";
import {
  commissionCalculationService,
  CalculationResult,
} from "./CommissionCalculationService";
import {
  commissionAnalyticsService,
  ChargebackRisk,
  CommissionWithChargebackRisk,
  CommissionMetrics,
  NetCommissionMetrics,
} from "./CommissionAnalyticsService";

// Re-export types for backward compatibility
export type { CreateCommissionData, UpdateCommissionData, CommissionFilters };
export type { CalculationResult };
export type {
  ChargebackRisk,
  CommissionWithChargebackRisk,
  CommissionMetrics,
  NetCommissionMetrics,
};

class CommissionService {
  // ===================================================================
  // CRUD Operations - Delegated to CommissionCRUDService
  // ===================================================================

  async getAll(): Promise<Commission[]> {
    return commissionCRUDService.getAll();
  }

  async getById(id: string): Promise<Commission | null> {
    return commissionCRUDService.getById(id);
  }

  async getByPolicyId(policyId: string): Promise<Commission[]> {
    return commissionCRUDService.getByPolicyId(policyId);
  }

  async getByPolicyIds(policyIds: string[]): Promise<Commission[]> {
    return commissionCRUDService.getByPolicyIds(policyIds);
  }

  async getCommissionsByUser(userId: string): Promise<Commission[]> {
    return commissionCRUDService.getCommissionsByUser(userId);
  }

  async getCommissionsByUserSince(
    userId: string,
    since: Date,
  ): Promise<Commission[]> {
    return commissionCRUDService.getCommissionsByUserSince(userId, since);
  }

  async create(data: CreateCommissionData): Promise<Commission> {
    return commissionCRUDService.create(data);
  }

  async update(
    id: string,
    data: Partial<CreateCommissionData>,
  ): Promise<Commission> {
    return commissionCRUDService.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return commissionCRUDService.delete(id);
  }

  async getFiltered(filters: CommissionFilters): Promise<Commission[]> {
    return commissionCRUDService.getFiltered(filters);
  }

  async markAsPaid(id: string, paymentDate?: Date): Promise<Commission> {
    return commissionCRUDService.markAsPaid(id, paymentDate);
  }

  // ===================================================================
  // Calculation Operations - Delegated to CommissionCalculationService
  // ===================================================================

  async calculateCommissionWithCompGuide(data: {
    carrierId: string;
    productId?: string; // Specific product ID for accurate comp_guide lookup
    product: string;
    monthlyPremium: number;
    userId?: string;
    contractCompLevel?: number;
    advanceMonths?: number;
  }): Promise<CalculationResult | null> {
    return commissionCalculationService.calculateCommissionWithCompGuide(data);
  }

  async createWithAutoCalculation(
    commissionData: CreateCommissionData,
    policyContext?: {
      carrierId?: string;
      product?: string;
      productId?: string;
      monthlyPremium?: number;
      annualPremium?: number;
      contractCompLevel?: number;
      termLength?: number;
      autoCalculate?: boolean;
      // Manual commission entry: agent's own comp rate (decimal) used verbatim
      // in place of a comp_guide lookup.
      commissionRateOverride?: number | null;
      // Manual commission entry: hand-entered flat-dollar advance override.
      manualAmount?: number | null;
    },
  ): Promise<Commission> {
    return commissionCalculationService.createWithAutoCalculation(
      commissionData,
      policyContext,
    );
  }

  async recalculateCommission(
    commissionId: string,
    newContractLevel?: number,
  ): Promise<Commission> {
    return commissionCalculationService.recalculateCommission(
      commissionId,
      newContractLevel,
    );
  }

  async recalculateCommissionByPolicyId(
    policyId: string,
    newAnnualPremium: number,
    newMonthlyPremium?: number,
    fullRecalculate?: boolean,
  ): Promise<Commission | null> {
    return commissionCalculationService.recalculateCommissionByPolicyId(
      policyId,
      newAnnualPremium,
      newMonthlyPremium,
      fullRecalculate,
    );
  }

  // ===================================================================
  // Analytics Operations - Delegated to CommissionAnalyticsService
  // ===================================================================

  async getCommissionMetrics(
    userId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CommissionMetrics> {
    return commissionAnalyticsService.getCommissionMetrics(
      userId,
      startDate,
      endDate,
    );
  }

  async getChargebackRisk(commissionId: string): Promise<ChargebackRisk> {
    return commissionAnalyticsService.getChargebackRisk(commissionId);
  }

  async createChargebackForCommission(
    commissionId: string,
    chargebackData: {
      chargebackType: "policy_lapse" | "refund" | "cancellation";
      chargebackAmount?: number;
      chargebackReason?: string;
      policyLapseDate?: Date;
      chargebackDate: Date;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- return type varies based on processing
  ): Promise<any> {
    return commissionAnalyticsService.createChargebackForCommission(
      commissionId,
      chargebackData,
    );
  }

  async getCommissionsWithChargebackRisk(
    userId?: string,
  ): Promise<CommissionWithChargebackRisk[]> {
    return commissionAnalyticsService.getCommissionsWithChargebackRisk(userId);
  }

  async calculateNetCommissionAfterChargebacks(
    userId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<NetCommissionMetrics> {
    return commissionAnalyticsService.calculateNetCommissionAfterChargebacks(
      userId,
      startDate,
      endDate,
    );
  }
}

export const commissionService = new CommissionService();
export default commissionService;
