// src/features/close-kpi/components/widgets/StatCardWidget.tsx

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { StatCardResult } from "../../types/close-kpi.types";

interface StatCardWidgetProps {
  data: StatCardResult;
}

function formatValue(value: number, unit?: string): string {
  if (unit === "$" || unit === "currency") {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (unit === "%" || unit === "percent") {
    return `${value}%`;
  }
  if (unit === " min" || unit === "minutes") {
    return `${value.toLocaleString()} min`;
  }
  if (unit === "duration_days") {
    return `${value} days`;
  }
  return value.toLocaleString();
}

const SUB_METRIC_COLORS: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  destructive: "text-red-500 dark:text-red-400",
  muted: "text-muted-foreground",
};

export const StatCardWidget: React.FC<StatCardWidgetProps> = ({ data }) => {
  const { value, changePercent, previousValue, label, unit, subMetrics } = data;
  const trend =
    changePercent == null
      ? "neutral"
      : changePercent > 0
        ? "up"
        : changePercent < 0
          ? "down"
          : "neutral";

  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-bold text-foreground">
          {formatValue(value, unit)}
        </span>
        {changePercent != null && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-semibold ${
              trend === "up"
                ? "text-[hsl(var(--success))]"
                : trend === "down"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : trend === "down" ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {Math.abs(changePercent)}%
          </span>
        )}
      </div>
      {previousValue != null && (
        <p className="text-[10px] text-muted-foreground">
          vs {formatValue(previousValue, unit)} previous period
        </p>
      )}
      {subMetrics && subMetrics.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 border-t border-border/40 pt-1">
          {subMetrics.map((m, i) => (
            <span
              key={i}
              className={`text-[10px] ${SUB_METRIC_COLORS[m.color ?? "muted"]}`}
            >
              {m.label}:{" "}
              <span className="font-mono font-semibold">
                {typeof m.value === "number"
                  ? m.value.toLocaleString()
                  : m.value}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
