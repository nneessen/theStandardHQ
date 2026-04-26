// src/features/analytics/components/TrendComparison.tsx

import React from "react";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useAnalyticsData } from "@/hooks";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

/**
 * TrendComparison - Period-over-period comparison showing current vs previous period
 */
export function TrendComparison() {
  const { dateRange } = useAnalyticsDateRange();

  // Current period data
  const { raw: currentRaw, isLoading: currentLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  // Calculate previous period (same length offset back)
  const rangeLengthMs =
    dateRange.endDate.getTime() - dateRange.startDate.getTime();
  const prevStart = new Date(dateRange.startDate.getTime() - rangeLengthMs);
  const prevEnd = new Date(dateRange.startDate.getTime() - 1);

  const { raw: prevRaw, isLoading: prevLoading } = useAnalyticsData({
    startDate: prevStart,
    endDate: prevEnd,
  });

  const isLoading = currentLoading || prevLoading;

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Trend Comparison
        </div>
        <div className="p-3 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  // Calculate metrics
  const currentPolicies = currentRaw.policies.length;
  const prevPolicies = prevRaw.policies.length;

  const currentAP = currentRaw.policies.reduce(
    (sum, p) => sum + (p.annualPremium ?? 0),
    0,
  );
  const prevAP = prevRaw.policies.reduce(
    (sum, p) => sum + (p.annualPremium ?? 0),
    0,
  );

  const currentCommissions = currentRaw.commissions.reduce(
    (sum, c) => sum + (c.amount ?? 0),
    0,
  );
  const prevCommissions = prevRaw.commissions.reduce(
    (sum, c) => sum + (c.amount ?? 0),
    0,
  );

  const currentAvgPremium =
    currentPolicies > 0 ? currentAP / currentPolicies : 0;
  const prevAvgPremium = prevPolicies > 0 ? prevAP / prevPolicies : 0;

  const currentActive = currentRaw.policies.filter(
    (p) => p.lifecycleStatus === "active",
  ).length;
  const prevActive = prevRaw.policies.filter(
    (p) => p.lifecycleStatus === "active",
  ).length;

  const metrics = [
    {
      label: "Policies Written",
      current: currentPolicies,
      previous: prevPolicies,
      format: "number" as const,
    },
    {
      label: "AP Written",
      current: currentAP,
      previous: prevAP,
      format: "currency" as const,
    },
    {
      label: "Commissions",
      current: currentCommissions,
      previous: prevCommissions,
      format: "currency" as const,
    },
    {
      label: "Avg Premium",
      current: currentAvgPremium,
      previous: prevAvgPremium,
      format: "currency" as const,
    },
    {
      label: "Active Policies",
      current: currentActive,
      previous: prevActive,
      format: "number" as const,
    },
  ];

  const formatValue = (value: number, fmt: "number" | "currency") => {
    if (fmt === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return value.toLocaleString();
  };

  const getChangePercent = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Trend Comparison
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          vs prior period
        </span>
      </div>

      <div className="space-y-1.5">
        {metrics.map((metric) => {
          const changePct = getChangePercent(metric.current, metric.previous);
          const isUp = changePct > 0;
          const isDown = changePct < 0;
          const isNeutral = changePct === 0;

          return (
            <div
              key={metric.label}
              className="flex items-center justify-between text-[11px] py-0.5"
            >
              <span className="text-zinc-500 dark:text-zinc-400">
                {metric.label}
              </span>
              <div className="flex items-center gap-3">
                {/* Previous value */}
                <span className="font-mono text-zinc-400 dark:text-zinc-500 text-[10px]">
                  {formatValue(metric.previous, metric.format)}
                </span>

                {/* Arrow */}
                <span className="text-zinc-300 dark:text-zinc-700">→</span>

                {/* Current value */}
                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                  {formatValue(metric.current, metric.format)}
                </span>

                {/* Change badge */}
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium min-w-[42px] justify-center",
                    isUp &&
                      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    isDown && "bg-red-500/10 text-red-600 dark:text-red-400",
                    isNeutral &&
                      "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
                  )}
                >
                  {isUp && <TrendingUp className="h-2.5 w-2.5" />}
                  {isDown && <TrendingDown className="h-2.5 w-2.5" />}
                  {isNeutral
                    ? "—"
                    : `${changePct > 0 ? "+" : ""}${Math.round(changePct)}%`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
