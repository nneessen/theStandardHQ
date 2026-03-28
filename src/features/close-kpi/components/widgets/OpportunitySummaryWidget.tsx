// src/features/close-kpi/components/widgets/OpportunitySummaryWidget.tsx

import React from "react";
import { TrendingUp, Trophy, XCircle } from "lucide-react";
import type { OpportunitySummaryResult } from "../../types/close-kpi.types";

interface OpportunitySummaryWidgetProps {
  data: OpportunitySummaryResult;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export const OpportunitySummaryWidget: React.FC<
  OpportunitySummaryWidgetProps
> = ({ data }) => {
  const {
    totalValue,
    dealCount,
    activeCount,
    wonCount,
    wonValue,
    lostCount,
    winRate,
    avgDealSize,
    avgTimeToClose,
    salesVelocity,
  } = data;

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Primary stat — pipeline value */}
      <div className="flex items-baseline gap-2">
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-2xl font-bold text-foreground">
          {formatCurrency(totalValue)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          pipeline ({dealCount} deals)
        </span>
      </div>

      {/* Win/loss summary */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded bg-muted/50 px-1.5 py-1">
          <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Active
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {activeCount}
          </p>
        </div>
        <div className="rounded bg-muted/50 px-1.5 py-1">
          <p className="flex items-center gap-0.5 text-[9px] font-medium uppercase tracking-wider text-[hsl(var(--success))]">
            <Trophy className="h-2 w-2" />
            Won
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {wonCount}
          </p>
        </div>
        <div className="rounded bg-muted/50 px-1.5 py-1">
          <p className="flex items-center gap-0.5 text-[9px] font-medium uppercase tracking-wider text-destructive">
            <XCircle className="h-2 w-2" />
            Lost
          </p>
          <p className="font-mono text-sm font-semibold text-foreground">
            {lostCount}
          </p>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span>
          Win rate:{" "}
          <span className="font-mono font-semibold text-foreground">
            {winRate}%
          </span>
        </span>
        <span>
          Avg deal:{" "}
          <span className="font-mono font-semibold text-foreground">
            {formatCurrency(avgDealSize)}
          </span>
        </span>
        {wonValue > 0 && (
          <span>
            Won:{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatCurrency(wonValue)}
            </span>
          </span>
        )}
      </div>

      {/* Velocity row */}
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        {avgTimeToClose != null && avgTimeToClose > 0 && (
          <span>{avgTimeToClose} days avg to close</span>
        )}
        {salesVelocity != null && salesVelocity > 0 && (
          <span>Velocity: {formatCurrency(salesVelocity)}/day</span>
        )}
      </div>
    </div>
  );
};
