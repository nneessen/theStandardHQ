import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatDateForDB,
  formatDateForDisplay,
  parseLocalDate,
} from "@/lib/date";

interface LeaderboardCustomRangeProps {
  startDate?: string;
  endDate?: string;
  onChange: (start: string | undefined, end: string | undefined) => void;
}

interface Preset {
  label: string;
  hint?: string;
  getValue: () => { from: Date; to: Date };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(d, diff));
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0);
}

const PRESETS: Preset[] = [
  {
    label: "Today",
    getValue: () => {
      const t = startOfDay(new Date());
      return { from: t, to: t };
    },
  },
  {
    label: "Yesterday",
    getValue: () => {
      const y = addDays(startOfDay(new Date()), -1);
      return { from: y, to: y };
    },
  },
  {
    label: "Last 7 days",
    getValue: () => {
      const today = startOfDay(new Date());
      return { from: addDays(today, -6), to: today };
    },
  },
  {
    label: "Last 14 days",
    getValue: () => {
      const today = startOfDay(new Date());
      return { from: addDays(today, -13), to: today };
    },
  },
  {
    label: "Last 30 days",
    getValue: () => {
      const today = startOfDay(new Date());
      return { from: addDays(today, -29), to: today };
    },
  },
  {
    label: "Last 90 days",
    getValue: () => {
      const today = startOfDay(new Date());
      return { from: addDays(today, -89), to: today };
    },
  },
  {
    label: "This week",
    hint: "Mon–today",
    getValue: () => {
      const today = startOfDay(new Date());
      return { from: startOfWeek(today), to: today };
    },
  },
  {
    label: "Last week",
    getValue: () => {
      const today = startOfDay(new Date());
      const thisWeekStart = startOfWeek(today);
      const lastWeekStart = addDays(thisWeekStart, -7);
      const lastWeekEnd = addDays(thisWeekStart, -1);
      return { from: lastWeekStart, to: lastWeekEnd };
    },
  },
  {
    label: "Last month",
    getValue: () => {
      const today = new Date();
      const lastMonthAnyDay = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1,
      );
      return {
        from: startOfMonth(lastMonthAnyDay),
        to: endOfMonth(lastMonthAnyDay),
      };
    },
  },
  {
    label: "This quarter",
    getValue: () => {
      const today = startOfDay(new Date());
      return { from: startOfQuarter(today), to: today };
    },
  },
  {
    label: "Last quarter",
    getValue: () => {
      const today = new Date();
      const lastQuarterRef = new Date(
        today.getFullYear(),
        today.getMonth() - 3,
        1,
      );
      return {
        from: startOfQuarter(lastQuarterRef),
        to: endOfQuarter(lastQuarterRef),
      };
    },
  },
  {
    label: "Last year",
    getValue: () => {
      const y = new Date().getFullYear() - 1;
      return {
        from: new Date(y, 0, 1),
        to: new Date(y, 11, 31),
      };
    },
  },
];

export function LeaderboardCustomRange({
  startDate,
  endDate,
  onChange,
}: LeaderboardCustomRangeProps) {
  const [open, setOpen] = useState(false);

  const range = useMemo<DateRange | undefined>(() => {
    if (!startDate && !endDate) return undefined;
    return {
      from: startDate ? parseLocalDate(startDate) : undefined,
      to: endDate ? parseLocalDate(endDate) : undefined,
    };
  }, [startDate, endDate]);

  const triggerLabel = useMemo(() => {
    if (range?.from && range?.to) {
      return `${formatDateForDisplay(range.from, { month: "short", day: "numeric" })} – ${formatDateForDisplay(range.to, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (range?.from) {
      return `${formatDateForDisplay(range.from, { month: "short", day: "numeric" })} – …`;
    }
    return "Pick range";
  }, [range]);

  const handleSelect = (next: DateRange | undefined) => {
    if (!next?.from) {
      onChange(undefined, undefined);
      return;
    }

    if (next.from && next.to) {
      onChange(formatDateForDB(next.from), formatDateForDB(next.to));
      setOpen(false);
    } else {
      onChange(formatDateForDB(next.from), undefined);
    }
  };

  const handlePreset = (preset: Preset) => {
    const value = preset.getValue();
    onChange(formatDateForDB(value.from), formatDateForDB(value.to));
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(undefined, undefined);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors shadow-sm",
            "hover:border-foreground/30 hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            !range?.from && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-3 w-3 text-muted-foreground" />
          <span className="whitespace-nowrap">{triggerLabel}</span>
          {range?.from && (
            <X
              role="button"
              aria-label="Clear date range"
              className="h-3 w-3 text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-0 overflow-hidden bg-popover text-popover-foreground"
        sideOffset={6}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Preset rail */}
          <div className="flex flex-col gap-0.5 border-b sm:border-b-0 sm:border-r border-border bg-muted/40 p-1.5 sm:w-[150px]">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 pt-1 pb-0.5">
              Quick select
            </p>
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePreset(preset)}
                className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-left text-[11px] text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none transition-colors"
              >
                <span>{preset.label}</span>
                {preset.hint && (
                  <span className="text-[10px] text-muted-foreground">
                    {preset.hint}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={range?.from || new Date()}
              selected={range}
              onSelect={handleSelect}
              disabled={{ after: new Date() }}
              className="p-0"
            />
            <div className="flex items-center justify-between border-t border-border px-1 pt-2 mt-1">
              <button
                type="button"
                onClick={() => onChange(undefined, undefined)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                disabled={!range?.from || !range?.to}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
