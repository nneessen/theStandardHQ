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
  hot: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
  warming:
    "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
  neutral:
    "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/30 dark:text-zinc-400 dark:border-zinc-700",
  cooling:
    "bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800",
  cold: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
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
