import React from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export interface PaceLine {
  label: string;
  current: number;
  target: number | null;
  unit?: "$" | "%" | "#";
  /** When true, exceeding target is bad (e.g. expenses). */
  invert?: boolean;
}

interface PaceLinesProps {
  lines: PaceLine[];
  /** Days elapsed in the period (for the subtitle). */
  daysElapsed?: number;
  /** Total days in the period. */
  daysTotal?: number;
  /** 0..1 — expected pace position; renders as a tick on each bar. */
  expectedPct: number;
}

function formatRaw(value: number, unit?: "$" | "%" | "#"): string {
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "$") {
    if (Math.abs(value) >= 100_000) return `$${(value / 1000).toFixed(0)}k`;
    if (Math.abs(value) >= 10_000) return `$${(value / 1000).toFixed(1)}k`;
    return formatCurrency(value);
  }
  return Math.round(value).toLocaleString();
}

export const PaceLines: React.FC<PaceLinesProps> = ({
  lines,
  daysElapsed,
  daysTotal,
  expectedPct,
}) => {
  return (
    <section className="py-6 border-t border-zinc-200 dark:border-zinc-800">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 dark:text-zinc-400">
          Pace to Targets
        </h2>
        <span className="text-[11px] italic text-zinc-500 dark:text-zinc-400 font-mono tabular-nums">
          {daysElapsed != null && daysTotal != null
            ? `Day ${daysElapsed} of ${daysTotal}`
            : null}
          {daysElapsed != null && daysTotal != null && (
            <span className="text-zinc-400 dark:text-zinc-600 mx-1.5">·</span>
          )}
          <span className="not-italic">
            {(expectedPct * 100).toFixed(0)}% elapsed
          </span>
        </span>
      </div>
      <div className="space-y-2.5">
        {lines.map((line) => {
          const hasTarget = line.target != null && line.target > 0;
          const pct = hasTarget
            ? Math.max(0, Math.min(1.5, line.current / (line.target as number)))
            : 0;
          const pctClamped = Math.min(1, pct);
          const isAhead = pct >= expectedPct;
          const isOver = pct > 1;

          const fillClass = !hasTarget
            ? "bg-zinc-300 dark:bg-zinc-700"
            : line.invert
              ? pct > 1
                ? "bg-red-600 dark:bg-red-500"
                : pct >= 0.85
                  ? "bg-amber-500"
                  : "bg-emerald-600 dark:bg-emerald-500"
              : isOver
                ? "bg-emerald-600 dark:bg-emerald-500"
                : isAhead
                  ? "bg-zinc-900 dark:bg-zinc-100"
                  : pct >= 0.6
                    ? "bg-zinc-700 dark:bg-zinc-300"
                    : "bg-zinc-400 dark:bg-zinc-500";

          const valueClass = !hasTarget
            ? "text-zinc-500 dark:text-zinc-400"
            : line.invert
              ? pct > 1
                ? "text-red-700 dark:text-red-400 font-semibold"
                : "text-zinc-700 dark:text-zinc-300"
              : isOver
                ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                : isAhead
                  ? "text-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400";

          return (
            <div
              key={line.label}
              className="grid grid-cols-[110px_1fr_auto] sm:grid-cols-[140px_1fr_auto] items-center gap-3 sm:gap-4"
            >
              <span className="text-[12px] text-zinc-700 dark:text-zinc-300 truncate">
                {line.label}
              </span>
              <div
                className="relative h-1 bg-zinc-100 dark:bg-zinc-900 overflow-hidden"
                style={{ borderRadius: 0 }}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all",
                    fillClass,
                  )}
                  style={{ width: `${pctClamped * 100}%` }}
                />
                {hasTarget && expectedPct > 0 && expectedPct < 1 && (
                  <div
                    className="absolute -top-0.5 -bottom-0.5 w-px bg-zinc-900 dark:bg-zinc-100"
                    style={{ left: `${expectedPct * 100}%` }}
                    title={`Expected: ${(expectedPct * 100).toFixed(0)}%`}
                  />
                )}
              </div>
              <div className="flex items-baseline gap-2 justify-end font-mono tabular-nums whitespace-nowrap">
                {hasTarget ? (
                  <>
                    <span className={cn("text-[12px]", valueClass)}>
                      {(pct * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600 italic">
                      of {formatRaw(line.target as number, line.unit)}
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-zinc-700 dark:text-zinc-300">
                    {formatRaw(line.current, line.unit)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
