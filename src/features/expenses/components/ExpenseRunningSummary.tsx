// src/features/expenses/components/ExpenseRunningSummary.tsx

import React from "react";
import { Briefcase, User, Repeat, Receipt, Users } from "lucide-react";
import type { CreateExpenseData } from "@/types/expense.types";
import { formatDateForDisplay } from "@/lib/date";
import { getRecurringLabel } from "../config/recurringConfig";
import { annualizeAmount, costPerLead, formatUSD } from "./expenseWizardCalc";

interface ExpenseRunningSummaryProps {
  formData: CreateExpenseData;
  /** Number of leads, as entered (string) — only meaningful for lead expenses. */
  leadCount: string;
  vendorName: string;
  isLeadCategory: boolean;
}

function StatLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">
        {value || <span className="text-muted-foreground/60">—</span>}
      </span>
    </div>
  );
}

/**
 * The always-on summary rail beside the wizard. It does NOT echo raw inputs — it
 * surfaces the computed values that help the agent sanity-check what they're
 * entering: the running amount, cost-per-lead for lead buys, and the annualized
 * cost of a recurring expense.
 */
export const ExpenseRunningSummary: React.FC<ExpenseRunningSummaryProps> = ({
  formData,
  leadCount,
  vendorName,
  isLeadCategory,
}) => {
  const amount = formData.amount || 0;
  const isBusiness = formData.expense_type === "business";

  const parsedLeads = parseInt(leadCount, 10);
  const perLead =
    isLeadCategory && parsedLeads > 0 ? costPerLead(amount, parsedLeads) : 0;

  const annualCost =
    formData.is_recurring && formData.recurring_frequency
      ? annualizeAmount(amount, formData.recurring_frequency)
      : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Summary
        </span>
        <div className="text-3xl font-semibold tracking-tight text-foreground">
          {formatUSD(amount)}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              isBusiness
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border/70 bg-muted/40 text-muted-foreground",
            ].join(" ")}
          >
            {isBusiness ? (
              <Briefcase className="h-3 w-3" />
            ) : (
              <User className="h-3 w-3" />
            )}
            {isBusiness ? "Business" : "Personal"}
          </span>
          {formData.is_tax_deductible && (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              <Receipt className="h-3 w-3" />
              Tax deductible
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
        <StatLine label="Category" value={formData.category} />
        <StatLine
          label="Date"
          value={formData.date ? formatDateForDisplay(formData.date) : ""}
        />
      </div>

      {isLeadCategory && (
        <div className="space-y-2 rounded-xl border border-info/30 bg-info/10 p-3">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-info" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-info">
              Lead purchase
            </span>
          </div>
          <StatLine label="Vendor" value={vendorName} />
          <StatLine
            label="Leads"
            value={parsedLeads > 0 ? parsedLeads.toLocaleString() : ""}
          />
          {perLead > 0 && (
            <div className="flex items-baseline justify-between gap-3 border-t border-info/20 pt-2">
              <span className="text-[11px] font-medium text-info">
                Cost per lead
              </span>
              <span className="text-base font-semibold text-info">
                {formatUSD(perLead)}
              </span>
            </div>
          )}
        </div>
      )}

      {formData.is_recurring && formData.recurring_frequency && (
        <div className="space-y-2 rounded-xl border border-border/60 bg-background/40 p-3">
          <div className="flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Recurring · {getRecurringLabel(formData.recurring_frequency)}
            </span>
          </div>
          {annualCost > 0 && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-medium text-foreground">
                Annualized cost
              </span>
              <span className="text-base font-semibold text-foreground">
                {formatUSD(annualCost, false)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
