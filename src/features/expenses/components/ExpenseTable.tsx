// src/features/expenses/components/ExpenseTable.tsx

import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TINT } from "@/components/ui/StatusBadge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Expense } from "@/types/expense.types";

interface ExpenseTableProps {
  expenses: Expense[];
  isLoading: boolean;
  hasFiltersApplied: boolean;
  monthYear: string;
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  onClearFilters: () => void;
}

export function ExpenseTable({
  expenses,
  isLoading,
  hasFiltersApplied,
  monthYear,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onClearFilters,
}: ExpenseTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          All Expenses
        </div>
        <Button size="sm" onClick={onAddExpense}>
          + Add Expense
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Loading expenses...</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : expenses.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>
                {hasFiltersApplied
                  ? "No expenses match your filters"
                  : "No expenses for this month"}
              </EmptyTitle>
              <EmptyDescription>
                {hasFiltersApplied
                  ? "Try adjusting your filters or clearing them to see more results"
                  : `Add your first expense for ${monthYear}`}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {hasFiltersApplied ? (
                <Button variant="outline" size="sm" onClick={onClearFilters}>
                  Clear Filters
                </Button>
              ) : (
                <Button size="sm" onClick={onAddExpense}>
                  Add First Expense
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                    Date
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                    Name
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                    Category
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                    Type
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-right">
                    Amount
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-v2-ring">
                {expenses.map((expense) => (
                  <TableRow key={expense.id} className="py-2">
                    <TableCell className="font-medium text-sm">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">
                          {expense.name}
                        </div>
                        {expense.description && (
                          <div className="text-sm text-muted-foreground">
                            {expense.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {expense.category}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded border ${expense.expense_type === "business" ? TINT.blue : TINT.slate}`}
                      >
                        {expense.expense_type === "business"
                          ? "Business"
                          : "Personal"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {expense.is_tax_deductible && (
                          <Badge variant="secondary" className="text-primary">
                            Tax Deductible
                          </Badge>
                        )}
                        {expense.is_recurring && (
                          <Badge
                            variant="secondary"
                            className="text-status-lapsed"
                          >
                            Recurring
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEditExpense(expense)}
                          aria-label="Edit expense"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteExpense(expense)}
                          aria-label="Delete expense"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
