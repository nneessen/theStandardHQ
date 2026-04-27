// src/features/close-kpi/components/widgets/VmRateSmartViewWidget.tsx

import React from "react";
import { AlertTriangle } from "lucide-react";
import type { VmRateSmartViewResult } from "../../types/close-kpi.types";

interface VmRateSmartViewWidgetProps {
  data: VmRateSmartViewResult;
  vmThreshold: number;
}

export const VmRateSmartViewWidget: React.FC<VmRateSmartViewWidgetProps> = ({
  data,
  vmThreshold,
}) => {
  if (data.rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[10px] text-muted-foreground">
          No smart views selected — configure widget to add smart views
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Overall summary bar */}
      <div className="mb-1.5 flex items-center justify-between border-b border-border pb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            First-Call VM Rate
          </span>
          {data.overall.vmRate > vmThreshold && (
            <AlertTriangle className="h-3 w-3 text-[hsl(var(--warning))]" />
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            {data.overall.totalFirstCalls} calls
          </span>
          <span
            className={`font-mono text-sm font-bold ${
              data.overall.vmRate > vmThreshold
                ? "text-destructive"
                : "text-foreground"
            }`}
          >
            {data.overall.vmRate}%
          </span>
        </div>
      </div>

      {/* Per-smart-view table */}
      <div>
        <table className="w-full">
          <thead>
            <tr className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="pb-1 text-left font-medium">Smart View</th>
              <th className="pb-1 text-right font-medium">Calls</th>
              <th className="pb-1 text-right font-medium">VM</th>
              <th className="pb-1 text-right font-medium">Ans</th>
              <th className="w-16 pb-1 text-right font-medium">VM Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const isAboveThreshold = row.vmRate > vmThreshold;
              return (
                <tr
                  key={row.smartViewId}
                  className={`border-t border-border/50 ${
                    isAboveThreshold ? "bg-destructive/5" : ""
                  }`}
                >
                  <td className="py-1 pr-2">
                    <div className="flex items-center gap-1">
                      {isAboveThreshold && (
                        <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-destructive" />
                      )}
                      <span className="truncate text-[11px] text-foreground">
                        {row.smartViewName}
                      </span>
                    </div>
                  </td>
                  <td className="py-1 text-right font-mono text-[11px] text-muted-foreground">
                    {row.totalFirstCalls}
                  </td>
                  <td className="py-1 text-right font-mono text-[11px] text-muted-foreground">
                    {row.vmCount}
                  </td>
                  <td className="py-1 text-right font-mono text-[11px] text-muted-foreground">
                    {row.answeredCount}
                  </td>
                  <td className="py-1 text-right">
                    <VmRateBar rate={row.vmRate} threshold={vmThreshold} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Inline VM Rate Bar ─────────────────────────────────────────────

const VmRateBar: React.FC<{ rate: number; threshold: number }> = ({
  rate,
  threshold,
}) => {
  const isAbove = rate > threshold;
  return (
    <div className="flex items-center justify-end gap-1">
      <div className="h-2 w-12 overflow-hidden rounded-sm bg-muted">
        <div
          className={`h-full rounded-sm ${
            isAbove ? "bg-destructive" : "bg-foreground/60"
          }`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span
        className={`w-9 text-right font-mono text-[11px] font-semibold ${
          isAbove ? "text-destructive" : "text-foreground"
        }`}
      >
        {rate}%
      </span>
    </div>
  );
};
