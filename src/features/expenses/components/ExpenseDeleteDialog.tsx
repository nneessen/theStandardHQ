// src/features/expenses/components/ExpenseDeleteDialog.tsx

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import type { Expense } from "@/types/expense.types";

interface ExpenseDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  onConfirm: (deleteOption: "single" | "future" | "all") => void;
  isDeleting: boolean;
}

export function ExpenseDeleteDialog({
  open,
  onOpenChange,
  expense,
  onConfirm,
  isDeleting,
}: ExpenseDeleteDialogProps) {
  const [deleteOption, setDeleteOption] = useState<"single" | "future" | "all">(
    "single",
  );

  if (!expense) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const isRecurring = expense.is_recurring && expense.recurring_group_id;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm p-3 bg-card border-border">
        <AlertDialogHeader className="space-y-1">
          <AlertDialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Delete Expense?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[11px] text-muted-foreground dark:text-muted-foreground">
            {isRecurring
              ? "This is a recurring expense. Choose how you want to delete it:"
              : "Are you sure you want to delete this expense? This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-2 rounded-lg border border-border bg-background p-2 space-y-1">
          <div className="text-[11px] font-semibold text-foreground">
            {expense.name}
          </div>
          <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">
            {expense.description}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Amount:
            </span>
            <span className="text-[11px] font-semibold text-foreground">
              {formatCurrency(expense.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
              Type:
            </span>
            <span className="text-[11px] font-semibold text-foreground capitalize">
              {expense.expense_type}
            </span>
          </div>
          {isRecurring && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                Recurring:
              </span>
              <span className="text-[11px] font-semibold text-foreground capitalize">
                {expense.recurring_frequency}
              </span>
            </div>
          )}
        </div>

        {isRecurring && (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">
              Delete options:
            </label>
            <div className="space-y-1.5">
              <label className="flex items-center space-x-2 cursor-pointer hover:bg-background rounded px-1 py-0.5 transition-colors">
                <input
                  type="radio"
                  name="deleteOption"
                  value="single"
                  checked={deleteOption === "single"}
                  onChange={(e) => setDeleteOption(e.target.value as "single")}
                  className="h-3 w-3 text-destructive focus:ring-destructive focus:ring-offset-0 border-border"
                />
                <div>
                  <div className="text-[11px] font-semibold text-foreground">
                    Just this one
                  </div>
                  <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                    Delete only this occurrence
                  </div>
                </div>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer hover:bg-background rounded px-1 py-0.5 transition-colors">
                <input
                  type="radio"
                  name="deleteOption"
                  value="future"
                  checked={deleteOption === "future"}
                  onChange={(e) => setDeleteOption(e.target.value as "future")}
                  className="h-3 w-3 text-destructive focus:ring-destructive focus:ring-offset-0 border-border"
                />
                <div>
                  <div className="text-[11px] font-semibold text-foreground">
                    This and all future
                  </div>
                  <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                    Stop recurring from this date forward
                  </div>
                </div>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer hover:bg-background rounded px-1 py-0.5 transition-colors">
                <input
                  type="radio"
                  name="deleteOption"
                  value="all"
                  checked={deleteOption === "all"}
                  onChange={(e) => setDeleteOption(e.target.value as "all")}
                  className="h-3 w-3 text-destructive focus:ring-destructive focus:ring-offset-0 border-border"
                />
                <div>
                  <div className="text-[11px] font-semibold text-foreground">
                    All occurrences
                  </div>
                  <div className="text-[10px] text-muted-foreground dark:text-muted-foreground">
                    Delete entire recurring series
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        <AlertDialogFooter className="gap-1 pt-3">
          <AlertDialogCancel
            disabled={isDeleting}
            className="h-7 px-2 text-[10px] border-border bg-card hover:bg-background"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(deleteOption)}
            disabled={isDeleting}
            className="h-7 px-2 text-[10px] bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
