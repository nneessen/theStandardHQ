// src/features/analytics/components/TimePeriodSelector.tsx

import React, { useRef, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type AdvancedTimePeriod =
  | "MTD"
  | "YTD"
  | "L30"
  | "L60"
  | "L90"
  | "L12M"
  | "CUSTOM";

export interface AdvancedDateRange {
  startDate: Date;
  endDate: Date;
  actualEndDate: Date;
  period: AdvancedTimePeriod;
}

interface TimePeriodSelectorProps {
  selectedPeriod: AdvancedTimePeriod;
  onPeriodChange: (period: AdvancedTimePeriod) => void;
  customRange?: { startDate: Date; endDate: Date };
  onCustomRangeChange?: (range: { startDate: Date; endDate: Date }) => void;
}

export function getAdvancedDateRange(
  period: AdvancedTimePeriod,
  customRange?: { startDate: Date; endDate: Date },
): AdvancedDateRange {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;
  let actualEndDate: Date;

  switch (period) {
    case "MTD":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      actualEndDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      break;

    case "YTD":
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      actualEndDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;

    case "L30":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      actualEndDate = endDate;
      break;

    case "L60":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 60);
      startDate.setHours(0, 0, 0, 0);
      actualEndDate = endDate;
      break;

    case "L90":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
      actualEndDate = endDate;
      break;

    case "L12M":
      startDate = new Date(now);
      startDate.setFullYear(startDate.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
      actualEndDate = endDate;
      break;

    case "CUSTOM":
      if (customRange) {
        return {
          startDate: customRange.startDate,
          endDate: customRange.endDate,
          actualEndDate: customRange.endDate, // For custom, use selected end
          period,
        };
      }
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      actualEndDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      break;

    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      actualEndDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
  }

  return { startDate, endDate, actualEndDate, period };
}

/**
 * Format date range for display
 */
export function formatAdvancedDateRange(range: AdvancedDateRange): string {
  const start = format(range.startDate, "MMM d, yyyy");
  const end = format(range.endDate, "MMM d, yyyy");

  // If same day, just show one date
  if (start === end) {
    return start;
  }

  // If same year, optimize display
  if (range.startDate.getFullYear() === range.endDate.getFullYear()) {
    const startNoYear = format(range.startDate, "MMM d");
    return `${startNoYear} - ${end}`;
  }

  return `${start} - ${end}`;
}

export function TimePeriodSelector({
  selectedPeriod,
  onPeriodChange,
  customRange,
  onCustomRangeChange,
}: TimePeriodSelectorProps) {
  const [showCustomPicker, setShowCustomPicker] = React.useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Click-outside handler to dismiss the custom date picker
  useEffect(() => {
    if (!showCustomPicker) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCustomPicker(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [showCustomPicker]);

  const periods: { value: AdvancedTimePeriod; label: string }[] = [
    { value: "MTD", label: "MTD" },
    { value: "YTD", label: "YTD" },
    { value: "L30", label: "30D" },
    { value: "L60", label: "60D" },
    { value: "L90", label: "90D" },
    { value: "L12M", label: "12M" },
    { value: "CUSTOM", label: "Custom" },
  ];

  const currentRange = getAdvancedDateRange(selectedPeriod, customRange);
  const _displayRange = formatAdvancedDateRange(currentRange);

  return (
    <div className="relative">
      <div className="flex items-center gap-0.5 bg-v2-card-tinted dark:bg-v2-card-tinted/50 rounded-md p-0.5 overflow-x-auto">
        {periods.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => {
              onPeriodChange(value);
              if (value === "CUSTOM") {
                setShowCustomPicker(true);
              } else {
                setShowCustomPicker(false);
              }
            }}
            className={cn(
              "px-2 py-1 text-[10px] font-medium rounded transition-all whitespace-nowrap",
              selectedPeriod === value
                ? "bg-v2-card shadow-sm text-v2-ink dark:text-v2-ink"
                : "text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-ink-subtle",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom date picker */}
      {showCustomPicker &&
        selectedPeriod === "CUSTOM" &&
        onCustomRangeChange && (
          <div
            ref={pickerRef}
            className="absolute top-full right-0 mt-2 p-3 bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring shadow-lg z-50"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={
                    customRange
                      ? format(customRange.startDate, "yyyy-MM-dd")
                      : format(new Date(), "yyyy-MM-dd")
                  }
                  onChange={(e) => {
                    const [year, month, day] = e.target.value
                      .split("-")
                      .map(Number);
                    const newStart = new Date(year, month - 1, day, 0, 0, 0, 0);
                    onCustomRangeChange({
                      startDate: newStart,
                      endDate: customRange?.endDate || new Date(),
                    });
                  }}
                  className="w-full px-2 py-1 text-[11px] text-v2-ink dark:text-v2-ink bg-v2-canvas dark:bg-v2-card-tinted border border-v2-ring dark:border-v2-ring-strong rounded"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle uppercase tracking-wider mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={
                    customRange
                      ? format(customRange.endDate, "yyyy-MM-dd")
                      : format(new Date(), "yyyy-MM-dd")
                  }
                  onChange={(e) => {
                    const [year, month, day] = e.target.value
                      .split("-")
                      .map(Number);
                    const newEnd = new Date(
                      year,
                      month - 1,
                      day,
                      23,
                      59,
                      59,
                      999,
                    );
                    onCustomRangeChange({
                      startDate: customRange?.startDate || new Date(),
                      endDate: newEnd,
                    });
                  }}
                  className="w-full px-2 py-1 text-[11px] text-v2-ink dark:text-v2-ink bg-v2-canvas dark:bg-v2-card-tinted border border-v2-ring dark:border-v2-ring-strong rounded"
                />
              </div>
            </div>
            <button
              onClick={() => setShowCustomPicker(false)}
              className="mt-2 w-full px-3 py-1 text-[11px] font-medium text-white bg-v2-ink dark:bg-v2-card-tinted dark:text-v2-ink rounded hover:bg-v2-ink-muted dark:hover:bg-v2-ring transition-colors"
            >
              Apply
            </button>
          </div>
        )}
    </div>
  );
}
