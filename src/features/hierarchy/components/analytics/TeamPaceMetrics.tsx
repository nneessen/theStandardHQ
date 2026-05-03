// src/features/hierarchy/components/analytics/TeamPaceMetrics.tsx

import React from "react";
import { cn } from "@/lib/utils";
import type { TeamPaceMetrics as TeamPaceMetricsType } from "@/types/team-analytics.types";

interface TeamPaceMetricsProps {
  data: TeamPaceMetricsType | null;
  isLoading?: boolean;
}

/**
 * TeamPaceMetrics - Shows team pace towards goals
 *
 * Displays:
 * - Total AP written by team
 * - Projected totals based on current pace
 * - Surplus/deficit against targets
 * - Time remaining in period
 */
export function TeamPaceMetrics({ data, isLoading }: TeamPaceMetricsProps) {
  if (isLoading || !data) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
          Team Pace Metrics
        </div>
        <div className="p-3 text-center text-[11px] text-v2-ink-muted">
          {isLoading ? "Loading..." : "No data available"}
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-semibold text-v2-ink-muted uppercase tracking-[0.18em]">
            Team Pace Metrics
          </div>
          <div className="text-[10px] text-v2-ink-subtle">
            {data.timePeriod}
          </div>
        </div>
        <div
          className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-medium",
            data.isProfitable
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {data.isProfitable ? "ON TRACK" : "BEHIND"}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-1">
        {/* Total AP Written */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-v2-ink-muted">Team AP Written</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-v2-ink">
              {formatCurrency(data.totalAPWritten)}
            </span>
            <span className="text-v2-ink-subtle">
              ({data.totalPoliciesWritten} policies)
            </span>
          </div>
        </div>

        {/* Projected Total */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-v2-ink-muted">Projected AP</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-warning">
              {formatCurrency(data.projectedAPTotal)}
            </span>
            <span className="text-v2-ink-subtle">
              @ {formatCurrency(data.currentAPPace)}/day
            </span>
          </div>
        </div>

        {/* Average Premium */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-v2-ink-muted">Avg Premium</span>
          <span className="font-mono font-bold text-v2-ink">
            {formatCurrency(data.avgPremiumPerPolicy)}
          </span>
        </div>

        {/* Projected Policies */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-v2-ink-muted">Projected Policies</span>
          <span className="font-mono font-bold text-v2-ink">
            {data.projectedPolicyTotal}
          </span>
        </div>

        {/* Divider */}
        <div className="h-px bg-v2-ring my-1" />

        {/* Surplus/Deficit */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-v2-ink-muted uppercase">
            {data.isProfitable ? "Surplus" : "Deficit"}
          </span>
          <span
            className={cn(
              "font-mono font-bold",
              data.isProfitable ? "text-success" : "text-destructive",
            )}
          >
            {formatCurrency(Math.abs(data.surplusDeficit))}
          </span>
        </div>

        {/* Time Remaining */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-v2-ink-muted">Time Left</span>
          <span className="font-mono font-bold text-v2-ink">
            {data.daysRemaining} {data.daysRemaining === 1 ? "day" : "days"}
          </span>
        </div>
      </div>
    </div>
  );
}
