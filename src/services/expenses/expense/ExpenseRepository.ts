// src/services/expenses/expense/ExpenseRepository.ts
import { BaseRepository, BaseEntity } from "../../base/BaseRepository";
import type {
  Expense,
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseFilters,
  DownlineExpense,
  AgentExpenseSummary,
  CategoryExpenseSummary,
} from "@/types/expense.types";

type ExpenseBaseEntity = Expense & BaseEntity;

/**
 * Repository for expenses data access
 * Extends BaseRepository for standard CRUD operations
 */
export class ExpenseRepository extends BaseRepository<
  ExpenseBaseEntity,
  CreateExpenseData,
  UpdateExpenseData
> {
  constructor() {
    super("expenses");
  }

  /**
   * Transform database record to entity
   */
  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): ExpenseBaseEntity {
    return {
      id: dbRecord.id as string,
      user_id: dbRecord.user_id as string,
      name: dbRecord.name as string,
      description: dbRecord.description as string | null,
      // Postgres `numeric` is returned as a STRING by supabase-js to avoid
      // float precision loss. The Expense type (and all `+=` arithmetic in
      // ExpenseService.getTotals) expects a number, so coerce here.
      amount: Number(dbRecord.amount),
      category: dbRecord.category as string,
      expense_type: dbRecord.expense_type as "personal" | "business",
      date: dbRecord.date as string,
      is_recurring: dbRecord.is_recurring as boolean,
      recurring_frequency:
        dbRecord.recurring_frequency as Expense["recurring_frequency"],
      recurring_group_id: dbRecord.recurring_group_id as string | null,
      recurring_end_date: dbRecord.recurring_end_date as string | null,
      is_tax_deductible: dbRecord.is_tax_deductible as boolean,
      receipt_url: dbRecord.receipt_url as string | null,
      notes: dbRecord.notes as string | null,
      created_at: dbRecord.created_at as string,
      updated_at: dbRecord.updated_at as string,
    } as ExpenseBaseEntity;
  }

  /**
   * Transform entity to database record
   */
  protected transformToDB(
    data: CreateExpenseData | UpdateExpenseData,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    if ("name" in data && data.name !== undefined) result.name = data.name;
    if ("description" in data) result.description = data.description ?? null;
    if ("amount" in data && data.amount !== undefined)
      result.amount = data.amount;
    if ("category" in data && data.category !== undefined)
      result.category = data.category;
    if ("expense_type" in data && data.expense_type !== undefined) {
      result.expense_type = data.expense_type;
    }
    if ("date" in data && data.date !== undefined) result.date = data.date;
    if ("is_recurring" in data)
      result.is_recurring = data.is_recurring ?? false;
    if ("recurring_frequency" in data) {
      result.recurring_frequency = data.recurring_frequency ?? null;
    }
    if ("recurring_group_id" in data) {
      result.recurring_group_id = data.recurring_group_id ?? null;
    }
    if ("recurring_end_date" in data) {
      result.recurring_end_date = data.recurring_end_date ?? null;
    }
    if ("is_tax_deductible" in data) {
      result.is_tax_deductible = data.is_tax_deductible ?? false;
    }
    if ("receipt_url" in data) result.receipt_url = data.receipt_url ?? null;
    if ("notes" in data) result.notes = data.notes ?? null;

    // Multi-tenant fields (defense-in-depth - also set by DB trigger)
    if ("imo_id" in data) result.imo_id = data.imo_id;
    if ("agency_id" in data) result.agency_id = data.agency_id;

    return result;
  }

  /**
   * Find all expenses with filters
   */
  async findWithFilters(
    filters?: ExpenseFilters,
  ): Promise<ExpenseBaseEntity[]> {
    let query = this.client
      .from(this.tableName)
      .select("*")
      .order("date", { ascending: false });

    // CRITICAL: Filter by user_id for data isolation
    if (filters?.userId) {
      query = query.eq("user_id", filters.userId);
    }

    if (filters?.expenseType && filters.expenseType !== "all") {
      query = query.eq("expense_type", filters.expenseType);
    }

    if (filters?.category && filters.category !== "all") {
      query = query.eq("category", filters.category);
    }

    if (filters?.startDate) {
      query = query.gte("date", filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte("date", filters.endDate);
    }

    if (filters?.deductibleOnly) {
      query = query.eq("is_tax_deductible", true);
    }

    if (filters?.recurringOnly) {
      query = query.eq("is_recurring", true);
    }

    if (filters?.searchTerm) {
      query = query.or(
        `name.ilike.%${filters.searchTerm}%,description.ilike.%${filters.searchTerm}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      throw this.handleError(error, "findWithFilters");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Find expenses by date range
   */
  async findByDateRange(
    startDate: string,
    endDate: string,
    userId?: string,
  ): Promise<ExpenseBaseEntity[]> {
    let query = this.client
      .from(this.tableName)
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    // Filter by user_id if provided for data isolation
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      throw this.handleError(error, "findByDateRange");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Find expenses by recurring group
   */
  async findByRecurringGroup(groupId: string): Promise<ExpenseBaseEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("recurring_group_id", groupId)
      .order("date", { ascending: true });

    if (error) {
      throw this.handleError(error, "findByRecurringGroup");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Find expenses by category
   */
  async findByCategory(category: string): Promise<ExpenseBaseEntity[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("category", category)
      .order("date", { ascending: false });

    if (error) {
      throw this.handleError(error, "findByCategory");
    }

    return data?.map((item) => this.transformFromDB(item)) || [];
  }

  /**
   * Get total amount for date range
   */
  async getTotalForDateRange(
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("amount")
      .gte("date", startDate)
      .lte("date", endDate);

    if (error) {
      throw this.handleError(error, "getTotalForDateRange");
    }

    // `amount` is a Postgres numeric → returned as a string by supabase-js;
    // coerce before summing, otherwise `+` concatenates strings.
    return data?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
  }

  // ---------------------------------------------------------------------------
  // RECURRING EXPENSE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Find the last expense in a recurring group (by date)
   */
  async findLastInRecurringGroup(
    groupId: string,
  ): Promise<ExpenseBaseEntity | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("recurring_group_id", groupId)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw this.handleError(error, "findLastInRecurringGroup");
    }

    return data ? this.transformFromDB(data) : null;
  }

  /**
   * Update all future expenses in a recurring group (date >= given date)
   */
  async updateFutureInGroup(
    groupId: string,
    fromDate: string,
    updates: Partial<CreateExpenseData>,
  ): Promise<number> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update(updates)
      .eq("recurring_group_id", groupId)
      .gte("date", fromDate)
      .select("id");

    if (error) {
      throw this.handleError(error, "updateFutureInGroup");
    }

    return data?.length || 0;
  }

  /**
   * Delete all future expenses in a recurring group (date > given date)
   * Returns the number of deleted expenses
   */
  async deleteFutureInGroup(
    groupId: string,
    afterDate: string,
  ): Promise<number> {
    const { data, error } = await this.client
      .from(this.tableName)
      .delete()
      .eq("recurring_group_id", groupId)
      .gt("date", afterDate)
      .select("id");

    if (error) {
      throw this.handleError(error, "deleteFutureInGroup");
    }

    // Return count of deleted rows (may be 0 if none found, which is valid)
    return data?.length || 0;
  }

  /**
   * Create an expense with user_id
   * Used for recurring expense generation
   */
  async createWithUserId(
    userId: string,
    data: CreateExpenseData,
  ): Promise<ExpenseBaseEntity> {
    const dbData = this.transformToDB(data);
    dbData.user_id = userId;

    const { data: result, error } = await this.client
      .from(this.tableName)
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, "createWithUserId");
    }

    return this.transformFromDB(result);
  }

  /**
   * Create expense and return just the ID
   * Used for batch creation where full entity is not needed
   */
  async createAndReturnId(
    userId: string,
    data: CreateExpenseData,
  ): Promise<string | null> {
    const dbData = this.transformToDB(data);
    dbData.user_id = userId;

    const { data: result, error } = await this.client
      .from(this.tableName)
      .insert(dbData)
      .select("id")
      .single();

    if (error) {
      // Log but don't throw - used in batch operations
      console.error("Failed to create expense:", error);
      return null;
    }

    return result?.id || null;
  }

  // ---------------------------------------------------------------------------
  // HIERARCHY/TEAM EXPENSE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Get expenses from downline agents with owner info
   */
  async findDownlineExpenses(
    startDate?: string,
    endDate?: string,
  ): Promise<DownlineExpense[]> {
    const { data, error } = await this.client.rpc("get_downline_expenses", {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });

    if (error) {
      throw this.handleError(error, "findDownlineExpenses");
    }

    return (data || []) as DownlineExpense[];
  }

  /**
   * Get expense summary aggregated by downline agent
   */
  async getDownlineExpenseSummary(
    startDate?: string,
    endDate?: string,
  ): Promise<AgentExpenseSummary[]> {
    const { data, error } = await this.client.rpc(
      "get_downline_expense_summary",
      {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      },
    );

    if (error) {
      throw this.handleError(error, "getDownlineExpenseSummary");
    }

    return (data || []) as AgentExpenseSummary[];
  }

  /**
   * Get expense summary for entire IMO (admin only)
   */
  async getImoExpenseSummary(
    startDate?: string,
    endDate?: string,
  ): Promise<AgentExpenseSummary[]> {
    const { data, error } = await this.client.rpc("get_imo_expense_summary", {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });

    if (error) {
      throw this.handleError(error, "getImoExpenseSummary");
    }

    return (data || []) as AgentExpenseSummary[];
  }

  /**
   * Get expense totals by category for IMO (admin only)
   */
  async getImoExpenseByCategory(
    startDate?: string,
    endDate?: string,
  ): Promise<CategoryExpenseSummary[]> {
    const { data, error } = await this.client.rpc(
      "get_imo_expense_by_category",
      {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      },
    );

    if (error) {
      throw this.handleError(error, "getImoExpenseByCategory");
    }

    return (data || []) as CategoryExpenseSummary[];
  }
}

export type { ExpenseBaseEntity };
