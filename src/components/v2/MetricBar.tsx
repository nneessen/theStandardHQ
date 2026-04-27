import React from "react";
import { cn } from "@/lib/utils";

interface MetricBarProps {
  label: string;
  value: number; // 0..1
  display?: string; // override for the right-side label, e.g. "60%" or "$2,500"
  tone?: "yellow" | "ink" | "muted";
  className?: string;
}

const toneStyles = {
  yellow: "bg-v2-accent",
  ink: "bg-v2-ink",
  muted: "bg-v2-ring-strong",
};

/**
 * Labelled horizontal progress bar (mirrors the "Interviews 15%" rows in
 * the Crextio reference). Renders the value chip to the right of the
 * bar so it never gets clipped when the fill width is narrow or the
 * dollar string is long.
 */
export const MetricBar: React.FC<MetricBarProps> = ({
  label,
  value,
  display,
  tone = "ink",
  className,
}) => {
  const pct = Math.max(0, Math.min(1, value));
  const pctText = display ?? `${Math.round(pct * 100)}%`;
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 w-full min-w-0",
        className,
      )}
    >
      <div className="text-xs font-medium text-v2-ink-muted truncate">
        {label}
      </div>
      <div className="relative h-2 rounded-v2-pill bg-v2-canvas border border-v2-ring overflow-hidden min-w-0">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-v2-pill transition-[width] duration-500",
            toneStyles[tone],
          )}
          style={{ width: `${Math.max(pct * 100, 4)}%` }}
        />
      </div>
      <span className="text-[12px] font-semibold tabular-nums whitespace-nowrap text-v2-ink">
        {pctText}
      </span>
    </div>
  );
};
