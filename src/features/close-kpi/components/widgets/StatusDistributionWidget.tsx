// src/features/close-kpi/components/widgets/StatusDistributionWidget.tsx

import React from "react";
import type { StatusDistributionResult } from "../../types/close-kpi.types";

interface StatusDistributionWidgetProps {
  data: StatusDistributionResult;
  label?: string;
}

// Muted zinc palette — no rainbow
const SEGMENT_COLORS = [
  "bg-v2-canvas",
  "bg-v2-ring-strong",
  "bg-v2-ink-muted",
  "bg-v2-ring bg-v2-ring",
  "bg-v2-card-dark",
];
const LEGEND_DOTS = [
  "bg-v2-canvas",
  "bg-v2-ring-strong",
  "bg-v2-ink-muted",
  "bg-v2-ring",
  "bg-v2-card-dark",
];

const MAX_VISIBLE = 5;

export const StatusDistributionWidget: React.FC<
  StatusDistributionWidgetProps
> = ({ data, label }) => {
  if (data.items.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center">
        <p className="text-[10px] text-muted-foreground">No data</p>
      </div>
    );
  }

  const sorted = [...data.items].sort((a, b) => b.count - a.count);
  const visible = sorted.slice(0, MAX_VISIBLE);
  const otherItems = sorted.slice(MAX_VISIBLE);
  const otherCount = otherItems.reduce((sum, item) => sum + item.count, 0);
  const total = data.total || sorted.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="flex h-full flex-col gap-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label ?? "Lead Pipeline"}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {total.toLocaleString()} total
        </span>
      </div>

      {/* Stacked horizontal bar */}
      <div className="flex h-5 w-full overflow-hidden rounded-sm">
        {visible.map((item, i) => {
          const pct = total > 0 ? (item.count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={item.id}
              className={`${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} transition-all`}
              style={{ width: `${pct}%`, minWidth: pct > 0 ? "2px" : "0" }}
              title={`${item.label}: ${item.count} (${Math.round(pct)}%)`}
            />
          );
        })}
        {otherCount > 0 && (
          <div
            className="bg-v2-ring transition-all"
            style={{ width: `${(otherCount / total) * 100}%`, minWidth: "2px" }}
            title={`Other: ${otherCount}`}
          />
        )}
      </div>

      {/* Compact legend */}
      <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
        {visible.map((item, i) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <span
              key={item.id}
              className="flex items-center gap-1 text-[10px] text-muted-foreground"
            >
              <span
                className={`inline-block h-2 w-2 shrink-0 rounded-sm ${LEGEND_DOTS[i % LEGEND_DOTS.length]}`}
              />
              <span className="truncate">{item.label}</span>
              <span className="font-mono font-semibold text-foreground">
                {item.count.toLocaleString()}
              </span>
              <span className="text-[9px]">{pct}%</span>
            </span>
          );
        })}
        {otherCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-v2-ring" />
            <span>Other ({otherItems.length})</span>
            <span className="font-mono font-semibold text-foreground">
              {otherCount.toLocaleString()}
            </span>
          </span>
        )}
      </div>
    </div>
  );
};
