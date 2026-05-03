// src/features/close-kpi/components/widgets/OpportunitySummaryWidget.tsx

import React from "react";
import {
  TrendingUp,
  Trophy,
  XCircle,
  Circle,
  AlertTriangle,
} from "lucide-react";
import type { OpportunitySummaryResult } from "../../types/close-kpi.types";

interface OpportunitySummaryWidgetProps {
  data: OpportunitySummaryResult;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const TYPE_STYLES: Record<
  string,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  active: {
    bg: "bg-v2-ring",
    text: "text-v2-ink-muted dark:text-v2-ink-subtle",
    icon: <Circle className="h-2 w-2 fill-current" />,
  },
  won: {
    bg: "bg-success/10",
    text: "text-success",
    icon: <Trophy className="h-2 w-2" />,
  },
  lost: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    icon: <XCircle className="h-2 w-2" />,
  },
};

export const OpportunitySummaryWidget: React.FC<
  OpportunitySummaryWidgetProps
> = ({ data }) => {
  const {
    totalValue,
    dealCount,
    activeCount,
    wonCount,
    lostCount,
    winRate,
    avgDealSize,
    wonValue,
    avgTimeToClose,
    salesVelocity,
    byStatus,
    pipelineName,
    pipelineHealth,
  } = data;

  const maxCount = byStatus ? Math.max(...byStatus.map((s) => s.count), 1) : 1;

  const hasHealthWarnings =
    pipelineHealth &&
    (pipelineHealth.revenueAtRisk > 0 ||
      pipelineHealth.untouchedActive.count > 0);

  return (
    <div className="flex h-full flex-col gap-1.5">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <TrendingUp className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-xl font-bold text-foreground">
            {formatCurrency(totalValue)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {dealCount} deals
          </span>
        </div>
        {pipelineName && (
          <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {pipelineName}
          </span>
        )}
      </div>

      {/* Pipeline status breakdown — funnel bars */}
      {byStatus && byStatus.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {byStatus.map((status) => {
            const style = TYPE_STYLES[status.type] ?? TYPE_STYLES.active;
            const barWidth = maxCount > 0 ? (status.count / maxCount) * 100 : 0;
            const hasWarning =
              status.type === "active" &&
              (status.staleCount > 0 || status.untouchedCount > 0);

            return (
              <div key={status.id} className="flex items-center gap-1.5">
                <span
                  className={`flex w-[90px] shrink-0 items-center gap-1 text-[10px] font-medium ${style.text}`}
                >
                  {style.icon}
                  <span className="truncate">{status.label}</span>
                </span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-muted/30">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-sm ${style.bg} transition-all`}
                    style={{
                      width: `${Math.max(barWidth, status.count > 0 ? 4 : 0)}%`,
                    }}
                  />
                  {status.count > 0 && (
                    <span className="absolute inset-y-0 left-1.5 flex items-center font-mono text-[10px] font-semibold text-foreground">
                      {status.count}
                    </span>
                  )}
                </div>
                {/* Age + warning indicators */}
                <div className="flex w-[80px] shrink-0 items-center justify-end gap-1">
                  {status.avgAgeDays > 0 && (
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {Math.round(status.avgAgeDays)}d
                    </span>
                  )}
                  {hasWarning && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                      title={`${status.staleCount > 0 ? `${status.staleCount} stale` : ""}${status.staleCount > 0 && status.untouchedCount > 0 ? ", " : ""}${status.untouchedCount > 0 ? `${status.untouchedCount} untouched` : ""}`}
                    />
                  )}
                  <span className="w-[48px] text-right font-mono text-[10px] text-muted-foreground">
                    {status.value > 0 ? formatCurrency(status.value) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pipeline Health signals */}
      {pipelineHealth && hasHealthWarnings && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded bg-warning/10/50 px-1.5 py-0.5 dark:bg-warning/10">
          <span className="flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-warning">
            <AlertTriangle className="h-2.5 w-2.5" />
            Signals
          </span>
          {pipelineHealth.revenueAtRisk > 0 && (
            <span className="text-[10px] text-warning">
              At risk:{" "}
              <span className="font-mono font-semibold">
                {formatCurrency(pipelineHealth.revenueAtRisk)}
              </span>
            </span>
          )}
          {pipelineHealth.untouchedActive.count > 0 && (
            <span className="text-[10px] text-warning">
              Untouched:{" "}
              <span className="font-mono font-semibold">
                {pipelineHealth.untouchedActive.count}
              </span>{" "}
              deals
              {pipelineHealth.untouchedActive.value > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({formatCurrency(pipelineHealth.untouchedActive.value)})
                </span>
              )}
            </span>
          )}
          {pipelineHealth.staleActive.count > 0 && (
            <span className="text-[10px] text-warning">
              Stale:{" "}
              <span className="font-mono font-semibold">
                {pipelineHealth.staleActive.count}
              </span>{" "}
              deals
            </span>
          )}
        </div>
      )}

      {/* Forecast + summary row */}
      <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-1">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span>
            <span className="text-success">{wonCount}W</span>
            {" / "}
            <span className="text-destructive">{lostCount}L</span>
            {" / "}
            <span>{activeCount}A</span>
          </span>
          <span>
            WR:{" "}
            <span className="font-mono font-semibold text-foreground">
              {winRate}%
            </span>
          </span>
          <span>
            Avg:{" "}
            <span className="font-mono font-semibold text-foreground">
              {formatCurrency(avgDealSize)}
            </span>
          </span>
          {pipelineHealth && pipelineHealth.weightedForecast > 0 && (
            <span>
              Forecast:{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatCurrency(pipelineHealth.weightedForecast)}
              </span>
            </span>
          )}
        </div>
        <div className="ml-auto flex gap-2 text-[10px] text-muted-foreground">
          {wonValue > 0 && (
            <span className="text-success">{formatCurrency(wonValue)} won</span>
          )}
          {avgTimeToClose != null && avgTimeToClose > 0 && (
            <span>{avgTimeToClose}d avg</span>
          )}
          {salesVelocity != null && salesVelocity > 0 && (
            <span>{formatCurrency(salesVelocity)}/d</span>
          )}
        </div>
      </div>
    </div>
  );
};
