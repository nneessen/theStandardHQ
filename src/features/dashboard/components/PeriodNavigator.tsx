// src/features/dashboard/components/PeriodNavigator.tsx

import React from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  TimePeriod,
  DateRange,
  getPeriodDescriptor,
  getDateRange,
} from "../../../utils/dateRange";
import { cn } from "../../../lib/utils";

interface PeriodNavigatorProps {
  timePeriod: TimePeriod;
  periodOffset: number;
  onOffsetChange: (offset: number) => void;
  dateRange: DateRange;
}

/**
 * PeriodNavigator - Compact zinc-styled navigation controls
 */
export const PeriodNavigator: React.FC<PeriodNavigatorProps> = ({
  timePeriod,
  periodOffset,
  onOffsetChange,
  dateRange,
}) => {
  // Generate dropdown options for last 12 periods
  const generateDropdownOptions = () => {
    const options: Array<{ offset: number; label: string }> = [];
    for (let i = 0; i >= -11; i--) {
      const offsetDateRange = getDateRange(timePeriod, i);
      const label = getPeriodDescriptor(timePeriod, i, offsetDateRange);
      options.push({ offset: i, label });
    }
    return options;
  };

  const dropdownOptions = generateDropdownOptions();
  const currentPeriodLabel = getPeriodDescriptor(
    timePeriod,
    periodOffset,
    dateRange,
  );
  const isAtCurrentPeriod = periodOffset === 0;

  const handlePrevious = () => {
    onOffsetChange(periodOffset - 1);
  };

  const handleNext = () => {
    if (periodOffset < 0) {
      onOffsetChange(periodOffset + 1);
    }
  };

  const handleJumpToCurrent = () => {
    onOffsetChange(0);
  };

  const handleSelectFromDropdown = (offset: number) => {
    onOffsetChange(offset);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Previous Button */}
      <Button
        onClick={handlePrevious}
        variant="outline"
        size="sm"
        className="h-6 w-6 p-0 border-v2-ring dark:border-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas"
        title="Previous period"
      >
        <ChevronLeft className="h-3 w-3" />
      </Button>

      {/* Period Label with Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px] font-medium text-v2-ink dark:text-v2-ink hover:bg-v2-card-tinted dark:hover:bg-v2-card-tinted"
            title="Select period"
          >
            {currentPeriodLabel}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="max-h-[300px] overflow-y-auto bg-v2-card border-v2-ring dark:border-v2-ring-strong"
        >
          {dropdownOptions.map((option) => (
            <DropdownMenuItem
              key={option.offset}
              onClick={() => handleSelectFromDropdown(option.offset)}
              className={cn(
                "cursor-pointer text-[10px] text-v2-ink dark:text-v2-ink-muted",
                option.offset === periodOffset &&
                  "bg-v2-card-tinted dark:bg-v2-card-tinted font-semibold text-v2-ink dark:text-v2-ink",
              )}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Next Button - Disabled at current period */}
      <Button
        onClick={handleNext}
        variant="outline"
        size="sm"
        className="h-6 w-6 p-0 border-v2-ring dark:border-v2-ring-strong text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas"
        disabled={isAtCurrentPeriod}
        title={isAtCurrentPeriod ? "Already at current period" : "Next period"}
      >
        <ChevronRight className="h-3 w-3" />
      </Button>

      {/* Jump to Current Button - Only shown when not at current period */}
      {!isAtCurrentPeriod && (
        <Button
          onClick={handleJumpToCurrent}
          variant="ghost"
          size="sm"
          className="h-6 px-2 gap-1 text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas"
          title="Jump to current period"
        >
          <Calendar className="h-3 w-3" />
          <span>Current</span>
        </Button>
      )}
    </div>
  );
};
