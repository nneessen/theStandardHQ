// src/features/dashboard/components/DateRangeDisplay.tsx

import React from "react";
import {
  TimePeriod,
  formatDateRange,
  type DateRange,
} from "../../../utils/dateRange";

interface DateRangeDisplayProps {
  timePeriod: TimePeriod;
  dateRange: DateRange;
}

export const DateRangeDisplay: React.FC<DateRangeDisplayProps> = ({
  timePeriod,
  dateRange,
}) => {
  const getPeriodDescription = (period: TimePeriod): string => {
    switch (period) {
      case "daily":
        return "Today";
      case "weekly":
        return "Last 7 Days";
      case "monthly":
        return "Month-to-Date";
      case "yearly":
        return "Year-to-Date";
      default:
        return "Current Period";
    }
  };

  return (
    <div className="flex items-center gap-1.5 px-1.5 sm:px-2 py-1 bg-v2-card-tinted dark:bg-v2-card-tinted rounded text-[10px]">
      <span className="font-medium text-v2-ink dark:text-v2-ink hidden sm:inline">
        {getPeriodDescription(timePeriod)}
      </span>
      <span className="text-v2-ink-subtle dark:text-v2-ink-muted hidden sm:inline">
        •
      </span>
      <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
        {formatDateRange(dateRange)}
      </span>
    </div>
  );
};
