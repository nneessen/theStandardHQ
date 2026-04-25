import React from "react";
import { cn } from "@/lib/utils";

export interface SecondaryMetric {
  label: string;
  value: string;
  /** Italic supporting line (e.g., "vs target 31"). */
  caption?: string;
  /** Optional value tone — drives color of the number itself. */
  tone?: "default" | "good" | "warn" | "bad";
}

interface SecondaryMetricsRowProps {
  metrics: SecondaryMetric[];
  className?: string;
}

const TONE_CLASS: Record<NonNullable<SecondaryMetric["tone"]>, string> = {
  default: "text-zinc-900 dark:text-zinc-100",
  good: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
};

export const SecondaryMetricsRow: React.FC<SecondaryMetricsRowProps> = ({
  metrics,
  className,
}) => {
  return (
    <section
      className={cn(
        "grid gap-x-8 gap-y-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 py-5 border-t border-zinc-200 dark:border-zinc-800",
        className,
      )}
    >
      {metrics.map((m, i) => (
        <div key={i} className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 dark:text-zinc-400">
            {m.label}
          </span>
          <span
            className={cn(
              "font-mono tabular-nums text-3xl font-medium tracking-tight leading-tight mt-1 truncate",
              TONE_CLASS[m.tone ?? "default"],
            )}
            title={m.value}
          >
            {m.value}
          </span>
          {m.caption && (
            <span className="text-[11px] italic text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              {m.caption}
            </span>
          )}
        </div>
      ))}
    </section>
  );
};
