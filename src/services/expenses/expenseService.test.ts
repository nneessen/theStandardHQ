// src/services/expenses/expenseService.test.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import { expenseService } from "./expense";
import { supabase } from "../base/supabase";
import type { CreateExpenseData, Expense } from "../../types/expense.types";

// Mock Supabase
vi.mock("../base/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
  TABLES: {
    EXPENSES: "expenses",
  },
}));

describe("ExpenseService", () => {
  const mockExpenseDBRecord = {
    id: "123",
    user_id: "user-1",
    name: "Office Supplies",
    description: "Pens and paper",
    amount: "45.99",
    category: "office" as const,
    expense_type: "business" as const,
    date: "2025-01-15",
    is_recurring: false,
    recurring_frequency: null,
    // A real `select("*")` always returns these columns (as null when unset).
    recurring_group_id: null,
    recurring_end_date: null,
    receipt_url: null,
    is_tax_deductible: true,
    notes: null,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-15T10:00:00Z",
  };

  const mockExpense: Expense = {
    id: "123",
    user_id: "user-1",
    name: "Office Supplies",
    description: "Pens and paper",
    amount: 45.99,
    category: "office",
    expense_type: "business",
    date: "2025-01-15",
    is_recurring: false,
    recurring_frequency: null,
    recurring_group_id: null,
    recurring_end_date: null,
    receipt_url: null,
    is_tax_deductible: true,
    notes: null,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-15T10:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAllFiltered", () => {
    it("should fetch all expenses successfully", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [mockExpenseDBRecord],
            error: null,
          }),
        }),
      });
      (supabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      const result = await expenseService.getAllFiltered();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toMatchObject(mockExpense);
      expect(mockFrom).toHaveBeenCalledWith("expenses");
    });

    it("should filter by expense type", async () => {
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
      };

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(mockQuery),
        }),
      });

      mockQuery.eq.mockResolvedValue({
        data: [mockExpenseDBRecord],
        error: null,
      });

      (supabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      await expenseService.getAllFiltered({ expenseType: "business" });

      expect(mockQuery.eq).toHaveBeenCalledWith("expense_type", "business");
    });

    it("should handle errors", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      });
      (supabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      const result = await expenseService.getAllFiltered();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("create", () => {
    it("should create expense successfully", async () => {
      const newExpenseData: CreateExpenseData = {
        name: "Office Supplies",
        description: "Pens and paper",
        amount: 45.99,
        category: "office",
        expense_type: "business",
        date: "2025-01-15",
        is_tax_deductible: true,
      };

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockExpenseDBRecord,
              error: null,
            }),
          }),
        }),
      });
      (supabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      const result = await expenseService.create(newExpenseData, "user-1");

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(mockExpense);
    });

    it("should handle creation errors", async () => {
      const newExpenseData: CreateExpenseData = {
        name: "Office Supplies",
        description: "Pens and paper",
        amount: 45.99,
        category: "office",
        expense_type: "business",
        date: "2025-01-15",
      };

      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Insert failed" },
            }),
          }),
        }),
      });
      (supabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      const result = await expenseService.create(newExpenseData, "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should fail without userId", async () => {
      const newExpenseData: CreateExpenseData = {
        name: "Office Supplies",
        description: "Pens and paper",
        amount: 45.99,
        category: "office",
        expense_type: "business",
        date: "2025-01-15",
      };

      const result = await expenseService.create(newExpenseData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("User ID is required");
    });
  });

  describe("update", () => {
    it("should update expense successfully", async () => {
      const updates = { amount: 50.0 };

      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockExpenseDBRecord, amount: "50.00" },
                error: null,
              }),
            }),
          }),
        }),
      });
      (supabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      const result = await expenseService.update("123", updates);

      expect(result.success).toBe(true);
      expect(result.data?.amount).toBe(50.0);
    });
  });

  describe("delete", () => {
    it("should delete expense successfully", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });
      (supabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      const result = await expenseService.delete("123");

      expect(result.success).toBe(true);
    });

    it("should handle deletion errors", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { message: "Delete failed" },
          }),
        }),
      });
      (supabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      const result = await expenseService.delete("123");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("getTotals", () => {
    it("should calculate totals correctly", async () => {
      // `date` is required: getTotals reads expense.date for its monthly/yearly
      // buckets (isSameMonth/isSameYear), which throw on undefined. A real
      // `select("*")` always returns it.
      const mockExpenses = [
        {
          amount: "100.00",
          expense_type: "business",
          is_tax_deductible: true,
          date: "2025-01-15",
        },
        {
          amount: "50.00",
          expense_type: "personal",
          is_tax_deductible: false,
          date: "2025-01-15",
        },
        {
          amount: "75.00",
          expense_type: "business",
          is_tax_deductible: true,
          date: "2025-01-15",
        },
      ];

      // getTotals delegates to getAllFiltered → findWithFilters, which builds
      // `.select("*").order("date", …)`. Mock that exact chain.
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockExpenses,
            error: null,
          }),
        }),
      });
      (supabase.from as ReturnType<typeof vi.fn>) = mockFrom;

      const result = await expenseService.getTotals();

      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(225);
      expect(result.data?.business).toBe(175);
      expect(result.data?.personal).toBe(50);
      expect(result.data?.deductible).toBe(175);
    });
  });
});
