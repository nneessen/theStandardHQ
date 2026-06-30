// src/features/expenses/components/expenseWizardTypes.ts

import type { CreateExpenseData } from "@/types/expense.types";
import type { LeadFreshness } from "@/types/lead-purchase.types";

/**
 * Lead-purchase fields collected when the category is "Life Insurance Leads".
 * `leadCount` is kept as a string because it's bound to a text/number input.
 */
export interface LeadPurchaseFields {
  vendorId: string;
  leadCount: string;
  leadFreshness: LeadFreshness;
  purchaseName: string;
}

/**
 * Expense payload extended with optional lead-purchase info. The parent
 * (`handleSaveExpense`) splits this back apart to keep the expense row and the
 * linked `lead_purchases` row in sync. Shape is unchanged from the previous
 * compact dialog so the call sites need no edits.
 */
export interface CreateExpenseWithLeadData extends CreateExpenseData {
  leadPurchase?: {
    vendorId: string;
    leadCount: number;
    leadFreshness: LeadFreshness;
    purchaseName: string | null;
  };
}

/** Field-level validation errors, keyed by the field name. */
export type ExpenseFormErrors = Record<string, string>;
