// src/features/close-kpi/components/LeadHeatBadge.tsx
// Score badge with heat-level coloring, matching leadVendorHeatService pattern.

import React from "react";
import type {
  LeadHeatLevel,
  LeadTrendDirection,
} from "../types/close-kpi.types";

interface LeadHeatBadgeProps {
  score: number;
  heatLevel: LeadHeatLevel;
  trend?: LeadTrendDirection;
  previousScore?: number | null;
  size?: "sm" | "md";
}

const HEAT_COLORS: Record<LeadHeatLevel, string> = {
  hot: "bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/15 dark:text-destructive dark:border-destructive",
  warming:
    "bg-warning/10 text-warning border-warning/30 dark:bg-warning/30 dark:text-warning dark:border-warning",
  neutral:
    "bg-v2-ring text-v2-ink-muted border-v2-ring dark:bg-v2-ring/30 dark:text-v2-ink-subtle ",
  cooling:
    "bg-info/10 text-info border-info/30 dark:bg-info/30 dark:text-info dark:border-info",
  cold: "bg-info/10 text-info border-info/30 dark:bg-info/15 dark:text-info dark:border-info",
};

const TREND_ARROWS: Record<LeadTrendDirection, string> = {
  up: "\u2191",
  "up-right": "\u2197",
  right: "\u2192",
  "down-right": "\u2198",
  down: "\u2193",
};

export const LeadHeatBadge: React.FC<LeadHeatBadgeProps> = ({
  score,
  heatLevel,
  trend,
  previousScore,
  size = "sm",
}) => {
  const colorClass = HEAT_COLORS[heatLevel];
  const trendArrow = trend ? TREND_ARROWS[trend] : null;
  const delta = previousScore != null ? score - previousScore : null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-mono font-semibold ${colorClass} ${
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
      }`}
      title={`Score: ${score}/100 (${heatLevel})${delta != null ? ` | Change: ${delta > 0 ? "+" : ""}${delta}` : ""}`}
    >
      {score}
      {trendArrow && (
        <span className="text-[10px] opacity-70">{trendArrow}</span>
      )}
    </span>
  );
};
