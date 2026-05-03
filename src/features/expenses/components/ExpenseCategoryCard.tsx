// src/features/expenses/components/ExpenseCategoryCard.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "../../../lib/format";
import { EXPENSE_CARD_STYLES } from "../config/expenseDashboardConfig";
import { cn } from "@/lib/utils";
import type { CategoryBreakdownData } from "../../../types/expense.types";

export interface ExpenseCategoryCardProps {
  categories: CategoryBreakdownData[];
  totalAmount: number;
}

/**
 * ExpenseCategoryCard - Category breakdown with progress bars
 *
 * Displays top categories with:
 * - Category name and amount
 * - Percentage of total
 * - Progress bar with category-specific color
 */
export function ExpenseCategoryCard({
  categories,
  totalAmount,
}: ExpenseCategoryCardProps) {
  // Show top 5 categories + "Other" if more exist
  const topCategories = categories.slice(0, 5);
  const hasMore = categories.length > 5;
  const otherAmount = hasMore
    ? categories.slice(5).reduce((sum, cat) => sum + cat.amount, 0)
    : 0;

  return (
    <Card>
      <CardHeader className={EXPENSE_CARD_STYLES.header}>
        <CardTitle className={EXPENSE_CARD_STYLES.title}>
          Expenses by Category
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(EXPENSE_CARD_STYLES.content, EXPENSE_CARD_STYLES.spacing)}
      >
        {topCategories.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No expenses to display
          </div>
        ) : (
          <>
            {topCategories.map((category, index) => (
              <CategoryRow
                key={category.category}
                category={category}
                index={index}
              />
            ))}
            {hasMore && (
              <CategoryRow
                category={{
                  category: "Other",
                  amount: otherAmount,
                  percentage: (otherAmount / totalAmount) * 100,
                  count: 0,
                }}
                index={5}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * CategoryRow - Single category with progress bar
 */
function CategoryRow({
  category,
  index,
}: {
  category: CategoryBreakdownData;
  index: number;
}) {
  // Rotate through colors for visual distinction
  const colors = [
    "bg-info",
    "bg-success",
    "bg-info",
    "bg-warning",
    "bg-info",
    "bg-muted-foreground",
  ];
  const barColor = colors[index % colors.length];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">{category.category}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {category.percentage.toFixed(1)}%
          </span>
          <span className="font-mono font-semibold">
            {formatCurrency(category.amount)}
          </span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden shadow-inner">
        <div
          className={cn("h-full transition-all duration-300", barColor)}
          style={{ width: `${category.percentage}%` }}
        />
      </div>
    </div>
  );
}
