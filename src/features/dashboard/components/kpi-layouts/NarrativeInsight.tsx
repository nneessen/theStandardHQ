// src/features/dashboard/components/kpi-layouts/NarrativeInsight.tsx

import React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface NarrativeInsightProps {
  /**
   * Main metric label
   */
  label: string;
  /**
   * Current value (formatted string or number)
   */
  value: string | number;
  /**
   * Natural language description/insight
   */
  insight?: string;
  /**
   * Progress percentage (0-100) for visual progress bar
   */
  progress?: number;
  /**
   * Trend direction
   */
  trend?: "up" | "down" | "neutral";
  /**
   * Accent color class for the left border
   */
  accentColor?: string;
  /**
   * Additional className
   */
  className?: string;
}

/**
 * Narrative Insight Card Component
 *
 * Displays a KPI with natural language context and visual indicators.
 * Used in the Narrative KPI layout to tell the performance story.
 *
 * @param props - Component props
 * @returns Insight card with metric, description, and progress
 */
export const NarrativeInsight: React.FC<NarrativeInsightProps> = ({
  label,
  value,
  insight,
  progress,
  trend = "neutral",
  accentColor = "border-primary",
  className = "",
}) => {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-v2-ink-muted dark:text-v2-ink-subtle";

  return (
    <div className={cn("relative pl-3 py-2", className)}>
      {/* Left accent border */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-full",
          accentColor,
        )}
      />

      {/* Content */}
      <div className="space-y-1">
        {/* Label */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
            {label}
          </span>
          <TrendIcon size={14} className={cn(trendColor)} />
        </div>

        {/* Value */}
        <div className="text-2xl font-bold tracking-tight text-v2-ink dark:text-v2-ink">
          {value}
        </div>

        {/* Progress bar (if provided) */}
        {progress !== undefined && (
          <div className="h-1.5 bg-v2-ring dark:bg-v2-ring-strong rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 bg-gradient-to-r",
                trend === "up"
                  ? "from-emerald-500 to-emerald-600"
                  : trend === "down"
                    ? "from-red-500 to-red-600"
                    : "from-blue-500/50 to-blue-500",
              )}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}

        {/* Insight text */}
        {insight && (
          <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle leading-relaxed">
            {insight}
          </p>
        )}
      </div>
    </div>
  );
};
