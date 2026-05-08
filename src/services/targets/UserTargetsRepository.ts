// src/services/targets/UserTargetsRepository.ts

import { BaseRepository } from "../base/BaseRepository";
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "../../types/database.types";
import type {
  Achievement,
  DownlineTarget,
  ImoTarget,
} from "../../types/targets.types";

// Database types
type UserTargetsRow = Tables<"user_targets">;
type UserTargetsInsert = TablesInsert<"user_targets">;
type UserTargetsUpdate = TablesUpdate<"user_targets">;

// Entity type for BaseRepository (camelCase domain format)
interface UserTargetsEntity {
  id: string;
  userId: string;
  annualIncomeTarget: number;
  monthlyIncomeTarget: number;
  quarterlyIncomeTarget: number;
  annualPoliciesTarget: number;
  monthlyPoliciesTarget: number;
  avgPremiumTarget: number;
  persistency13MonthTarget: number;
  persistency25MonthTarget: number;
  monthlyExpenseTarget: number;
  expenseRatioTarget: number;
  persistencyAssumption: number;
  taxReserveRate: number;
  ntoBufferRate: number;
  premiumStatPreference: "mean" | "median";
  achievements: Achievement[];
  lastMilestoneDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// Create/Update data types (camelCase)
export interface CreateUserTargetsInput {
  userId: string;
  annualIncomeTarget?: number;
  monthlyIncomeTarget?: number;
  quarterlyIncomeTarget?: number;
  annualPoliciesTarget?: number;
  monthlyPoliciesTarget?: number;
  persistency13MonthTarget?: number;
  persistency25MonthTarget?: number;
  monthlyExpenseTarget?: number;
  expenseRatioTarget?: number;
  persistencyAssumption?: number;
  taxReserveRate?: number;
  ntoBufferRate?: number;
  premiumStatPreference?: "mean" | "median";
  achievements?: Achievement[];
  lastMilestoneDate?: string | null;
}

export interface UpdateUserTargetsInput {
  annualIncomeTarget?: number;
  monthlyIncomeTarget?: number;
  quarterlyIncomeTarget?: number;
  annualPoliciesTarget?: number;
  monthlyPoliciesTarget?: number;
  persistency13MonthTarget?: number;
  persistency25MonthTarget?: number;
  monthlyExpenseTarget?: number;
  expenseRatioTarget?: number;
  persistencyAssumption?: number;
  taxReserveRate?: number;
  ntoBufferRate?: number;
  premiumStatPreference?: "mean" | "median";
  achievements?: Achievement[];
  lastMilestoneDate?: string | null;
}

/**
 * UserTargetsRepository
 *
 * Single data access layer for the user_targets table.
 * Used by both targetsService and userTargetsService.
 * Handles snake_case <-> camelCase transformation.
 */
export class UserTargetsRepository extends BaseRepository<
  UserTargetsEntity,
  CreateUserTargetsInput,
  UpdateUserTargetsInput
> {
  constructor() {
    super("user_targets");
  }

  /**
   * Transform database record (snake_case) to entity (camelCase)
   */
  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): UserTargetsEntity {
    const row = dbRecord as unknown as UserTargetsRow;
    return {
      id: row.id,
      userId: row.user_id || "",
      annualIncomeTarget: row.annual_income_target || 0,
      monthlyIncomeTarget: row.monthly_income_target || 0,
      quarterlyIncomeTarget: row.quarterly_income_target || 0,
      annualPoliciesTarget: row.annual_policies_target || 0,
      monthlyPoliciesTarget: row.monthly_policies_target || 0,
      avgPremiumTarget: row.avg_premium_target || 0,
      persistency13MonthTarget: row.persistency_13_month_target || 0,
      persistency25MonthTarget: row.persistency_25_month_target || 0,
      monthlyExpenseTarget: row.monthly_expense_target || 0,
      expenseRatioTarget: row.expense_ratio_target || 0,
      persistencyAssumption: row.persistency_assumption ?? 0.75,
      taxReserveRate: row.tax_reserve_rate ?? 0.3,
      ntoBufferRate: row.nto_buffer_rate ?? 0.12,
      premiumStatPreference:
        (row.premium_stat_preference as "mean" | "median") ?? "median",
      achievements: (row.achievements as unknown as Achievement[]) || [],
      lastMilestoneDate: row.last_milestone_date,
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || "",
    };
  }

  /**
   * Transform entity (camelCase) to database record (snake_case)
   */
  protected transformToDB(
    data: CreateUserTargetsInput | UpdateUserTargetsInput,
    _isUpdate = false,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if ("userId" in data && data.userId !== undefined) {
      result.user_id = data.userId;
    }
    if (data.annualIncomeTarget !== undefined) {
      result.annual_income_target = data.annualIncomeTarget;
    }
    if (data.monthlyIncomeTarget !== undefined) {
      result.monthly_income_target = data.monthlyIncomeTarget;
    }
    if (data.quarterlyIncomeTarget !== undefined) {
      result.quarterly_income_target = data.quarterlyIncomeTarget;
    }
    if (data.annualPoliciesTarget !== undefined) {
      result.annual_policies_target = data.annualPoliciesTarget;
    }
    if (data.monthlyPoliciesTarget !== undefined) {
      result.monthly_policies_target = data.monthlyPoliciesTarget;
    }
    if (data.persistency13MonthTarget !== undefined) {
      result.persistency_13_month_target = data.persistency13MonthTarget;
    }
    if (data.persistency25MonthTarget !== undefined) {
      result.persistency_25_month_target = data.persistency25MonthTarget;
    }
    if (data.monthlyExpenseTarget !== undefined) {
      result.monthly_expense_target = data.monthlyExpenseTarget;
    }
    if (data.expenseRatioTarget !== undefined) {
      result.expense_ratio_target = data.expenseRatioTarget;
    }
    if (data.persistencyAssumption !== undefined) {
      result.persistency_assumption = data.persistencyAssumption;
    }
    if (data.taxReserveRate !== undefined) {
      result.tax_reserve_rate = data.taxReserveRate;
    }
    if (data.ntoBufferRate !== undefined) {
      result.nto_buffer_rate = data.ntoBufferRate;
    }
    if (data.premiumStatPreference !== undefined) {
      result.premium_stat_preference = data.premiumStatPreference;
    }
    if (data.achievements !== undefined) {
      result.achievements = data.achievements;
    }
    if (data.lastMilestoneDate !== undefined) {
      result.last_milestone_date = data.lastMilestoneDate;
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // CUSTOM READ OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Find user targets by user ID
   * Returns null if not found
   */
  async findByUserId(userId: string): Promise<UserTargetsEntity | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw this.handleError(error, "findByUserId");
    }

    return data ? this.transformFromDB(data) : null;
  }

  // ---------------------------------------------------------------------------
  // CUSTOM WRITE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Create default targets for a user (all zeros)
   */
  async createDefaults(userId: string): Promise<UserTargetsEntity> {
    const defaultData: UserTargetsInsert = {
      user_id: userId,
      annual_income_target: 0,
      monthly_income_target: 0,
      quarterly_income_target: 0,
      annual_policies_target: 0,
      monthly_policies_target: 0,
      persistency_13_month_target: 0,
      persistency_25_month_target: 0,
      monthly_expense_target: 0,
      expense_ratio_target: 0,
      achievements: [],
      last_milestone_date: null,
    };

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(defaultData)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, "createDefaults");
    }

    return this.transformFromDB(data);
  }

  /**
   * Update targets by user ID
   */
  async updateByUserId(
    userId: string,
    updates: UpdateUserTargetsInput,
  ): Promise<UserTargetsEntity> {
    const dbData = this.transformToDB(updates, true);
    dbData.updated_at = new Date().toISOString();

    const { data, error } = await this.client
      .from(this.tableName)
      .update(dbData)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, "updateByUserId");
    }

    return this.transformFromDB(data);
  }

  /**
   * Upsert targets by user ID (create if not exists, update if exists)
   */
  async upsertByUserId(
    userId: string,
    data: UpdateUserTargetsInput,
  ): Promise<UserTargetsEntity> {
    const dbData = this.transformToDB(data, false);
    dbData.user_id = userId;
    dbData.updated_at = new Date().toISOString();

    const { data: result, error } = await this.client
      .from(this.tableName)
      .upsert(dbData, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      throw this.handleError(error, "upsertByUserId");
    }

    return this.transformFromDB(result);
  }

  // ---------------------------------------------------------------------------
  // RAW DATABASE ACCESS (for services that need snake_case)
  // ---------------------------------------------------------------------------

  /**
   * Get raw database record by user ID (snake_case)
   * Used by userTargetsService for backward compatibility
   */
  async findRawByUserId(userId: string): Promise<UserTargetsRow | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw this.handleError(error, "findRawByUserId");
    }

    return data;
  }

  /**
   * Upsert raw database record (snake_case input)
   * Used by userTargetsService for backward compatibility
   */
  async upsertRaw(
    userId: string,
    data: Partial<UserTargetsRow>,
  ): Promise<UserTargetsRow> {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .upsert(
        {
          ...data,
          user_id: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (error) {
      throw this.handleError(error, "upsertRaw");
    }

    return result;
  }

  /**
   * Update raw database record (snake_case input)
   * Used by userTargetsService for backward compatibility
   */
  async updateRaw(
    userId: string,
    data: Partial<UserTargetsRow>,
  ): Promise<UserTargetsRow> {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, "updateRaw");
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // HIERARCHY/TEAM OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Get targets from downline agents with owner info
   * Calls get_downline_targets() database function
   */
  async findDownlineWithOwner(): Promise<DownlineTarget[]> {
    const { data, error } = await this.client.rpc("get_downline_targets");

    if (error) {
      throw this.handleError(error, "findDownlineWithOwner");
    }

    if (!data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      userId: row.user_id as string,
      ownerName: row.owner_name as string,
      annualIncomeTarget: Number(row.annual_income_target) || 0,
      monthlyIncomeTarget: Number(row.monthly_income_target) || 0,
      quarterlyIncomeTarget: Number(row.quarterly_income_target) || 0,
      annualPoliciesTarget: Number(row.annual_policies_target) || 0,
      monthlyPoliciesTarget: Number(row.monthly_policies_target) || 0,
      avgPremiumTarget: Number(row.avg_premium_target) || 0,
      persistency13MonthTarget: Number(row.persistency_13_month_target) || 0,
      persistency25MonthTarget: Number(row.persistency_25_month_target) || 0,
      monthlyExpenseTarget: Number(row.monthly_expense_target) || 0,
      expenseRatioTarget: Number(row.expense_ratio_target) || 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }

  /**
   * Get all targets in IMO with owner and agency info (admin only)
   * Calls get_imo_targets() database function
   */
  async findImoWithOwner(): Promise<ImoTarget[]> {
    const { data, error } = await this.client.rpc("get_imo_targets");

    if (error) {
      throw this.handleError(error, "findImoWithOwner");
    }

    if (!data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      userId: row.user_id as string,
      ownerName: row.owner_name as string,
      agencyName: row.agency_name as string,
      annualIncomeTarget: Number(row.annual_income_target) || 0,
      monthlyIncomeTarget: Number(row.monthly_income_target) || 0,
      quarterlyIncomeTarget: Number(row.quarterly_income_target) || 0,
      annualPoliciesTarget: Number(row.annual_policies_target) || 0,
      monthlyPoliciesTarget: Number(row.monthly_policies_target) || 0,
      avgPremiumTarget: Number(row.avg_premium_target) || 0,
      persistency13MonthTarget: Number(row.persistency_13_month_target) || 0,
      persistency25MonthTarget: Number(row.persistency_25_month_target) || 0,
      monthlyExpenseTarget: Number(row.monthly_expense_target) || 0,
      expenseRatioTarget: Number(row.expense_ratio_target) || 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }
}

// Singleton instance
export const userTargetsRepository = new UserTargetsRepository();

// Re-export database types for services that need them
export type { UserTargetsRow, UserTargetsInsert, UserTargetsUpdate };
