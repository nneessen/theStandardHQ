import React from "react";
import { cn } from "@/lib/utils";
import { formatCompactCurrency } from "@/lib/format";

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
  if (unit === "$") return formatCompactCurrency(value);
  return Math.round(value).toLocaleString();
}

export const PaceLines: React.FC<PaceLinesProps> = ({
  lines,
  daysElapsed,
  daysTotal,
  expectedPct,
}) => {
  return (
    <section className="py-6 border-t border-v2-ring dark:border-v2-ring">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-[10px] uppercase tracking-[0.18em] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle">
          Pace to Targets
        </h2>
        <span className="text-[11px] italic text-v2-ink-muted dark:text-v2-ink-subtle font-mono tabular-nums">
          {daysElapsed != null && daysTotal != null
            ? `Day ${daysElapsed} of ${daysTotal}`
            : null}
          {daysElapsed != null && daysTotal != null && (
            <span className="text-v2-ink-subtle dark:text-v2-ink-muted mx-1.5">
              ·
            </span>
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
            ? "bg-zinc-300 dark:bg-v2-ring-strong"
            : line.invert
              ? pct > 1
                ? "bg-red-600 dark:bg-red-500"
                : pct >= 0.85
                  ? "bg-amber-500"
                  : "bg-emerald-600 dark:bg-emerald-500"
              : isOver
                ? "bg-emerald-600 dark:bg-emerald-500"
                : isAhead
                  ? "bg-v2-ink dark:bg-v2-card-tinted"
                  : pct >= 0.6
                    ? "bg-v2-ring-strong dark:bg-zinc-300"
                    : "bg-v2-ink-subtle";

          const valueClass = !hasTarget
            ? "text-v2-ink-muted dark:text-v2-ink-subtle"
            : line.invert
              ? pct > 1
                ? "text-red-700 dark:text-red-400 font-semibold"
                : "text-v2-ink dark:text-v2-ink-muted"
              : isOver
                ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                : isAhead
                  ? "text-v2-ink dark:text-v2-ink font-semibold"
                  : "text-v2-ink-muted dark:text-v2-ink-subtle";

          return (
            <div
              key={line.label}
              className="grid grid-cols-[110px_1fr_auto] sm:grid-cols-[140px_1fr_auto] items-center gap-3 sm:gap-4"
            >
              <span className="text-[12px] text-v2-ink dark:text-v2-ink-muted truncate">
                {line.label}
              </span>
              <div
                className="relative h-1 bg-v2-card-tinted dark:bg-v2-card overflow-hidden"
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
                    className="absolute -top-0.5 -bottom-0.5 w-px bg-v2-ink dark:bg-v2-card-tinted"
                    style={{ left: `${expectedPct * 100}%` }}
                    title={`Expected: ${(expectedPct * 100).toFixed(0)}%`}
                  />
                )}
              </div>
              <div className="flex items-baseline gap-2 justify-end font-mono tabular-nums whitespace-nowrap">
                <span className={cn("text-[12px]", valueClass)}>
                  {formatRaw(line.current, line.unit)}
                </span>
                {hasTarget && (
                  <span className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted italic">
                    {(pct * 100).toFixed(0)}% of{" "}
                    {formatRaw(line.target as number, line.unit)}
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
