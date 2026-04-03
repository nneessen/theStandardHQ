// src/features/close-kpi/components/widgets/StatCardWidget.tsx

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type {
  StatCardResult,
  WidgetAccentColor,
} from "../../types/close-kpi.types";
import { SUB_METRIC_BG, SUB_METRIC_DOT } from "../../lib/widget-styles";

interface StatCardWidgetProps {
  data: StatCardResult;
  accentColor?: WidgetAccentColor;
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

export const StatCardWidget: React.FC<StatCardWidgetProps> = ({
  data,
  // accentColor is available for future per-metric theming
}) => {
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
    <div className="flex h-full flex-col justify-between gap-2">
      {/* Primary metric */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl font-bold text-foreground leading-tight">
            {formatValue(value, unit)}
          </span>
          {changePercent != null && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                trend === "up"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                  : trend === "down"
                    ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground"
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
          <p className="text-[9px] text-muted-foreground mt-0.5">
            vs{" "}
            <span className="font-mono font-medium">
              {formatValue(previousValue, unit)}
            </span>{" "}
            prev period
          </p>
        )}
      </div>

      {/* SubMetrics — 2-column grid with colored backgrounds */}
      {subMetrics && subMetrics.length > 0 && (
        <div
          className={`grid gap-1.5 ${subMetrics.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {subMetrics.map((m, i) => {
            const colorKey = m.color ?? "muted";
            const bgClass = SUB_METRIC_BG[colorKey] ?? SUB_METRIC_BG.muted;
            const dotClass = SUB_METRIC_DOT[colorKey] ?? SUB_METRIC_DOT.muted;

            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 ${bgClass}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotClass}`}
                />
                <div className="min-w-0 flex-1">
                  <span className="block text-[9px] font-medium leading-tight opacity-80 truncate">
                    {m.label}
                  </span>
                  <span className="block font-mono text-[11px] font-bold leading-tight">
                    {typeof m.value === "number"
                      ? m.value.toLocaleString()
                      : m.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
