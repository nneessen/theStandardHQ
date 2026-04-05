// src/features/close-kpi/components/DashboardHeader.tsx
// Simplified header for the pre-built dashboard.
// Global date range selector + refresh + rescore buttons.

import React from "react";
import { RefreshCw } from "lucide-react";
import { formatTimeAgo } from "../lib/format-time";
import { Button } from "@/components/ui/button";
import { GlobalDateRange } from "./GlobalDateRange";
import type { DateRangePreset } from "../types/close-kpi.types";

interface DashboardHeaderProps {
  dateRange: DateRangePreset;
  onDateRangeChange: (value: DateRangePreset) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onRescore?: () => void;
  isRescoring?: boolean;
  lastUpdated: string | null;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  dateRange,
  onDateRangeChange,
  onRefresh,
  isRefreshing,
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
