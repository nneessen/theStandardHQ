// src/services/analytics/policyStatusService.ts

import type { Policy } from "@/types";
import { startOfMonth, format, subMonths } from "date-fns";
import { parseLocalDate } from "@/lib/date";

export interface PolicyStatusSummary {
  active: {
    count: number;
    percentage: number;
  };
  lapsed: {
    count: number;
    percentage: number;
  };
  cancelled: {
    count: number;
    percentage: number;
  };
  total: number;
}

export interface MonthlyTrendData {
  month: string; // e.g., "Jan 2025"
  active: number;
  lapsed: number;
  netChange: number; // new policies - lost policies
}

export interface ProductRetentionRate {
  productName: string;
  totalPolicies: number;
  activePolicies: number;
  retentionRate: number; // percentage
}

/**
 * Calculate summary of policy statuses
 */
export function getPolicyStatusSummary(
  policies: Policy[],
): PolicyStatusSummary {
  const total = policies.length;

  if (total === 0) {
    return {
      active: { count: 0, percentage: 0 },
      lapsed: { count: 0, percentage: 0 },
      cancelled: { count: 0, percentage: 0 },
      total: 0,
    };
  }

  const activeCount = policies.filter(
    (p) => p.lifecycleStatus === "active",
  ).length;
  const lapsedCount = policies.filter(
    (p) => p.lifecycleStatus === "lapsed",
  ).length;
  const cancelledCount = policies.filter(
    (p) => p.lifecycleStatus === "cancelled",
  ).length;

  return {
    active: {
      count: activeCount,
      percentage: Math.round((activeCount / total) * 100),
    },
    lapsed: {
      count: lapsedCount,
      percentage: Math.round((lapsedCount / total) * 100),
    },
    cancelled: {
      count: cancelledCount,
      percentage: Math.round((cancelledCount / total) * 100),
    },
    total,
  };
}

/**
 * Get monthly trend data for last 12 months
 * Shows active vs lapsed count per month
 */
export function getMonthlyTrendData(policies: Policy[]): MonthlyTrendData[] {
  const now = new Date();
  const months: MonthlyTrendData[] = [];

  // Generate last 12 months
  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const monthStart = startOfMonth(monthDate);
    const monthLabel = format(monthDate, "MMM yyyy");

    // Count policies that were active in this month
    const activePolicies = policies.filter((p) => {
      const effectiveDate = parseLocalDate(p.effectiveDate);
      return effectiveDate <= monthStart && p.lifecycleStatus === "active";
    });

    // Count policies that lapsed in this month (approximation)
    const lapsedPolicies = policies.filter((p) => {
      const effectiveDate = parseLocalDate(p.effectiveDate);
      return effectiveDate <= monthStart && p.lifecycleStatus === "lapsed";
    });

    // Net change (rough calculation - policies added vs lost)
    const newPolicies = policies.filter((p) => {
      const effectiveDate = parseLocalDate(p.effectiveDate);
      return (
        effectiveDate.getMonth() === monthStart.getMonth() &&
        effectiveDate.getFullYear() === monthStart.getFullYear()
      );
    });

    months.push({
      month: monthLabel,
      active: activePolicies.length,
      lapsed: lapsedPolicies.length,
      netChange: newPolicies.length,
    });
  }

  return months;
}

export interface MonthlyWrittenData {
  month: string; // e.g., "Jan 2025"
  written: number; // policies written (submitted) in that month
}

/**
 * Policies written per month over the last 12 months.
 *
 * Counts new business by the month of `submitDate` (falling back to
 * `effectiveDate`) — the same date convention the analytics hook uses. Unlike
 * the legacy `getMonthlyTrendData`, this does NOT paint each policy's CURRENT
 * lifecycle status onto every prior month, so the result is an honest
 * production histogram rather than a cumulative ramp.
 */
export function getMonthlyPoliciesWritten(
  policies: Policy[],
): MonthlyWrittenData[] {
  const now = new Date();
  const months: MonthlyWrittenData[] = [];

  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const written = policies.filter((p) => {
      const d = parseLocalDate(p.submitDate || p.effectiveDate);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;

    months.push({ month: format(monthDate, "MMM yyyy"), written });
  }

  return months;
}

export interface PolicyStatusSnapshot {
  active: number; // in force
  lapsed: number;
  cancelled: number;
  pending: number; // application still in underwriting (status === "pending")
  total: number; // active + lapsed + cancelled + pending
}

/**
 * Point-in-time snapshot of the book by current status.
 *
 * Issued policies are bucketed by `lifecycleStatus`; applications still in
 * underwriting (`status === "pending"`, which carry a null lifecycleStatus) are
 * surfaced as `pending` instead of silently vanishing from the counts. Terminal
 * non-issued applications (withdrawn/denied) are intentionally excluded — they
 * belong to the conversion funnel, not the policy-status view.
 */
export function getPolicyStatusSnapshot(
  policies: Policy[],
): PolicyStatusSnapshot {
  let active = 0;
  let lapsed = 0;
  let cancelled = 0;
  let pending = 0;

  for (const p of policies) {
    if (p.lifecycleStatus === "active") active++;
    else if (p.lifecycleStatus === "lapsed") lapsed++;
    else if (p.lifecycleStatus === "cancelled") cancelled++;
    else if (p.status === "pending") pending++;
  }

  return {
    active,
    lapsed,
    cancelled,
    pending,
    total: active + lapsed + cancelled + pending,
  };
}

/**
 * Calculate retention rates by product
 * Returns top and bottom performers
 */
export function getProductRetentionRates(policies: Policy[]): {
  bestPerformers: ProductRetentionRate[];
  needsAttention: ProductRetentionRate[];
} {
  // Group by product
  const productMap = new Map<string, { total: number; active: number }>();

  policies.forEach((policy) => {
    const productName = policy.product || "Unknown";
    const existing = productMap.get(productName) || { total: 0, active: 0 };

    productMap.set(productName, {
      total: existing.total + 1,
      active: existing.active + (policy.lifecycleStatus === "active" ? 1 : 0),
    });
  });

  // Convert to array and calculate retention rates
  const productRates: ProductRetentionRate[] = Array.from(productMap.entries())
    .map(([productName, data]) => ({
      productName,
      totalPolicies: data.total,
      activePolicies: data.active,
      retentionRate:
        data.total > 0 ? Math.round((data.active / data.total) * 100) : 0,
    }))
    .filter((p) => p.totalPolicies >= 3); // Only include products with 3+ policies

  // Sort by retention rate
  const sorted = productRates.sort((a, b) => b.retentionRate - a.retentionRate);

  // Get best performers (top 5)
  const bestPerformers = sorted.slice(0, 5);
  const bestPerformerNames = new Set(bestPerformers.map((p) => p.productName));

  // Get needs attention (bottom 5), excluding any that are already best performers
  const needsAttention = sorted
    .slice(-5)
    .reverse()
    .filter((p) => !bestPerformerNames.has(p.productName));

  return { bestPerformers, needsAttention };
}
