// src/features/close-kpi/components/widgets/StatCardWidget.tsx

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { StatCardResult } from "../../types/close-kpi.types";

interface StatCardWidgetProps {
  data: StatCardResult;
}

export const StatCardWidget: React.FC<StatCardWidgetProps> = ({ data }) => {
  const { value, changePercent, previousValue, label } = data;
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
          {value.toLocaleString()}
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
          vs {previousValue.toLocaleString()} previous period
        </p>
      )}
    </div>
  );
};
