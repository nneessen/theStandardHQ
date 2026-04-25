import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimePeriod } from "../../../utils/dateRange";

interface MastheadProps {
  /** Title rendered as the masthead headline (e.g., "April 2026"). */
  title: string;
  /** Italic subtitle (e.g., "Day 25 of 30"). */
  subtitle?: string;
  /** Period selector. */
  timePeriod: TimePeriod;
  onTimePeriodChange: (p: TimePeriod) => void;
  /** Period offset (0 = current). */
  periodOffset: number;
  onOffsetChange: (n: number) => void;
  /** 0..1 — how far through the current period we are. Renders as a hairline progress bar. */
  elapsedPct: number;
}

const PERIODS: { id: TimePeriod; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "MTD", label: "MTD" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

export const Masthead: React.FC<MastheadProps> = ({
  title,
  subtitle,
  timePeriod,
  onTimePeriodChange,
  periodOffset,
  onOffsetChange,
  elapsedPct,
}) => {
  const isCurrent = periodOffset === 0;

  return (
    <header className="border-b border-zinc-900 dark:border-zinc-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-2">
        {/* Title block */}
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="font-mono tabular-nums text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
            {title}
          </h1>
          {subtitle && (
            <span className="text-[11px] italic text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
              {subtitle}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Period switcher — text links, no pill chrome */}
          <nav className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] font-semibold">
            {PERIODS.map((p, i) => (
              <React.Fragment key={p.id}>
                {i > 0 && (
                  <span
                    aria-hidden
                    className="text-zinc-300 dark:text-zinc-700"
                  >
                    ·
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onTimePeriodChange(p.id)}
                  className={cn(
                    "transition-colors",
                    timePeriod === p.id
                      ? "text-zinc-900 dark:text-zinc-100 underline underline-offset-4 decoration-2"
                      : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300",
                  )}
                >
                  {p.label}
                </button>
              </React.Fragment>
            ))}
          </nav>

          {/* Period nav */}
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 dark:text-zinc-400">
            <button
              type="button"
              onClick={() => onOffsetChange(periodOffset - 1)}
              className="p-0.5 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => onOffsetChange(0)}
              disabled={isCurrent}
              className={cn(
                "px-1 transition-colors",
                isCurrent
                  ? "text-zinc-300 dark:text-zinc-700 cursor-default"
                  : "hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => onOffsetChange(periodOffset + 1)}
              disabled={isCurrent}
              className={cn(
                "p-0.5 transition-colors",
                isCurrent
                  ? "text-zinc-300 dark:text-zinc-700 cursor-default"
                  : "hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
              aria-label="Next period"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Hairline period-elapsed indicator */}
      <div className="relative h-px bg-zinc-200 dark:bg-zinc-800">
        <div
          className="absolute inset-y-0 left-0 bg-zinc-900 dark:bg-zinc-100"
          style={{ width: `${Math.max(0, Math.min(1, elapsedPct)) * 100}%` }}
        />
      </div>
    </header>
  );
};
