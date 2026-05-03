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
  default: "text-v2-ink dark:text-v2-ink",
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
};

export const SecondaryMetricsRow: React.FC<SecondaryMetricsRowProps> = ({
  metrics,
  className,
}) => {
  return (
    <section
      className={cn(
        "grid gap-x-8 gap-y-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 py-5 border-t border-v2-ring dark:border-v2-ring",
        className,
      )}
    >
      {metrics.map((m, i) => (
        <div key={i} className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-v2-ink-muted dark:text-v2-ink-subtle">
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
            <span className="text-[11px] italic text-v2-ink-muted dark:text-v2-ink-subtle mt-0.5 truncate">
              {m.caption}
            </span>
          )}
        </div>
      ))}
    </section>
  );
};
