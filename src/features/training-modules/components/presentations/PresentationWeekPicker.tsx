// src/features/training-modules/components/presentations/PresentationWeekPicker.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PresentationWeekPickerProps {
  weekStart: string; // YYYY-MM-DD (always a Monday)
  onChange: (weekStart: string) => void;
}

/**
 * Get the Monday of the current week
 */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Adjust so Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

/**
 * Format a week range for display: "Jan 6 - Jan 12, 2026"
 */
function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

function shiftWeek(weekStart: string, direction: -1 | 1): string {
  const date = new Date(weekStart + "T00:00:00");
  date.setDate(date.getDate() + direction * 7);
  return date.toISOString().split("T")[0];
}

export function PresentationWeekPicker({
  weekStart,
  onChange,
}: PresentationWeekPickerProps) {
  const currentWeek = getCurrentWeekStart();
  const isCurrentWeek = weekStart === currentWeek;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => onChange(shiftWeek(weekStart, -1))}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>

      <span className="text-[11px] font-medium text-v2-ink dark:text-v2-ink-muted min-w-[140px] text-center">
        {formatWeekRange(weekStart)}
        {isCurrentWeek && (
          <span className="ml-1 text-[10px] text-info">(this week)</span>
        )}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={() => onChange(shiftWeek(weekStart, 1))}
        disabled={isCurrentWeek}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
