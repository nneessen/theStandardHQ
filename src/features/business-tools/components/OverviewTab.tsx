// src/features/business-tools/components/OverviewTab.tsx
// Dashboard overview with summary cards, charts, and review queue

import { Loader2, AlertTriangle } from "lucide-react";
import { useSummary } from "../hooks/useBusinessTools";
import { SummaryCards } from "./SummaryCards";
import { CategoryChart } from "./CategoryChart";
import { MonthlyTrendChart } from "./MonthlyTrendChart";
import { ReviewQueue } from "./ReviewQueue";
import type { BusinessToolsTab } from "../types";

interface OverviewTabProps {
  onSwitchTab: (tab: BusinessToolsTab) => void;
}

export function OverviewTab({ onSwitchTab }: OverviewTabProps) {
  const { data: summary, isLoading, error } = useSummary();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-2">
          <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle mx-auto" />
          <p className="text-[10px] text-v2-ink-subtle">
            Loading financial summary...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-xs font-medium text-destructive">
          Failed to load summary
        </p>
        <p className="text-[10px] text-v2-ink-muted">
          {error instanceof Error
            ? error.message
            : "Service unavailable. Try again later."}
        </p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      <SummaryCards totals={summary.totals} />

      {/* Needs Review Banner */}
      {summary.totals.needs_review_count > 0 && (
        <button
          onClick={() => onSwitchTab("transactions")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 hover:bg-warning/20 dark:hover:bg-warning/30 transition-colors"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="text-[11px] font-medium text-warning">
            {summary.totals.needs_review_count} transactions need review
          </span>
          <span className="text-[10px] text-warning ml-auto">
            Review Now &rarr;
          </span>
        </button>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <h3 className="text-[11px] font-medium text-v2-ink-muted mb-2">
            Income & Expenses by Category
          </h3>
          <div className="h-[260px]">
            <CategoryChart data={summary.by_category} />
          </div>
        </div>

        <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
          <h3 className="text-[11px] font-medium text-v2-ink-muted mb-2">
            Monthly Income vs Expenses
          </h3>
          <div className="h-[260px]">
            <MonthlyTrendChart data={summary.by_month} />
          </div>
        </div>
      </div>

      {/* Review Queue */}
      <ReviewQueue
        transactions={summary.recent_review}
        onSwitchTab={onSwitchTab}
      />
    </div>
  );
}
