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
        <div className="p-3 text-center text-[11px] text-v2-ink-muted">
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
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-5">
      <div className="mb-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Commission Pipeline
        </div>
        <div className="text-xs text-v2-ink-muted mt-0.5">
          Cash flow forecast
        </div>
      </div>

      {/* Hero pending number */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-1">
          Total Pending
        </div>
        <div className="text-3xl font-semibold tracking-tight text-v2-ink leading-none">
          {formatCurrency(totalPending)}
        </div>
        <div className="text-[11px] text-v2-ink-muted mt-1">
          Quarterly projection · {formatCurrency(projectedQuarterly)}
        </div>
      </div>

      {/* Pipeline Timeline */}
      <div className="space-y-2.5 mb-3">
        {/* Next 30 Days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-success" />
            <span className="text-[11px] text-v2-ink-muted">Next 30 days</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono text-success">
              {formatCurrency(pending30)}
            </span>
            {pendingCount30 > 0 && (
              <span className="text-[10px] text-v2-ink-subtle">
                ({pendingCount30})
              </span>
            )}
          </div>
        </div>

        {/* Next 60 Days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-warning" />
            <span className="text-[11px] text-v2-ink-muted">Next 60 days</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono text-warning">
              {formatCurrency(pending60)}
            </span>
            {pendingCount60 > 0 && (
              <span className="text-[10px] text-v2-ink-subtle">
                ({pendingCount60})
              </span>
            )}
          </div>
        </div>

        {/* Next 90 Days */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-info" />
            <span className="text-[11px] text-v2-ink-muted">Next 90 days</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono text-info">
              {formatCurrency(pending90)}
            </span>
            {pendingCount90 > 0 && (
              <span className="text-[10px] text-v2-ink-subtle">
                ({pendingCount90})
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-v2-ring" />

        {/* At Risk */}
        {atRisk > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-destructive" />
              <span className="text-[11px] text-v2-ink-muted">At Risk</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono text-destructive">
                {formatCurrency(atRisk)}
              </span>
              {atRiskCount > 0 && (
                <span className="text-[10px] text-v2-ink-subtle">
                  ({atRiskCount})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cash Flow Status pill */}
      <div
        className={cn(
          "rounded-v2-pill px-3 py-2 text-center text-[11px] font-semibold",
          totalPending > 50000
            ? "bg-success/20 text-success dark:bg-success/40 dark:text-success"
            : totalPending > 25000
              ? "bg-warning/20 text-warning dark:bg-warning/40 dark:text-warning"
              : "bg-destructive/20 text-destructive dark:bg-destructive/40 dark:text-destructive",
        )}
      >
        {totalPending > 50000
          ? "Strong pipeline · cash flow healthy"
          : totalPending > 25000
            ? "Moderate pipeline · maintain activity"
            : "Weak pipeline · increase sales activity"}
      </div>
    </div>
  );
}
