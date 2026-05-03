// src/features/expenses/components/ExpenseTrendCard.tsx

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPENSE_CARD_STYLES } from "../config/expenseDashboardConfig";
import { cn } from "@/lib/utils";
import type { ExpenseTrendData } from "../../../types/expense.types";

export interface ExpenseTrendCardProps {
  data: ExpenseTrendData[];
}

/**
 * ExpenseTrendCard - Simple trend visualization
 *
 * Shows monthly trend for last 6 months with:
 * - Month labels
 * - Business vs Personal bar chart
 * - Total trend line (visual only)
 *
 * Simplified version - full chart implementation can be enhanced later
 */
export function ExpenseTrendCard({ data }: ExpenseTrendCardProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className={EXPENSE_CARD_STYLES.header}>
          <CardTitle className={EXPENSE_CARD_STYLES.title}>
            Expense Trend
          </CardTitle>
        </CardHeader>
        <CardContent className={EXPENSE_CARD_STYLES.content}>
          <div className="text-center text-muted-foreground text-sm py-8">
            No trend data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.total));

  return (
    <Card>
      <CardHeader className={EXPENSE_CARD_STYLES.header}>
        <CardTitle className={EXPENSE_CARD_STYLES.title}>
          6-Month Trend
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(EXPENSE_CARD_STYLES.content, "space-y-4")}>
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-info" />
            <span className="text-muted-foreground">Business</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-info" />
            <span className="text-muted-foreground">Personal</span>
          </div>
        </div>

        {/* Chart */}
        <div className="space-y-3">
          {data.map((month) => (
            <div key={month.month} className="space-y-1">
              <div className="text-xs text-muted-foreground font-medium">
                {month.month}
              </div>
              <div className="flex gap-1 h-8">
                {/* Business bar */}
                <div
                  className="bg-info rounded transition-all duration-300"
                  style={{
                    width: `${maxAmount > 0 ? (month.business / maxAmount) * 100 : 0}%`,
                  }}
                  title={`Business: $${month.business.toFixed(2)}`}
                />
                {/* Personal bar */}
                <div
                  className="bg-info rounded transition-all duration-300"
                  style={{
                    width: `${maxAmount > 0 ? (month.personal / maxAmount) * 100 : 0}%`,
                  }}
                  title={`Personal: $${month.personal.toFixed(2)}`}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
