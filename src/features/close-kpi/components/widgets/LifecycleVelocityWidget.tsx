// src/features/close-kpi/components/widgets/LifecycleVelocityWidget.tsx

import React from "react";
import { ArrowRight, AlertTriangle } from "lucide-react";
import type { LifecycleTrackerResult } from "../../types/close-kpi.types";

interface LifecycleVelocityWidgetProps {
  data: LifecycleTrackerResult;
}

function speedColor(sampleSize: number): string {
  // Can't color-code days without context, so color by volume
  if (sampleSize >= 20) return "text-foreground";
  if (sampleSize >= 5) return "text-foreground";
  return "text-muted-foreground";
}

export const LifecycleVelocityWidget: React.FC<
  LifecycleVelocityWidgetProps
> = ({ data }) => {
  const { transitions, totalChanges, isTruncated } = data;

  if (!transitions || transitions.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Lifecycle Velocity
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          No status transitions found in this period.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...transitions.map((t) => t.sampleSize), 1);

  return (
    <div className="flex h-full flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Lifecycle Velocity
        </span>
        {totalChanges != null && (
          <span className="text-[9px] text-muted-foreground">
            {totalChanges.toLocaleString()} changes
          </span>
        )}
      </div>

      {/* Transition rows */}
      <div className="flex flex-col gap-0.5">
        {transitions.slice(0, 8).map((t, i) => {
          const barWidth = maxCount > 0 ? (t.sampleSize / maxCount) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-1">
              {/* From → To label */}
              <div className="flex w-[140px] shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground">
                <span
                  className="max-w-[60px] truncate font-medium"
                  title={t.from}
                >
                  {t.from}
                </span>
                <ArrowRight className="h-2 w-2 shrink-0 text-muted-foreground/50" />
                <span className="max-w-[60px] truncate" title={t.to}>
                  {t.to}
                </span>
              </div>
              {/* Bar */}
              <div className="relative h-3.5 flex-1 overflow-hidden rounded-sm bg-muted/30">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm bg-zinc-200 dark:bg-zinc-700 transition-all"
                  style={{
                    width: `${Math.max(barWidth, t.sampleSize > 0 ? 4 : 0)}%`,
                  }}
                />
                {t.sampleSize > 0 && (
                  <span className="absolute inset-y-0 left-1 flex items-center font-mono text-[9px] font-semibold text-foreground">
                    {t.sampleSize}
                  </span>
                )}
              </div>
              {/* Avg days (only shown if we have duration data) */}
              <span
                className={`w-[36px] shrink-0 text-right font-mono text-[10px] font-semibold ${speedColor(t.sampleSize)}`}
              >
                {t.avgDays > 0 ? `${t.avgDays}d` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Truncation warning */}
      {isTruncated && (
        <div className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-2.5 w-2.5" />
          <span>Data truncated at 2,000 status changes</span>
        </div>
      )}
    </div>
  );
};
