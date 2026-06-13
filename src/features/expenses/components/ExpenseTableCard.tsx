// src/features/expenses/components/ExpenseTableCard.tsx

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TINT } from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "../../../lib/format";
import { formatDateForDisplay } from "../../../lib/date";
import { EXPENSE_CARD_STYLES } from "../config/expenseDashboardConfig";
import { cn } from "@/lib/utils";
import { Search, X, Edit, Trash2, Plus } from "lucide-react";
import type {
  Expense,
  AdvancedExpenseFilters,
} from "../../../types/expense.types";

export interface ExpenseTableCardProps {
  expenses: Expense[];
  isLoading: boolean;
  filters: AdvancedExpenseFilters;
  onFiltersChange: (filters: AdvancedExpenseFilters) => void;
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
  categories: string[];
  hasFiltersApplied: boolean;
  onClearFilters: () => void;
}

/**
 * ExpenseTableCard - Table with integrated filters
 *
 * Features:
 * - Inline filter controls
 * - Search by name/description
 * - Filter by type, category, deductible
 * - Row actions (edit/delete)
 * - Empty states
 */
export function ExpenseTableCard({
  expenses,
  isLoading,
  filters,
  onFiltersChange,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  categories,
  hasFiltersApplied,
  onClearFilters,
}: ExpenseTableCardProps) {
  return (
    <Card>
      <CardHeader className={cn(EXPENSE_CARD_STYLES.header, "space-y-4")}>
        {/* Title + Actions */}
        <div className="flex items-center justify-between">
          <div className={EXPENSE_CARD_STYLES.title}>All Expenses</div>
          <Button size="sm" onClick={onAddExpense} className="h-8 px-3">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Expense
          </Button>
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={filters.searchTerm || ""}
              onChange={(e) =>
                onFiltersChange({ ...filters, searchTerm: e.target.value })
              }
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* Type Filter */}
          <Select
            value={filters.expenseType || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                expenseType: value as "all" | "business" | "personal",
              })
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select
            value={filters.category || "all"}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, category: value })
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasFiltersApplied && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-9 px-3"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {hasFiltersApplied
              ? "No expenses match your filters"
              : "No expenses yet. Add your first expense!"}
          </div>
        ) : (
          <div className="rounded-b-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
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
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-right w-24">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-v2-ring">
                {expenses.map((expense) => (
                  <TableRow key={expense.id} className="hover:bg-muted/10 py-2">
                    <TableCell className="text-sm">
                      {formatDateForDisplay(expense.date, {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm font-medium">
                          {expense.name}
                        </div>
                        {expense.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs">
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
                        {expense.expense_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-mono font-semibold text-right">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditExpense(expense)}
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteExpense(expense)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
