// src/features/analytics/visualizations/CircularProgressGauge.tsx

import { cn } from "@/lib/utils";

interface CircularProgressGaugeProps {
  percentage: number; // 0-100
  size?: number; // Diameter in pixels
  strokeWidth?: number;
  showLabel?: boolean;
  label?: string;
  className?: string;
  color?: "green" | "yellow" | "red" | "blue";
}

export function CircularProgressGauge({
  percentage,
  size = 200,
  strokeWidth = 12,
  showLabel = true,
  label,
  className,
  color = "blue",
}: CircularProgressGaugeProps) {
  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  // Calculate circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedPercentage / 100) * circumference;

  // Color mapping with zinc-compatible colors
  const colorClasses = {
    green: "stroke-emerald-600 dark:stroke-emerald-400",
    yellow: "stroke-amber-600 dark:stroke-amber-400",
    red: "stroke-red-600 dark:stroke-red-400",
    blue: "stroke-blue-600 dark:stroke-blue-400",
  };

  const _fillColorClasses = {
    green: "fill-emerald-600 dark:fill-emerald-400",
    yellow: "fill-amber-600 dark:fill-amber-400",
    red: "fill-red-600 dark:fill-red-400",
    blue: "fill-blue-600 dark:fill-blue-400",
  };

  const textColorClasses = {
    green: "text-success",
    yellow: "text-warning",
    red: "text-destructive",
    blue: "text-info",
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-v2-canvas dark:text-v2-ink"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(
            "transition-all duration-1000 ease-out",
            colorClasses[color],
          )}
        />
      </svg>

      {/* Center label */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "text-4xl font-bold tabular-nums",
              textColorClasses[color],
            )}
          >
            {Math.round(clampedPercentage)}%
          </span>
          {label && (
            <span className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle mt-1 text-center max-w-[80%]">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
