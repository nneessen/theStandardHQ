// src/features/close-kpi/components/widgets/SpeedToLeadWidget.tsx

import React from "react";
import { Zap, Phone, Mail, MessageSquare, AlertTriangle } from "lucide-react";
import type { SpeedToLeadResult } from "../../types/close-kpi.types";

interface SpeedToLeadWidgetProps {
  data: SpeedToLeadResult;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} hr`;
  return `${(minutes / 1440).toFixed(1)} days`;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="h-2.5 w-2.5" />,
  email: <Mail className="h-2.5 w-2.5" />,
  sms: <MessageSquare className="h-2.5 w-2.5" />,
};

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
    firstContactChannel,
    missedWindows,
    untouchedAvgAgeDays,
  } = data;

  const maxBucket = Math.max(...distribution.map((d) => d.count), 1);
  const untouchedCount = totalLeads - leadsWithActivity;

  // Color code: fast = green, slow = red
  const speedColor =
    medianMinutes <= 15
      ? "text-[hsl(var(--success))]"
      : medianMinutes <= 60
        ? "text-warning"
        : "text-destructive";

  // Find the most impactful missed window signal (first one with significant count)
  const topMissedWindow = missedWindows?.find((w) => w.pctOfContacted >= 20);

  return (
    <div className="flex h-full flex-col gap-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
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

      {/* Channel breakdown */}
      {firstContactChannel && firstContactChannel.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border/40 pt-1">
          <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            1st touch
          </span>
          {firstContactChannel.map((ch) => (
            <span
              key={ch.channel}
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
            >
              {CHANNEL_ICONS[ch.channel]}
              <span className="font-mono font-semibold text-foreground">
                {ch.count}
              </span>
              <span className="text-[9px]">({formatTime(ch.avgMinutes)})</span>
            </span>
          ))}
        </div>
      )}

      {/* Missed window + untouched signals */}
      {(topMissedWindow ||
        (untouchedCount > 0 &&
          untouchedAvgAgeDays &&
          untouchedAvgAgeDays > 1)) && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded bg-warning/10/50 px-1.5 py-0.5 dark:bg-warning/10">
          <AlertTriangle className="h-2.5 w-2.5 text-warning" />
          {topMissedWindow && (
            <span className="text-[10px] text-warning">
              <span className="font-mono font-semibold">
                {topMissedWindow.count}
              </span>{" "}
              leads {topMissedWindow.label} ({topMissedWindow.pctOfContacted}%)
            </span>
          )}
          {untouchedCount > 0 &&
            untouchedAvgAgeDays != null &&
            untouchedAvgAgeDays > 1 && (
              <span className="text-[10px] text-warning">
                <span className="font-mono font-semibold">
                  {untouchedCount}
                </span>{" "}
                untouched, {Math.round(untouchedAvgAgeDays)}d avg age
              </span>
            )}
        </div>
      )}

      {/* Footer stats */}
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span>{totalLeads} leads</span>
        <span className="text-success">{leadsWithActivity} contacted</span>
        {untouchedCount > 0 && (
          <span className="text-warning">{untouchedCount} untouched</span>
        )}
      </div>
    </div>
  );
};
