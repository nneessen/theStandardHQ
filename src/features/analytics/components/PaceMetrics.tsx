// src/features/analytics/components/PaceMetrics.tsx

import React from "react";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useAnalyticsData } from "@/hooks";
import { cn } from "@/lib/utils";

/**
 * PaceMetrics - Shows pace and projection metrics for the selected analytics period
 *
 * Uses useAnalyticsData filtered by the analytics date context so metrics
 * update when the user switches time periods.
 */
export function PaceMetrics() {
  const { dateRange, timePeriod } = useAnalyticsDateRange();

  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
          Pace Metrics
        </div>
        <div className="p-3 text-center text-[11px] text-v2-ink-muted">
          Loading...
        </div>
      </div>
    );
  }

  const { policies, commissions, expenses } = raw;

  // Derive pace calculations from filtered data
  const premiumWritten = policies.reduce(
    (sum, p) => sum + (p.annualPremium ?? 0),
    0,
  );
  const policyCount = policies.length;
  const averagePremium = policyCount > 0 ? premiumWritten / policyCount : 0;

  const totalCommissions = commissions.reduce(
    (sum, c) => sum + (c.amount ?? 0),
    0,
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const netIncome = totalCommissions - totalExpenses;
  const surplusDeficit = netIncome;
  const isProfitable = surplusDeficit >= 0;

  // Calculate time remaining based on selected period
  const now = new Date();
  const msRemaining = dateRange.actualEndDate.getTime() - now.getTime();
  const daysRemaining = Math.max(
    0,
    Math.floor(msRemaining / (24 * 60 * 60 * 1000)),
  );
  const hoursRemaining = Math.floor(
    (msRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
  );

  // Calculate days elapsed in period
  const msElapsed = now.getTime() - dateRange.startDate.getTime();
  const daysElapsed = Math.max(1, Math.ceil(msElapsed / (24 * 60 * 60 * 1000)));

  // Total days in period
  const totalDaysInPeriod = Math.ceil(
    (dateRange.actualEndDate.getTime() - dateRange.startDate.getTime()) /
      (24 * 60 * 60 * 1000),
  );

  // Pace projections
  const currentAPPace = premiumWritten / daysElapsed;
  const projectedAPTotal = currentAPPace * totalDaysInPeriod;
  const currentPolicyPace = policyCount / daysElapsed;
  const projectedPolicyTotal = Math.round(
    currentPolicyPace * totalDaysInPeriod,
  );

  // Breakeven target — use actual avg commission per policy, not hardcoded 50% ratio
  const totalDaysRemaining = daysRemaining + hoursRemaining / 24;
  const deficitAmount = Math.max(0, -surplusDeficit);
  const avgCommissionPerPolicy =
    policyCount > 0 ? totalCommissions / policyCount : 0;
  const policiesNeeded =
    avgCommissionPerPolicy > 0
      ? Math.ceil(deficitAmount / avgCommissionPerPolicy)
      : 0;
  const dailyTarget =
    policiesNeeded > 0 && totalDaysRemaining > 0
      ? Math.ceil(policiesNeeded / totalDaysRemaining)
      : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return Math.ceil(value).toLocaleString();
  };

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case "MTD":
        return "This Month";
      case "YTD":
        return "This Year";
      case "L30":
        return "Last 30 Days";
      case "L60":
        return "Last 60 Days";
      case "L90":
        return "Last 90 Days";
      case "L12M":
        return "Last 12 Months";
      case "CUSTOM":
        return "Custom Period";
      default:
        return "This Period";
    }
  };

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
            Pace Metrics
          </div>
          <div className="text-xs text-v2-ink-muted mt-0.5">
            {getTimePeriodLabel()}
          </div>
        </div>
        <div
          className={cn(
            "px-3 py-1 rounded-v2-pill text-[10px] font-semibold tracking-wide uppercase",
            isProfitable
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
          )}
        >
          {isProfitable ? "Profitable" : "Deficit"}
        </div>
      </div>

      {/* Hero number — projected AP */}
      <div className="mb-4">
        <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] mb-1">
          Projected AP
        </div>
        <div className="text-3xl font-semibold tracking-tight text-v2-ink leading-none">
          {formatCurrency(projectedAPTotal)}
        </div>
        <div className="text-[11px] text-v2-ink-muted mt-1">
          @ {formatCurrency(currentAPPace)}/day · {projectedPolicyTotal}{" "}
          projected policies
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-v2-canvas border border-v2-ring rounded-v2-sm p-3">
          <div className="text-[10px] text-v2-ink-subtle uppercase tracking-[0.14em]">
            AP written
          </div>
          <div className="text-lg font-semibold text-v2-ink mt-0.5 leading-tight">
            {formatCurrency(premiumWritten)}
          </div>
          <div className="text-[10px] text-v2-ink-subtle mt-0.5">
            {policyCount} policies
          </div>
        </div>
        <div className="bg-v2-canvas border border-v2-ring rounded-v2-sm p-3">
          <div className="text-[10px] text-v2-ink-subtle uppercase tracking-[0.14em]">
            Average AP
          </div>
          <div className="text-lg font-semibold text-v2-ink mt-0.5 leading-tight">
            {formatCurrency(averagePremium)}
          </div>
          <div className="text-[10px] text-v2-ink-subtle mt-0.5">
            per policy
          </div>
        </div>
      </div>

      <div className="h-px bg-v2-ring my-3" />

      {/* Footer row — surplus/deficit + time */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
            {isProfitable ? "Surplus" : "Deficit"}
          </div>
          <div
            className={cn(
              "text-lg font-semibold leading-tight mt-0.5",
              isProfitable
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {formatCurrency(Math.abs(netIncome))}
          </div>
          {!isProfitable && (
            <div className="text-[10px] text-v2-ink-subtle">
              need {formatNumber(dailyTarget)}/day
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em]">
            Time left
          </div>
          <div className="text-lg font-semibold text-v2-ink leading-tight mt-0.5">
            {daysRemaining > 0 ? `${daysRemaining}d` : `${hoursRemaining}h`}
          </div>
        </div>
      </div>
    </div>
  );
}
