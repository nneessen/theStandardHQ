// src/features/close-kpi/components/widgets/DialAttemptsWidget.tsx

import React from "react";
import { PhoneCall, AlertTriangle } from "lucide-react";
import type { DialAttemptsResult } from "../../types/close-kpi.types";

interface DialAttemptsWidgetProps {
  data: DialAttemptsResult;
}

export const DialAttemptsWidget: React.FC<DialAttemptsWidgetProps> = ({
  data,
}) => {
  const {
    avgAttempts: _avgAttempts,
    medianAttempts,
    totalLeadsDialed,
    leadsConnected,
    neverConnected,
    connectPct,
    attemptRates,
    diminishingReturnsAttempt,
  } = data;

  const maxAttemptTotal = Math.max(...attemptRates.map((a) => a.total), 1);

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Dial Attempts to Connect
          </span>
        </div>
      </div>

      {/* Primary metrics */}
      <div className="flex items-baseline gap-4">
        <div>
          <span className="font-mono text-2xl font-bold text-foreground">
            {medianAttempts}
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">
            median attempts
          </span>
        </div>
        <div>
          <span className="font-mono text-sm font-semibold text-foreground">
            {connectPct}%
          </span>
          <span className="ml-1 text-[10px] text-muted-foreground">
            ever connect
          </span>
        </div>
      </div>

      {/* Attempt-by-attempt success rates */}
      <div className="flex-1 space-y-0.5">
        <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          Connect Rate by Attempt #
        </p>
        {attemptRates.map((a) => (
          <div key={a.attempt} className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
              #{a.attempt}
            </span>
            <div className="relative flex-1">
              {/* Total bar (gray) */}
              <div
                className="h-3.5 rounded-sm bg-muted"
                style={{
                  width: `${(a.total / maxAttemptTotal) * 100}%`,
                  minWidth: a.total > 0 ? "2px" : "0",
                }}
              />
              {/* Answered overlay (green) */}
              <div
                className="absolute left-0 top-0 h-3.5 rounded-sm bg-[hsl(var(--success))]/70"
                style={{
                  width: `${(a.answered / maxAttemptTotal) * 100}%`,
                  minWidth: a.answered > 0 ? "2px" : "0",
                }}
              />
            </div>
            <span className="w-20 text-right font-mono text-[10px]">
              <span className="font-semibold text-foreground">
                {a.connectRate}%
              </span>
              <span className="ml-0.5 text-muted-foreground">
                ({a.answered}/{a.total})
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Diminishing returns signal */}
      {diminishingReturnsAttempt != null && (
        <div className="flex items-center gap-1 rounded bg-amber-50/50 px-1.5 py-0.5 dark:bg-amber-950/20">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-[10px] text-amber-700 dark:text-amber-300">
            Diminishing returns after attempt{" "}
            <span className="font-mono font-semibold">
              #{diminishingReturnsAttempt}
            </span>{" "}
            — consider deprioritizing
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="rounded bg-muted/50 px-1.5 py-0.5 text-center">
          <span className="font-mono font-semibold text-foreground">
            {totalLeadsDialed}
          </span>
          <span className="ml-0.5 text-muted-foreground">dialed</span>
        </div>
        <div className="rounded bg-muted/50 px-1.5 py-0.5 text-center">
          <span className="font-mono font-semibold text-[hsl(var(--success))]">
            {leadsConnected}
          </span>
          <span className="ml-0.5 text-muted-foreground">connected</span>
        </div>
        <div className="rounded bg-muted/50 px-1.5 py-0.5 text-center">
          <span className="font-mono font-semibold text-destructive">
            {neverConnected}
          </span>
          <span className="ml-0.5 text-muted-foreground">never</span>
        </div>
      </div>
    </div>
  );
};
