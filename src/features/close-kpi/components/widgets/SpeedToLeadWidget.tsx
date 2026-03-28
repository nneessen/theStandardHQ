// src/features/close-kpi/components/widgets/SpeedToLeadWidget.tsx

import React from "react";
import { Zap } from "lucide-react";
import type { SpeedToLeadResult } from "../../types/close-kpi.types";

interface SpeedToLeadWidgetProps {
  data: SpeedToLeadResult;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hr`;
  return `${(minutes / 1440).toFixed(1)} days`;
}

export const SpeedToLeadWidget: React.FC<SpeedToLeadWidgetProps> = ({
  data,
}) => {
  const {
    avgMinutes,
    medianMinutes,
    distribution,
    totalLeads,
    leadsWithActivity,
    pctContacted,
  } = data;

  const maxBucket = Math.max(...distribution.map((d) => d.count), 1);

  // Color code: fast = green, slow = red
  const speedColor =
    medianMinutes <= 15
      ? "text-[hsl(var(--success))]"
      : medianMinutes <= 60
        ? "text-[hsl(var(--warning))]"
        : "text-destructive";

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Speed to Lead
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {pctContacted}% contacted
        </span>
      </div>

      {/* Primary metric */}
      <div className="flex items-baseline gap-3">
        <div>
          <span className={`font-mono text-2xl font-bold ${speedColor}`}>
            {formatTime(medianMinutes)}
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">median</span>
        </div>
        <div>
          <span className="font-mono text-sm font-semibold text-foreground">
            {formatTime(avgMinutes)}
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">avg</span>
        </div>
      </div>

      {/* Distribution bars */}
      <div className="flex-1 space-y-0.5">
        {distribution.map((bucket) => (
          <div key={bucket.label} className="flex items-center gap-1.5">
            <span className="w-16 shrink-0 text-right text-[10px] text-muted-foreground">
              {bucket.label}
            </span>
            <div className="flex-1">
              <div
                className="h-3.5 rounded-sm bg-foreground/60"
                style={{
                  width: `${(bucket.count / maxBucket) * 100}%`,
                  minWidth: bucket.count > 0 ? "2px" : "0",
                }}
              />
            </div>
            <span className="w-8 text-right font-mono text-[10px] font-semibold text-foreground">
              {bucket.count}
            </span>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>{totalLeads} leads</span>
        <span>{leadsWithActivity} contacted</span>
        <span>{totalLeads - leadsWithActivity} untouched</span>
      </div>
    </div>
  );
};
