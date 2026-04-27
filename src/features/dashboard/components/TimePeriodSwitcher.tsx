// src/features/dashboard/components/TimePeriodSwitcher.tsx

import React from "react";
import { Button } from "@/components/ui/button";
import { TimePeriodSwitcherProps } from "../../../types/dashboard.types";
import { TimePeriod } from "../../../utils/dateRange";
import { cn } from "@/lib/utils";

/**
 * Time Period Switcher - Compact zinc-styled tab bar
 */
export const TimePeriodSwitcher: React.FC<TimePeriodSwitcherProps> = ({
  timePeriod,
  onTimePeriodChange,
}) => {
  const periods: TimePeriod[] = ["daily", "weekly", "MTD", "monthly", "yearly"];

  return (
    <div className="flex items-center gap-0.5 bg-v2-card-tinted dark:bg-v2-card-tinted/50 rounded-md p-0.5">
      {periods.map((period) => (
        <Button
          key={period}
          onClick={() => onTimePeriodChange(period)}
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-1.5 sm:px-2 text-[9px] sm:text-[10px] font-medium capitalize rounded transition-all",
            timePeriod === period
              ? "bg-v2-card shadow-sm text-v2-ink dark:text-v2-ink"
              : "bg-transparent text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-ink-subtle",
          )}
        >
          {period}
        </Button>
      ))}
    </div>
  );
};
