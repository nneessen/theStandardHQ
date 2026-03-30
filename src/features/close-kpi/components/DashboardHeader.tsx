// src/features/close-kpi/components/DashboardHeader.tsx
// Simplified header for the pre-built dashboard.
// Global date range selector + refresh + rescore buttons.

import React from "react";
import { RefreshCw, Flame, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalDateRange } from "./GlobalDateRange";
import type { DateRangePreset } from "../types/close-kpi.types";

interface DashboardHeaderProps {
  dateRange: DateRangePreset;
  onDateRangeChange: (value: DateRangePreset) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onRescore: () => void;
  isRescoring: boolean;
  lastUpdated: string | null;
}

function formatTimeAgo(ts: string | null): string {
  if (!ts) return "";
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  dateRange,
  onDateRangeChange,
  onRefresh,
  isRefreshing,
  onRescore,
  isRescoring,
  lastUpdated,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      {/* Left: Title + last updated */}
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-xs font-bold text-foreground whitespace-nowrap">
          CRM Analytics
        </h2>
        {lastUpdated && (
          <span className="text-[9px] text-muted-foreground whitespace-nowrap">
            Updated {formatTimeAgo(lastUpdated)}
          </span>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <GlobalDateRange value={dateRange} onChange={onDateRangeChange} />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
          onClick={onRescore}
          disabled={isRescoring}
          title="Re-score all leads with AI"
        >
          {isRescoring ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Flame className="h-3 w-3" />
          )}
          <span className="hidden sm:inline">
            {isRescoring ? "Scoring..." : "Rescore"}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh all data"
        >
          <RefreshCw
            className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    </div>
  );
};
