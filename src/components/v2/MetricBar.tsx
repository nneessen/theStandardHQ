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
 * the Crextio reference). The fill ends with a small chip showing the
 * formatted percentage or value.
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
    <div className={cn("flex items-center gap-3 w-full", className)}>
      <div className="text-xs font-medium text-v2-ink-muted w-24 shrink-0 truncate">
        {label}
      </div>
      <div className="relative flex-1 h-7 rounded-v2-pill bg-v2-canvas border border-v2-ring overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-v2-pill flex items-center justify-end pr-2.5 transition-[width] duration-500",
            toneStyles[tone],
          )}
          style={{ width: `${Math.max(pct * 100, 14)}%` }}
        >
          <span
            className={cn(
              "text-[11px] font-semibold whitespace-nowrap",
              tone === "yellow" ? "text-v2-ink" : "text-white",
            )}
          >
            {pctText}
          </span>
        </div>
      </div>
    </div>
  );
};
