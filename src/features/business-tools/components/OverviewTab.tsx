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
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400 mx-auto" />
          <p className="text-[10px] text-zinc-400">
            Loading financial summary...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-xs font-medium text-red-600 dark:text-red-400">
          Failed to load summary
        </p>
        <p className="text-[10px] text-zinc-500">
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
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {summary.totals.needs_review_count} transactions need review
          </span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-auto">
            Review Now &rarr;
          </span>
        </button>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
          <h3 className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Income & Expenses by Category
          </h3>
          <div className="h-[260px]">
            <CategoryChart data={summary.by_category} />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
          <h3 className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">
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
