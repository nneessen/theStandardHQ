import React from "react";
import { cn } from "@/lib/utils";

export interface HeroStat {
  label: string;
  value: string;
  /** 0..1 — controls the bar fill. Pass 0 to hide the bar gracefully. */
  pct: number;
  /** 0..1 — when set and < 1, renders a vertical tick on the bar marking
   *  expected pace position (e.g., 67% of the month elapsed). */
  expectedPct?: number;
  /** Sub-line beneath the bar (kept short to avoid wrap). */
  hint?: string;
  /** Bar fill color tone. */
  tone?: "ink" | "accent" | "muted";
  /** When true, render the cell as half-prominence (used for YTD pairs). */
  secondary?: boolean;
}

interface HeroStatStripProps {
  stats: HeroStat[];
}

const toneFill: Record<NonNullable<HeroStat["tone"]>, string> = {
  ink: "bg-v2-ink",
  accent: "bg-v2-accent-strong",
  muted: "bg-v2-ring-strong",
};

/**
 * Full-width row of comparable stat columns separated by hairline rules.
 * Replaces the old hero "bars-left, tiles-right" split — same data, far
 * less chrome. Cells share a 1px gap on a v2-ring background so the
 * dividers are pixel-thin instead of full borders.
 */
export const HeroStatStrip: React.FC<HeroStatStripProps> = ({ stats }) => {
  return (
    <section
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px",
        "bg-v2-ring rounded-v2-md overflow-hidden border border-v2-ring shadow-v2-soft mb-4",
      )}
    >
      {stats.map((stat, i) => {
        const pct = Math.max(0, Math.min(1, stat.pct));
        const tone = stat.tone ?? "ink";
        const showTick =
          stat.expectedPct != null &&
          stat.expectedPct > 0 &&
          stat.expectedPct < 1;
        return (
          <div
            key={i}
            className={cn(
              "bg-v2-card px-4 py-4 flex flex-col gap-2 min-w-0",
              stat.secondary && "bg-v2-card-tinted",
            )}
          >
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-v2-ink-subtle truncate">
              {stat.label}
            </div>
            <div
              className={cn(
                "font-mono tabular-nums font-semibold leading-none truncate",
                stat.secondary
                  ? "text-xl text-v2-ink-muted"
                  : "text-2xl text-v2-ink",
              )}
            >
              {stat.value}
            </div>
            <div className="relative h-1 bg-v2-canvas border border-v2-ring overflow-hidden rounded-v2-pill mt-1">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-500",
                  toneFill[tone],
                )}
                style={{ width: `${pct * 100}%` }}
              />
              {showTick && (
                <div
                  className="absolute -top-0.5 -bottom-0.5 w-px bg-v2-ink"
                  style={{ left: `${(stat.expectedPct as number) * 100}%` }}
                  aria-hidden
                  title={`Expected: ${Math.round((stat.expectedPct as number) * 100)}%`}
                />
              )}
            </div>
            {stat.hint && (
              <div className="text-[11px] text-v2-ink-muted font-mono tabular-nums truncate">
                {stat.hint}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};
