// src/features/analytics/components/ConversionFunnel.tsx

import React from "react";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useAnalyticsData } from "@/hooks";
import { useLeadPurchases } from "@/hooks/lead-purchases";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date";

/**
 * ConversionFunnel - Lead-to-policy pipeline showing conversion at each stage
 */
export function ConversionFunnel() {
  const { dateRange } = useAnalyticsDateRange();

  const { raw, isLoading: analyticsLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const { data: leadPurchases, isLoading: leadsLoading } = useLeadPurchases();

  const isLoading = analyticsLoading || leadsLoading;

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Conversion Funnel
        </div>
        <div className="p-3 text-center text-[11px] text-v2-ink-muted">
          Loading...
        </div>
      </div>
    );
  }

  // Filter lead purchases within date range
  const periodLeadPurchases = (leadPurchases || []).filter((lp) => {
    const date = parseLocalDate(lp.purchaseDate);
    return date >= dateRange.startDate && date <= dateRange.endDate;
  });

  // Total leads purchased in period
  const leadsPurchased = periodLeadPurchases.reduce(
    (sum, lp) => sum + lp.leadCount,
    0,
  );

  // Applications submitted = policies with submit_date in range
  const policiesWithSubmit = raw.policies.filter((p) => p.submitDate);
  const applicationsSubmitted = policiesWithSubmit.length;

  // Approved = policies with status approved
  const approved = raw.policies.filter((p) => p.status === "approved").length;

  // Active = policies with lifecycle_status active
  const active = raw.policies.filter(
    (p) => p.lifecycleStatus === "active",
  ).length;

  // Time-to-close: avg days from submit_date to effective_date
  const closeTimes = raw.policies
    .filter((p) => p.submitDate && p.effectiveDate)
    .map((p) => {
      const submit = new Date(p.submitDate!);
      const effective = parseLocalDate(p.effectiveDate);
      return (effective.getTime() - submit.getTime()) / (1000 * 60 * 60 * 24);
    })
    .filter((d) => d >= 0);

  const avgTimeToClose =
    closeTimes.length > 0
      ? Math.round(closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length)
      : 0;

  // Build funnel stages
  const stages = [
    {
      label: "Leads Purchased",
      count: leadsPurchased,
      color: "bg-blue-500",
    },
    {
      label: "Applications",
      count: applicationsSubmitted,
      color: "bg-indigo-500",
    },
    {
      label: "Approved",
      count: approved,
      color: "bg-amber-500",
    },
    {
      label: "Active",
      count: active,
      color: "bg-emerald-500",
    },
  ];

  // Max count for bar scaling
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
            Conversion Funnel
          </div>
          <div className="text-xs text-v2-ink-muted mt-0.5">
            Lead-to-policy pipeline
          </div>
        </div>
        {leadsPurchased > 0 && (
          <div className="text-right">
            <div className="text-3xl font-semibold tracking-tight text-v2-ink leading-none">
              {((active / leadsPurchased) * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-v2-ink-subtle mt-1">
              lead → active
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {stages.map((stage, idx) => {
          const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const prevCount = idx > 0 ? stages[idx - 1].count : 0;
          const conversionRate =
            prevCount > 0 ? ((stage.count / prevCount) * 100).toFixed(1) : null;

          return (
            <div key={stage.label}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-v2-ink-muted">
                  {stage.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-v2-ink">
                    {stage.count.toLocaleString()}
                  </span>
                  {conversionRate && (
                    <span
                      className={cn(
                        "text-[9px] font-medium px-1 py-0.5 rounded",
                        Number(conversionRate) >= 50
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : Number(conversionRate) >= 25
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-red-500/10 text-red-600 dark:text-red-400",
                      )}
                    >
                      {conversionRate}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2.5 bg-v2-ring rounded-v2-pill overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    stage.color,
                  )}
                  style={{ width: `${Math.max(widthPct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-v2-ink-subtle">Lead→Active</div>
          <div className="font-bold font-mono text-v2-ink">
            {leadsPurchased > 0
              ? `${((active / leadsPurchased) * 100).toFixed(1)}%`
              : "—"}
          </div>
        </div>
        <div className="p-2 bg-v2-canvas border border-v2-ring rounded-v2-sm text-center">
          <div className="text-v2-ink-subtle">Avg Close Time</div>
          <div className="font-bold font-mono text-v2-ink">
            {avgTimeToClose > 0 ? `${avgTimeToClose} days` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
