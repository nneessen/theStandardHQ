// src/features/expenses/components/ExpenseDialogCompact.tsx
//
// Add/Edit Expense dialog — a guided 3-step wizard (Details → Options → Review)
// modeled on the Add Policy dialog so the two read as one family. This file is
// the thin Dialog shell; the wizard logic lives in `ExpenseForm`.
//
// The exported component name and prop shape are unchanged from the previous
// compact dialog, so every call site (the /expenses page add+edit and the
// dashboard quick-add) keeps working with no edits.

import { useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import type { Expense } from "@/types/expense.types";
import type { LeadPurchase } from "@/types/lead-purchase.types";
import { ExpenseForm } from "./ExpenseForm";
import type { CreateExpenseWithLeadData } from "./expenseWizardTypes";

// Re-export so existing importers (`ExpenseDashboardCompact`) keep their path.
export type { CreateExpenseWithLeadData } from "./expenseWizardTypes";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  linkedLeadPurchase?: LeadPurchase | null;
  onSave: (data: CreateExpenseWithLeadData) => void;
  isSubmitting: boolean;
}

/**
 * ExpenseDialogCompact — wraps `ExpenseForm` in a shadcn/ui Dialog. Opens wide
 * (max-w-4xl) so the two-pane wizard (an ordered field column beside a sticky
 * summary rail) has room; the `w-[calc(100vw-Xrem)]` cap keeps it inside the
 * viewport on narrow screens, where the panes stack and the body scrolls.
 * Header + footer stay fixed; only the form body scrolls.
 */
export function ExpenseDialogCompact({
  open,
  onOpenChange,
  expense,
  linkedLeadPurchase = null,
  onSave,
  isSubmitting,
}: ExpenseDialogProps) {
  // Block close (button / ESC / click-outside) while a save is in flight.
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && isSubmitting) return;
      onOpenChange(newOpen);
    },
    [isSubmitting, onOpenChange],
  );

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="theme-v2 font-display p-0 gap-0 overflow-hidden rounded-v2-lg bg-card text-foreground border border-border shadow-v2-lift ring-0 outline-none w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-3rem)] max-w-4xl max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col"
        hideCloseButton
        onPointerDownOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">
          {expense ? "Edit expense" : "Add expense"}
        </DialogTitle>

        {/* Header — fixed, no scroll */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-v2-card-tinted flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.18em]">
                {expense ? "Edit" : "New"}
              </span>
              <span className="text-base font-semibold tracking-tight text-foreground">
                {expense ? "Edit expense" : "Add expense"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-v2-pill text-foreground hover:bg-accent/40 disabled:opacity-40 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Wizard — keyed so switching expenses re-initializes cleanly */}
        <ExpenseForm
          key={expense?.id ?? "new"}
          expense={expense}
          linkedLeadPurchase={linkedLeadPurchase}
          onSave={onSave}
          onCancel={handleClose}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
