// src/features/expenses/components/expenseWizardCalc.ts
//
// Small pure helpers for the Add/Edit Expense wizard's computed readouts
// (running-summary rail + Review step). Kept here so the rail and the review
// never drift in how they annualize a recurring cost or price a lead.

import type { RecurringFrequency } from "@/types/expense.types";

/** How many times a given recurring frequency fires per year. */
const OCCURRENCES_PER_YEAR: Record<RecurringFrequency, number> = {
  daily: 365,
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  semiannually: 2,
  annually: 1,
};

/**
 * Annualized cost of a recurring expense (amount × occurrences/year). Returns 0
 * for a missing amount or frequency so callers can guard on `> 0`.
 */
export function annualizeAmount(
  amount: number,
  frequency: RecurringFrequency | null | undefined,
): number {
  if (!amount || amount <= 0 || !frequency) return 0;
  return amount * (OCCURRENCES_PER_YEAR[frequency] ?? 0);
}

/** Cost per lead = total spend / number of leads. Returns 0 when not computable. */
export function costPerLead(amount: number, leadCount: number): number {
  if (!amount || amount <= 0 || !leadCount || leadCount <= 0) return 0;
  return amount / leadCount;
}

/** Currency formatter with optional cents — expenses are exact (e.g. $42.50). */
export function formatUSD(amount: number, withCents = true): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  }).format(amount || 0);
}
