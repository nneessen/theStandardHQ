// src/features/close-kpi/components/widgets/FollowUpGapsWidget.tsx

import React from "react";
import { Clock, AlertTriangle } from "lucide-react";
import type { FollowUpGapsResult } from "../../types/close-kpi.types";

interface FollowUpGapsWidgetProps {
  data: FollowUpGapsResult;
}

export const FollowUpGapsWidget: React.FC<FollowUpGapsWidgetProps> = ({
  data,
}) => {
  const {
    items,
    totalLeads,
    totalNeedingAttention,
    totalUntouched,
    totalGap,
    gapThresholdDays,
  } = data;

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Follow-up Gaps
          </span>
        </div>
        <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">
          All leads have recent activity. No gaps detected.
        </p>
      </div>
    );
  }

  const maxNeedsAttention = Math.max(
    ...items.map((s) => s.untouchedCount + s.gapLeads),
    1,
  );

  return (
    <div className="flex h-full flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Follow-up Gaps
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {totalLeads.toLocaleString()} leads
        </span>
      </div>

      {/* Alert summary */}
      {totalNeedingAttention > 0 && (
        <div className="flex items-center gap-2 rounded bg-amber-50/50 px-1.5 py-0.5 dark:bg-amber-950/20">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-[10px] text-amber-700 dark:text-amber-300">
            <span className="font-mono font-semibold">
              {totalNeedingAttention}
            </span>{" "}
            leads need attention
            {totalUntouched > 0 && <span> — {totalUntouched} untouched</span>}
            {totalGap > 0 && (
              <span>
                , {totalGap} stale ({`>${gapThresholdDays}d`})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Status rows */}
      <div className="flex flex-col gap-0.5">
        {items.slice(0, 8).map((status) => {
          const needsAttention = status.untouchedCount + status.gapLeads;
          const barWidth =
            maxNeedsAttention > 0
              ? (needsAttention / maxNeedsAttention) * 100
              : 0;
          const isUrgent = needsAttention > status.totalLeads * 0.5;

          return (
            <div key={status.statusId} className="flex items-center gap-1">
              <span
                className="w-[120px] shrink-0 truncate text-[10px] text-muted-foreground"
                title={status.label}
              >
                {status.label}
              </span>
              <div className="relative h-3.5 flex-1 overflow-hidden rounded-sm bg-muted/30">
                <div
                  className={`absolute inset-y-0 left-0 rounded-sm transition-all ${
                    isUrgent
                      ? "bg-amber-200 dark:bg-amber-800/40"
                      : "bg-v2-ring"
                  }`}
                  style={{
                    width: `${Math.max(barWidth, needsAttention > 0 ? 4 : 0)}%`,
                  }}
                />
                {needsAttention > 0 && (
                  <span className="absolute inset-y-0 left-1 flex items-center font-mono text-[9px] font-semibold text-foreground">
                    {needsAttention}
                  </span>
                )}
              </div>
              <div className="flex w-[60px] shrink-0 items-center justify-end gap-1 text-[9px] text-muted-foreground">
                {status.avgDaysSinceActivity != null && (
                  <span className="font-mono">
                    {Math.round(status.avgDaysSinceActivity)}d avg
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
