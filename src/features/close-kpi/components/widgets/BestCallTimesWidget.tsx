// src/features/close-kpi/components/widgets/BestCallTimesWidget.tsx

import React from "react";
import { Clock, Star } from "lucide-react";
import type { BestCallTimesResult } from "../../types/close-kpi.types";

interface BestCallTimesWidgetProps {
  data: BestCallTimesResult;
}

export const BestCallTimesWidget: React.FC<BestCallTimesWidgetProps> = ({
  data,
}) => {
  const { hourly, daily, bestHour, bestDay, totalCalls } = data;

  // Only show hours with data, business hours focus (7am-9pm)
  const activeHours = hourly.filter(
    (h) => h.total > 0 && h.hour >= 7 && h.hour <= 21,
  );
  const maxHourlyTotal = Math.max(...activeHours.map((h) => h.total), 1);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Best Time to Call
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {totalCalls.toLocaleString()} calls analyzed
        </span>
      </div>

      {/* Best recommendations */}
      {(bestHour || bestDay) && (
        <div className="flex gap-2">
          {bestHour && (
            <div className="flex items-center gap-1 rounded bg-[hsl(var(--success))]/10 px-2 py-1">
              <Star className="h-2.5 w-2.5 text-[hsl(var(--success))]" />
              <span className="text-[10px] font-semibold text-[hsl(var(--success))]">
                {bestHour.label} — {bestHour.connectRate}% connect
              </span>
            </div>
          )}
          {bestDay && (
            <div className="flex items-center gap-1 rounded bg-[hsl(var(--success))]/10 px-2 py-1">
              <Star className="h-2.5 w-2.5 text-[hsl(var(--success))]" />
              <span className="text-[10px] font-semibold text-[hsl(var(--success))]">
                {bestDay.label} — {bestDay.connectRate}% connect
              </span>
            </div>
          )}
        </div>
      )}

      {/* Hourly heatmap */}
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {activeHours.map((h) => (
          <div key={h.hour} className="flex items-center gap-1.5">
            <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
              {h.label}
            </span>
            <div className="flex-1">
              <div
                className="h-3.5 rounded-sm"
                style={{
                  width: `${(h.total / maxHourlyTotal) * 100}%`,
                  minWidth: h.total > 0 ? "2px" : "0",
                  backgroundColor:
                    h.connectRate >= 40
                      ? "hsl(var(--success))"
                      : h.connectRate >= 20
                        ? "hsl(var(--warning))"
                        : "hsl(var(--destructive) / 0.7)",
                }}
              />
            </div>
            <span className="w-16 text-right font-mono text-[10px]">
              <span className="font-semibold text-foreground">
                {h.connectRate}%
              </span>
              <span className="ml-0.5 text-muted-foreground">({h.total})</span>
            </span>
          </div>
        ))}
      </div>

      {/* Day of week row */}
      <div className="flex gap-1 border-t border-border pt-1">
        {daily.map((d) => (
          <div
            key={d.day}
            className="flex flex-1 flex-col items-center rounded px-0.5 py-0.5"
            style={{
              backgroundColor:
                d.total === 0
                  ? "transparent"
                  : d.connectRate >= 40
                    ? "hsl(var(--success) / 0.15)"
                    : d.connectRate >= 20
                      ? "hsl(var(--warning) / 0.15)"
                      : "hsl(var(--destructive) / 0.1)",
            }}
          >
            <span className="text-[9px] font-medium text-muted-foreground">
              {d.label}
            </span>
            <span className="font-mono text-[10px] font-semibold text-foreground">
              {d.total > 0 ? `${d.connectRate}%` : "—"}
            </span>
          </div>
        ))}
      </div>

      {data.isTruncated && (
        <p className="text-[9px] text-muted-foreground/60">
          Limited to 3,000 most recent calls
        </p>
      )}
    </div>
  );
};
