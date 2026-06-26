// src/services/expenses/expense/ExpenseService.ts
import { BaseService, ServiceResponse } from "../../base/BaseService";
import { ExpenseRepository, ExpenseBaseEntity } from "./ExpenseRepository";
import { isSameMonth, isSameYear, getTodayString } from "@/lib/date";
import type {
  Expense,
  CreateExpenseData,
  UpdateExpenseData,
  ExpenseFilters,
  ExpenseTotals,
  MonthlyExpenseBreakdown,
  YearlyExpenseSummary,
  DownlineExpense,
  AgentExpenseSummary,
  CategoryExpenseSummary,
  ExpenseDateRange,
} from "@/types/expense.types";

/**
 * Service for expense business logic
 * Extends BaseService for standard CRUD operations with validation
 */
class ExpenseServiceClass extends BaseService<
  ExpenseBaseEntity,
  CreateExpenseData,
  UpdateExpenseData
> {
  // Store typed repository reference for custom methods
  private _repository: ExpenseRepository;

  constructor(repository: ExpenseRepository) {
    super(repository);
    this._repository = repository;
  }

  /**
   * Initialize validation rules for expense data
   */
  protected initializeValidationRules(): void {
    this.validationRules = [
      // Required fields
      {
        field: "name",
        validate: (value) =>
          typeof value === "string" && value.trim().length > 0,
        message: "Expense name is required",
      },
      {
        field: "amount",
        validate: (value) => typeof value === "number" && value > 0,
        message: "Amount must be a positive number",
      },
      {
        field: "date",
        validate: (value) => {
          if (typeof value !== "string" || !value.trim()) return false;
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          return dateRegex.test(value);
        },
        message: "Valid date is required (YYYY-MM-DD format)",
      },
      {
        field: "category",
        validate: (value) =>
          typeof value === "string" && value.trim().length > 0,
        message: "Category is required",
      },
      {
        field: "expense_type",
        validate: (value) => {
          const validTypes: ("personal" | "business")[] = [
            "personal",
            "business",
          ];
          return validTypes.includes(value as "personal" | "business");
        },
        message: "Expense type must be 'personal' or 'business'",
      },
      // Optional fields with constraints
      {
        field: "description",
        validate: (value) => {
          if (value === undefined || value === null || value === "")
            return true;
          return typeof value === "string" && value.length <= 500;
        },
        message: "Description must be 500 characters or less",
      },
      {
        field: "notes",
        validate: (value) => {
          if (value === undefined || value === null || value === "")
            return true;
          return typeof value === "string" && value.length <= 1000;
        },
        message: "Notes must be 1000 characters or less",
      },
      {
        field: "is_tax_deductible",
        validate: (value) => {
          if (value === undefined || value === null) return true;
          return typeof value === "boolean";
        },
        message: "Tax deductible must be a boolean",
      },
      {
        field: "is_recurring",
        validate: (value) => {
          if (value === undefined || value === null) return true;
          return typeof value === "boolean";
        },
        message: "Recurring flag must be a boolean",
      },
      {
        field: "recurring_frequency",
        validate: (value, data) => {
          // If not recurring, frequency should be null/undefined
          const isRecurring = data?.is_recurring;
          if (!isRecurring) return true;
          // If recurring, validate frequency value
          if (!value) return false;
          const validFrequencies = [
            "daily",
            "weekly",
            "biweekly",
            "monthly",
            "quarterly",
            "annually",
          ];
          return validFrequencies.includes(value as string);
        },
        message: "Recurring frequency is required when is_recurring is true",
      },
    ];
  }

  /**
   * Validate only provided fields for partial updates
   */
  private validateForUpdate(data: Record<string, unknown>): Error[] {
    const errors: Error[] = [];

    for (const rule of this.validationRules) {
      const value = data[rule.field];
      // Skip validation for fields not in the update
      if (value === undefined) continue;

      if (!rule.validate(value, data)) {
        errors.push(new Error(rule.message));
      }
    }

    return errors;
  }

  // ============================================================================
  // CRUD METHODS
  // ============================================================================

  /**
   * Get all expenses with optional filtering
   * Custom method using ExpenseFilters (not BaseService.getAll)
   */
  async getAllFiltered(
    filters?: ExpenseFilters,
  ): Promise<ServiceResponse<Expense[]>> {
    try {
      const expenses = await this._repository.findWithFilters(filters);
      return { success: true, data: expenses as Expense[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * @deprecated Use getAllFiltered() instead.
   * This override prevents accidental use of BaseService.getAll() which has an incompatible signature.
   * @throws Error directing users to use getAllFiltered()
   */
  async getAll(): Promise<ServiceResponse<Expense[]>> {
    throw new Error(
      "ExpenseService.getAll() is not supported. Use getAllFiltered(filters?: ExpenseFilters) instead.",
    );
  }

  /**
   * Create a new expense
   * Override to handle user authentication and recurring expense generation
   * @param data Expense data to create
   * @param userId User ID who owns this expense (required)
   */
  async create(
    data: CreateExpenseData,
    userId?: string,
  ): Promise<ServiceResponse<Expense>> {
    try {
      // Validate user ID
      if (!userId) {
        return {
          success: false,
          error: new Error(
            "User ID is required. This should be provided by the authentication layer.",
          ),
        };
      }

      // Validate input
      const errors = this.validate(data as unknown as Record<string, unknown>);
      if (errors.length > 0) {
        return {
          success: false,
          error: new Error(errors.map((e) => e.message).join(", ")),
        };
      }

      // Generate recurring_group_id if this is a recurring expense
      const isRecurring = data.is_recurring || false;
      const recurringGroupId =
        isRecurring && !data.recurring_group_id
          ? crypto.randomUUID()
          : data.recurring_group_id;

      // Prepare data with defaults and generated values
      const expenseData: CreateExpenseData = {
        ...data,
        is_recurring: isRecurring,
        recurring_frequency: data.recurring_frequency || null,
        recurring_group_id: recurringGroupId,
        recurring_end_date: data.recurring_end_date || null,
        is_tax_deductible: data.is_tax_deductible || false,
      };

      // Use repository to create expense (respects transformToDB)
      const expense = await this._repository.createWithUserId(
        userId,
        expenseData,
      );

      // AUTO-GENERATE future recurring expenses
      const warnings: string[] = [];
      if (isRecurring && data.recurring_frequency) {
        try {
          const { recurringExpenseService } =
            await import("../recurringExpenseService");
          const batchResult =
            await recurringExpenseService.generateRecurringExpenses(
              { ...data, recurring_group_id: recurringGroupId },
              userId,
            );

          // Report partial failures as warnings
          if (batchResult.failureCount > 0) {
            const warningMsg = `Recurring expense created, but ${batchResult.failureCount} future instances failed to generate. Successfully created ${batchResult.successCount} future instances.`;
            warnings.push(warningMsg);
            console.warn(warningMsg, batchResult.errors);
          }
        } catch (recurringError) {
          const errorMsg =
            "Recurring expense created, but failed to generate future instances. You may need to create them manually.";
          warnings.push(errorMsg);
          console.error(
            "Failed to generate recurring expenses:",
            recurringError,
          );
        }
      }

      return {
        success: true,
        data: expense as Expense,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Update an expense
   * Override to use partial validation
   */
  async update(
    id: string,
    updates: UpdateExpenseData,
  ): Promise<ServiceResponse<Expense>> {
    try {
      // Use partial validation for updates
      const errors = this.validateForUpdate(updates as Record<string, unknown>);
      if (errors.length > 0) {
        return {
          success: false,
          error: new Error(errors.map((e) => e.message).join(", ")),
        };
      }

      const expense = await this._repository.update(id, updates);
      return { success: true, data: expense as Expense };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Delete an expense
   * Uses repository directly
   */
  async delete(id: string): Promise<ServiceResponse<void>> {
    try {
      await this._repository.delete(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // ============================================================================
  // BUSINESS LOGIC METHODS
  // ============================================================================

  /**
   * Get expenses by date range
   */
  async getByDateRange(
    startDate: string,
    endDate: string,
    userId?: string,
  ): Promise<ServiceResponse<Expense[]>> {
    try {
      const expenses = await this._repository.findByDateRange(
        startDate,
        endDate,
        userId,
      );
      return { success: true, data: expenses as Expense[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get expense totals
   */
  async getTotals(
    filters?: ExpenseFilters,
  ): Promise<ServiceResponse<ExpenseTotals>> {
    try {
      const result = await this.getAllFiltered(filters);
      if (!result.success) {
        return { success: false, error: result.error };
      }

      const expenses = result.data || [];
      const now = new Date();

      const totals = expenses.reduce(
        (acc, expense) => {
          acc.total += expense.amount;

          if (expense.expense_type === "personal") {
            acc.personal += expense.amount;
          } else {
            acc.business += expense.amount;
          }

          if (expense.is_tax_deductible) {
            acc.deductible += expense.amount;
          }

          if (isSameMonth(expense.date, now)) {
            acc.monthlyTotal += expense.amount;
          }

          if (isSameYear(expense.date, now)) {
            acc.yearlyTotal += expense.amount;
          }

          return acc;
        },
        {
          total: 0,
          personal: 0,
          business: 0,
          deductible: 0,
          monthlyTotal: 0,
          yearlyTotal: 0,
        },
      );

      return { success: true, data: totals };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get monthly breakdown for a specific year
   */
  async getMonthlyBreakdown(
    year: number,
  ): Promise<ServiceResponse<MonthlyExpenseBreakdown[]>> {
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const result = await this.getByDateRange(startDate, endDate);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const expenses = result.data || [];
      const monthlyData: Record<string, MonthlyExpenseBreakdown> = {};

      expenses.forEach((expense) => {
        const monthKey = expense.date.substring(0, 7);

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            total: 0,
            personal: 0,
            business: 0,
            deductible: 0,
            byCategory: {},
          };
        }

        monthlyData[monthKey].total += expense.amount;

        if (expense.expense_type === "personal") {
          monthlyData[monthKey].personal += expense.amount;
        } else {
          monthlyData[monthKey].business += expense.amount;
        }

        if (expense.is_tax_deductible) {
          monthlyData[monthKey].deductible += expense.amount;
        }

        if (!monthlyData[monthKey].byCategory[expense.category]) {
          monthlyData[monthKey].byCategory[expense.category] = 0;
        }
        monthlyData[monthKey].byCategory[expense.category] += expense.amount;
      });

      const breakdown = Object.values(monthlyData).sort((a, b) =>
        a.month.localeCompare(b.month),
      );

      return { success: true, data: breakdown };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get yearly summary
   */
  async getYearlySummary(
    year: number,
  ): Promise<ServiceResponse<YearlyExpenseSummary>> {
    try {
      const breakdownResult = await this.getMonthlyBreakdown(year);
      if (!breakdownResult.success) {
        return { success: false, error: breakdownResult.error };
      }

      const monthlyBreakdown = breakdownResult.data || [];

      const summary: YearlyExpenseSummary = {
        year,
        total: 0,
        personal: 0,
        business: 0,
        deductible: 0,
        monthlyBreakdown,
        byCategory: {},
      };

      monthlyBreakdown.forEach((month) => {
        summary.total += month.total;
        summary.personal += month.personal;
        summary.business += month.business;
        summary.deductible += month.deductible;

        Object.entries(month.byCategory).forEach(([category, amount]) => {
          if (!summary.byCategory[category]) {
            summary.byCategory[category] = 0;
          }
          summary.byCategory[category] += amount;
        });
      });

      return { success: true, data: summary };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Import expenses from CSV data
   */
  async importFromCSV(
    csvData: string,
  ): Promise<ServiceResponse<{ imported: number; errors: string[] }>> {
    try {
      const lines = csvData.trim().split("\n");
      const headers = lines[0].toLowerCase().replace(/['"]/g, "").split(",");

      let imported = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].match(/(".*?"|[^,]+)/g) || [];
          const cleanValues = values.map((v) => v.replace(/^["']|["']$/g, ""));

          const recurringFreqValue =
            cleanValues[headers.indexOf("recurring frequency")];

          const expenseData: CreateExpenseData = {
            date: cleanValues[headers.indexOf("date")] || getTodayString(),
            name: cleanValues[headers.indexOf("name")] || "Imported Expense",
            description: cleanValues[headers.indexOf("description")] || null,
            amount: parseFloat(cleanValues[headers.indexOf("amount")] || "0"),
            category: cleanValues[headers.indexOf("category")] || "Other",
            expense_type:
              (cleanValues[headers.indexOf("type")] as
                | "personal"
                | "business") || "personal",
            is_tax_deductible:
              cleanValues[headers.indexOf("tax deductible")]?.toLowerCase() ===
              "yes",
            is_recurring:
              cleanValues[headers.indexOf("recurring")]?.toLowerCase() ===
              "yes",
            recurring_frequency:
              recurringFreqValue && recurringFreqValue.trim() !== ""
                ? (recurringFreqValue as CreateExpenseData["recurring_frequency"])
                : null,
            notes: cleanValues[headers.indexOf("notes")] || null,
          };

          const result = await this.create(expenseData);
          if (result.success) {
            imported++;
          } else {
            errors.push(
              `Row ${i + 1}: ${result.error?.message || "Unknown error"}`,
            );
          }
        } catch (error) {
          errors.push(
            `Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }

      return { success: true, data: { imported, errors } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // ============================================================================
  // HIERARCHY/TEAM METHODS
  // ============================================================================

  /**
   * Get expenses from downline agents
   */
  async getDownlineExpenses(
    dateRange?: ExpenseDateRange,
  ): Promise<ServiceResponse<DownlineExpense[]>> {
    try {
      const expenses = await this._repository.findDownlineExpenses(
        dateRange?.startDate,
        dateRange?.endDate,
      );
      return { success: true, data: expenses };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get expense summary by downline agent
   */
  async getDownlineExpenseSummary(
    dateRange?: ExpenseDateRange,
  ): Promise<ServiceResponse<AgentExpenseSummary[]>> {
    try {
      const summary = await this._repository.getDownlineExpenseSummary(
        dateRange?.startDate,
        dateRange?.endDate,
      );
      return { success: true, data: summary };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get expense summary for entire IMO (admin only)
   */
  async getImoExpenseSummary(
    dateRange?: ExpenseDateRange,
  ): Promise<ServiceResponse<AgentExpenseSummary[]>> {
    try {
      const summary = await this._repository.getImoExpenseSummary(
        dateRange?.startDate,
        dateRange?.endDate,
      );
      return { success: true, data: summary };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Get expense totals by category for IMO (admin only)
   */
  async getImoExpenseByCategory(
    dateRange?: ExpenseDateRange,
  ): Promise<ServiceResponse<CategoryExpenseSummary[]>> {
    try {
      const summary = await this._repository.getImoExpenseByCategory(
        dateRange?.startDate,
        dateRange?.endDate,
      );
      return { success: true, data: summary };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  // ============================================================================
  // INHERITED FROM BaseService (available without code):
  // ============================================================================
  // - getById(id: string): Promise<ServiceResponse<Expense>>
  // - getPaginated(page, pageSize, filters?, orderBy?, orderDirection?): Promise<ServiceResponse<ListResponse<Expense>>>
  // - createMany(items: CreateExpenseData[]): Promise<ServiceResponse<Expense[]>>
  // - exists(id: string): Promise<boolean>
  // - count(filters?): Promise<number>

  // ============================================================================
  // LEGACY API FOR BACKWARD COMPATIBILITY
  // ============================================================================

  /** @deprecated Use getAllFiltered instead */
  async getAllExpenses(filters?: ExpenseFilters): Promise<Expense[]> {
    const result = await this.getAllFiltered(filters);
    if (!result.success) {
      throw result.error;
    }
    return result.data || [];
  }

  /** @deprecated Use getById instead */
  async getExpenseById(id: string): Promise<Expense> {
    const result = await this.getById(id);
    if (!result.success) {
      throw result.error;
    }
    return result.data!;
  }

  /** @deprecated Use create instead */
  async createExpense(
    data: CreateExpenseData,
    userId?: string,
  ): Promise<Expense> {
    const result = await this.create(data, userId);
    if (!result.success) {
      throw result.error;
    }
    return result.data!;
  }

  /** @deprecated Use update instead */
  async updateExpense(
    id: string,
    updates: UpdateExpenseData,
  ): Promise<Expense> {
    const result = await this.update(id, updates);
    if (!result.success) {
      throw result.error;
    }
    return result.data!;
  }

  /** @deprecated Use delete instead */
  async deleteExpense(id: string): Promise<void> {
    const result = await this.delete(id);
    if (!result.success) {
      throw result.error;
    }
  }

  /** @deprecated Use getByDateRange instead */
  async getExpensesByDateRange(
    startDate: string,
    endDate: string,
    userId?: string,
  ): Promise<Expense[]> {
    const result = await this.getByDateRange(startDate, endDate, userId);
    if (!result.success) {
      throw result.error;
    }
    return result.data || [];
  }

  /** @deprecated Use getTotals instead */
  async getExpenseTotals(filters?: ExpenseFilters): Promise<ExpenseTotals> {
    const result = await this.getTotals(filters);
    if (!result.success) {
      throw result.error;
    }
    return result.data!;
  }

  /** @deprecated Use getMonthlyBreakdown instead */
  async getExpenseMonthlyBreakdown(
    year: number,
  ): Promise<MonthlyExpenseBreakdown[]> {
    const result = await this.getMonthlyBreakdown(year);
    if (!result.success) {
      throw result.error;
    }
    return result.data || [];
  }

  /** @deprecated Use getYearlySummary instead */
  async getExpenseYearlySummary(year: number): Promise<YearlyExpenseSummary> {
    const result = await this.getYearlySummary(year);
    if (!result.success) {
      throw result.error;
    }
    return result.data!;
  }
}

// Create singleton with repository injection
const expenseRepository = new ExpenseRepository();
export const expenseService = new ExpenseServiceClass(expenseRepository);

// Export class for testing
export { ExpenseServiceClass };
