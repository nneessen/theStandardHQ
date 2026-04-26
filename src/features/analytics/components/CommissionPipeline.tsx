// src/features/analytics/components/CommissionPipeline.tsx

import React from "react";
import { cn } from "@/lib/utils";
import { useAnalyticsData } from "../../../hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { AlertTriangle, Clock } from "lucide-react";
import { parseLocalDate } from "@/lib/date";

/**
 * CommissionPipeline - Shows pending commissions and cash flow forecast
 * Critical for financial planning - shows WHEN money is coming
 */
export function CommissionPipeline() {
  const { dateRange } = useAnalyticsDateRange();
  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Commission Pipeline
        </div>
        <div className="p-3 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          Loading...
        </div>
      </div>
    );
  }

  // Calculate commission pipeline data
  const now = new Date();
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const next60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const next90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Group commissions by payment status and timeline
  let pending30 = 0;
  let pending60 = 0;
  let pending90 = 0;
  let pendingCount30 = 0;
  let pendingCount60 = 0;
  let pendingCount90 = 0;
  let atRisk = 0;
  let atRiskCount = 0;
  const _totalPaid = 0;
  let totalPending = 0;

  // Build policy map for O(1) lookups
  const policyMap = new Map(raw.policies.map((p) => [p.id, p]));

  raw.commissions.forEach((commission) => {
    const policy = policyMap.get(commission.policyId || "");

    if (commission.status === "paid") {
      // _totalPaid += commission.amount || 0;
    } else if (commission.status === "pending") {
      totalPending += commission.amount || 0;

      // Estimate payment date based on policy date + typical payment cycle (30 days)
      if (policy?.effectiveDate) {
        const policyDate = parseLocalDate(policy.effectiveDate);
        const estimatedPaymentDate = new Date(
          policyDate.getTime() + 30 * 24 * 60 * 60 * 1000,
        );

        if (estimatedPaymentDate <= next30Days) {
          pending30 += commission.amount || 0;
          pendingCount30++;
        } else if (estimatedPaymentDate <= next60Days) {
          pending60 += commission.amount || 0;
          pendingCount60++;
        } else if (estimatedPaymentDate <= next90Days) {
          pending90 += commission.amount || 0;
          pendingCount90++;
        }
      }

      // Check if policy is at risk (within first 6 months - contestability period)
      if (policy?.effectiveDate) {
        const policyDate = parseLocalDate(policy.effectiveDate);
        const sixMonthsAgo = new Date(
          now.getTime() - 180 * 24 * 60 * 60 * 1000,
        );

        if (policyDate > sixMonthsAgo && policy.lifecycleStatus === "lapsed") {
          atRisk += commission.amount || 0;
          atRiskCount++;
        }
      }
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate cash flow velocity from actual historical payment data (not circular pending math)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const paidLast90Days = raw.commissions
    .filter((c) => {
      if (c.status !== "paid") return false;
      const payDate = c.paymentDate
        ? new Date(c.paymentDate as string)
        : new Date(c.createdAt);
      return payDate >= ninetyDaysAgo;
    })
    .reduce((sum, c) => sum + (c.amount || 0), 0);
  const avgDailyEarnings = paidLast90Days / 90;
  const projectedQuarterly = avgDailyEarnings * 90;

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="mb-2">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Commission Pipeline
        </div>
        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
          Cash Flow Forecast
        </div>
      </div>

      {/* Pipeline Timeline */}
      <div className="space-y-2 mb-3">
        {/* Next 30 Days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Next 30 days
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(pending30)}
            </span>
            {pendingCount30 > 0 && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                ({pendingCount30})
              </span>
            )}
          </div>
        </div>

        {/* Next 60 Days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Next 60 days
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
              {formatCurrency(pending60)}
            </span>
            {pendingCount60 > 0 && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                ({pendingCount60})
              </span>
            )}
          </div>
        </div>

        {/* Next 90 Days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Next 90 days
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono text-blue-600 dark:text-blue-400">
              {formatCurrency(pending90)}
            </span>
            {pendingCount90 > 0 && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                ({pendingCount90})
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

        {/* At Risk */}
        {atRisk > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                At Risk
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-red-600 dark:text-red-400">
                {formatCurrency(atRisk)}
              </span>
              {atRiskCount > 0 && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  ({atRiskCount})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2 p-2 bg-zinc-100 dark:bg-zinc-800 rounded">
        <div className="text-center">
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase">
            Total Pending
          </div>
          <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
            {formatCurrency(totalPending)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase">
            Quarterly Proj
          </div>
          <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(projectedQuarterly)}
          </div>
        </div>
      </div>

      {/* Cash Flow Status */}
      <div
        className={cn(
          "mt-2 p-1.5 rounded text-center text-[10px] font-medium",
          totalPending > 50000
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : totalPending > 25000
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400",
        )}
      >
        {totalPending > 50000
          ? "Strong pipeline - cash flow healthy"
          : totalPending > 25000
            ? "Moderate pipeline - maintain activity"
            : "Weak pipeline - increase sales activity"}
      </div>
    </div>
  );
}
