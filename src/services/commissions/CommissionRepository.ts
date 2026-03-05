// src/services/commissions/CommissionRepository.ts
import { BaseRepository } from "../base/BaseRepository";
import { TABLES } from "../base/supabase";
import type { Database } from "../../types/database.types";
import {
  Commission,
  CreateCommissionData,
  UpdateCommissionData,
} from "../../types/commission.types";
import { queryPerformance } from "../../utils/performance";
import { formatDateForDB } from "../../lib/date";

/** DB row type — generated from Supabase schema, NOT Record<string, any> */
type CommissionRow = Database["public"]["Tables"]["commissions"]["Row"];

// ---------------------------------------------------------------------------
// Type definitions for lightweight metric queries
// ---------------------------------------------------------------------------

export interface CommissionMetricRow {
  user_id: string;
  amount: number | string | null;
  status: string | null;
  earned_amount: number | string | null;
}

export interface CommissionWithPolicy {
  id: string;
  user_id: string;
  amount: number | string | null;
  earned_amount: number | string | null;
  unearned_amount: number | string | null;
  chargeback_amount: number | string | null;
  advance_months: number | null;
  months_paid: number | null;
  status: string | null;
  type: string | null;
  created_at: string | null;
  policy: {
    policy_number: string;
    effective_date: string | null;
    lifecycle_status: string | null;
    cancellation_date: string | null;
  } | null;
}

export class CommissionRepository extends BaseRepository<
  Commission,
  CreateCommissionData,
  UpdateCommissionData
> {
  constructor() {
    super(TABLES.COMMISSIONS);
  }

  /**
   * Transform database record to Commission object.
   * Maps ONLY real DB columns — no ghost fields from policy/joins.
   */
  protected transformFromDB(dbRecord: Record<string, unknown>): Commission {
    const row = dbRecord as CommissionRow;
    return {
      id: row.id,
      policyId: row.policy_id ?? undefined,
      userId: row.user_id ?? "",

      type: row.type as Commission["type"],
      status: row.status as Commission["status"],

      amount: Number(row.amount) || 0,
      advanceMonths: row.advance_months ?? 9,

      originalAdvance:
        row.original_advance != null ? Number(row.original_advance) : null,
      overageAmount:
        row.overage_amount != null ? Number(row.overage_amount) : null,
      overageStartMonth: row.overage_start_month ?? null,

      monthsPaid: row.months_paid || 0,
      earnedAmount: Number(row.earned_amount) || 0,
      unearnedAmount: Number(row.unearned_amount) || 0,
      lastPaymentDate: row.last_payment_date
        ? new Date(row.last_payment_date)
        : undefined,

      chargebackAmount:
        row.chargeback_amount != null
          ? Number(row.chargeback_amount)
          : undefined,
      chargebackDate: row.chargeback_date
        ? new Date(row.chargeback_date)
        : undefined,
      chargebackReason: row.chargeback_reason ?? undefined,

      paymentDate: row.payment_date ? new Date(row.payment_date) : undefined,
      createdAt: new Date(row.created_at ?? Date.now()),
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,

      notes: row.notes ?? undefined,
      monthNumber: row.month_number ?? null,
      relatedAdvanceId: row.related_advance_id ?? null,
      imoId: row.imo_id ?? null,
    };
  }

  async findByPolicy(policyId: string): Promise<Commission[]> {
    return queryPerformance.trackQuery(
      "findByPolicy",
      "commissions",
      async () => {
        try {
          const { data, error } = await this.client
            .from(this.tableName)
            .select("*")
            .eq("policy_id", policyId)
            .order("created_at", { ascending: false });

          if (error) {
            throw this.handleError(error, "findByPolicy");
          }

          return data?.map((item) => this.transformFromDB(item)) || [];
        } catch (error) {
          throw this.wrapError(error, "findByPolicy");
        }
      },
    );
  }

  async findByAgent(userId: string): Promise<Commission[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw this.handleError(error, "findByAgent");
      }

      return data?.map((item) => this.transformFromDB(item)) || [];
    } catch (error) {
      throw this.wrapError(error, "findByAgent");
    }
  }

  // -------------------------------------------------------------------------
  // BATCH METHODS (for hierarchy/team queries)
  // -------------------------------------------------------------------------

  async findByAgents(userIds: string[]): Promise<Commission[]> {
    if (userIds.length === 0) return [];

    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("*")
        .in("user_id", userIds)
        .order("created_at", { ascending: false });

      if (error) {
        throw this.handleError(error, "findByAgents");
      }

      return data?.map((item) => this.transformFromDB(item)) || [];
    } catch (error) {
      throw this.wrapError(error, "findByAgents");
    }
  }

  async findMetricsByUserIds(
    userIds: string[],
  ): Promise<CommissionMetricRow[]> {
    if (userIds.length === 0) return [];

    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("user_id, amount, status, earned_amount")
        .in("user_id", userIds);

      if (error) {
        throw this.handleError(error, "findMetricsByUserIds");
      }

      return (data as CommissionMetricRow[]) || [];
    } catch (error) {
      throw this.wrapError(error, "findMetricsByUserIds");
    }
  }

  async findWithPolicyByUserId(
    userId: string,
  ): Promise<CommissionWithPolicy[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select(
          `
          *,
          policy:policies(policy_number,effective_date,lifecycle_status,cancellation_date)
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw this.handleError(error, "findWithPolicyByUserId");
      }

      return (data as CommissionWithPolicy[]) || [];
    } catch (error) {
      throw this.wrapError(error, "findWithPolicyByUserId");
    }
  }

  async findByStatus(status: string): Promise<Commission[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("*")
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) {
        throw this.handleError(error, "findByStatus");
      }

      return data?.map((item) => this.transformFromDB(item)) || [];
    } catch (error) {
      throw this.wrapError(error, "findByStatus");
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Commission[]> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("*")
        .gte("created_at", formatDateForDB(startDate))
        .lte("created_at", formatDateForDB(endDate))
        .order("created_at", { ascending: false });

      if (error) {
        throw this.handleError(error, "findByDateRange");
      }

      return data?.map((item) => this.transformFromDB(item)) || [];
    } catch (error) {
      throw this.wrapError(error, "findByDateRange");
    }
  }

  async getMonthlyEarnings(
    userId: string,
    _year: number,
    _month: number,
  ): Promise<{
    expected: number;
    actual: number;
    pending: number;
    count: number;
  }> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("amount, status")
        .eq("user_id", userId);

      if (error) {
        throw this.handleError(error, "getMonthlyEarnings");
      }

      const commissions = data || [];
      const expected = commissions.reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0,
      );
      const actual = commissions
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const pending = commissions
        .filter((c) => c.status === "pending")
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);

      return {
        expected,
        actual,
        pending,
        count: commissions.length,
      };
    } catch (error) {
      throw this.wrapError(error, "getMonthlyEarnings");
    }
  }

  async getYearToDateSummary(
    userId: string,
    _year: number,
  ): Promise<{
    totalExpected: number;
    totalActual: number;
    totalPending: number;
    monthlyBreakdown: Array<{
      month: number;
      expected: number;
      actual: number;
      pending: number;
    }>;
  }> {
    try {
      const { data, error } = await this.client
        .from(this.tableName)
        .select("amount, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) {
        throw this.handleError(error, "getYearToDateSummary");
      }

      const commissions = data || [];

      const totalExpected = commissions.reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0,
      );
      const totalActual = commissions
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const totalPending = commissions
        .filter((c) => c.status === "pending")
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);

      // Group by month from created_at
      const monthlyMap = new Map<
        number,
        { expected: number; actual: number; pending: number }
      >();

      commissions.forEach((c) => {
        const month = c.created_at ? new Date(c.created_at).getMonth() + 1 : 1;
        const amount = Number(c.amount || 0);

        if (!monthlyMap.has(month)) {
          monthlyMap.set(month, { expected: 0, actual: 0, pending: 0 });
        }

        const monthData = monthlyMap.get(month)!;
        monthData.expected += amount;

        if (c.status === "paid") {
          monthData.actual += amount;
        } else if (c.status === "pending") {
          monthData.pending += amount;
        }
      });

      const monthlyBreakdown = Array.from(monthlyMap.entries()).map(
        ([month, data]) => ({
          month,
          ...data,
        }),
      );

      return {
        totalExpected,
        totalActual,
        totalPending,
        monthlyBreakdown,
      };
    } catch (error) {
      throw this.wrapError(error, "getYearToDateSummary");
    }
  }

  async getCarrierPerformance(
    _carrierId: string,
    _year: number,
  ): Promise<{
    totalCommissions: number;
    averageCommission: number;
    policyCount: number;
    conversionRate: number;
  }> {
    // carrier_id is NOT on commissions table — this must join through policies.
    // Return empty metrics rather than querying a non-existent column.
    return {
      totalCommissions: 0,
      averageCommission: 0,
      policyCount: 0,
      conversionRate: 0,
    };
  }

  protected transformToDB(
    data: Partial<CreateCommissionData>,
    _isUpdate = false,
  ): Record<string, unknown> {
    const dbData: Record<string, unknown> = {};

    if (data.policyId !== undefined) dbData.policy_id = data.policyId;
    if (data.userId !== undefined) dbData.user_id = data.userId;
    if (data.type !== undefined) dbData.type = data.type;
    if (data.status !== undefined) dbData.status = data.status;

    if (data.amount !== undefined) dbData.amount = data.amount;
    if (data.advanceMonths !== undefined)
      dbData.advance_months = data.advanceMonths;

    // CAPPED ADVANCE
    if (data.originalAdvance !== undefined)
      dbData.original_advance = data.originalAdvance;
    if (data.overageAmount !== undefined)
      dbData.overage_amount = data.overageAmount;
    if (data.overageStartMonth !== undefined)
      dbData.overage_start_month = data.overageStartMonth;

    // EARNING TRACKING
    if (data.monthsPaid !== undefined) dbData.months_paid = data.monthsPaid;
    if (data.earnedAmount !== undefined)
      dbData.earned_amount = data.earnedAmount;
    if (data.unearnedAmount !== undefined)
      dbData.unearned_amount = data.unearnedAmount;
    if (data.lastPaymentDate !== undefined)
      dbData.last_payment_date = data.lastPaymentDate;

    if (data.paymentDate !== undefined) dbData.payment_date = data.paymentDate;
    if (data.notes !== undefined) dbData.notes = data.notes;
    if (data.monthNumber !== undefined) dbData.month_number = data.monthNumber;
    if (data.relatedAdvanceId !== undefined)
      dbData.related_advance_id = data.relatedAdvanceId;
    if (data.imoId !== undefined) dbData.imo_id = data.imoId;

    return dbData;
  }
}
