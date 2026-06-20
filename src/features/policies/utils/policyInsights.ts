// src/features/policies/utils/policyInsights.ts
// Pure aggregation helpers for the Policies "insights band" (the four cards
// that reclaim the dead space above the table). Every figure is derived from
// the SAME full policy list (+ commission rows) so the cards reconcile with
// one another — see the Policies redesign handoff. No mock data: callers pass
// the real, filtered dataset and these functions fold it down.

import type { Policy } from "@/types/policy.types";
import type { Commission } from "@/types/commission.types";
import { parseLocalDate } from "@/lib/date";

/** Commission pipeline split — paid + earned(unpaid) + pending = total. */
export interface CommissionPipeline {
  paid: number;
  earned: number;
  pending: number;
  total: number;
}

/**
 * Policy status mix for the donut. A strict partition of the dataset: every
 * policy lands in exactly one bucket, so the four counts always sum to total.
 * `incomplete` = policies with no recognised application status set (NOT
 * lapsed/denied — those fold into `cancelled`, which means "closed/inactive").
 */
export interface PolicyStatusMix {
  active: number;
  pending: number;
  cancelled: number;
  incomplete: number;
  total: number;
}

export interface CarrierPremium {
  carrierId: string;
  name: string;
  premium: number;
}

export interface MonthlyPremium {
  /** First day of the month this bucket represents. */
  month: Date;
  /** Short label, e.g. "Jun". */
  label: string;
  premium: number;
}

/** Sum the commission rows into the paid / earned / pending pipeline split. */
export function computeCommissionPipeline(
  commissions: Commission[],
): CommissionPipeline {
  let paid = 0;
  let earned = 0;
  let pending = 0;

  for (const c of commissions) {
    const amount = c.amount || 0;
    // NOTE: cast to string is deliberate — the CommissionStatus TS union is
    // incomplete; "earned" is a REAL runtime status in the data (PolicyList
    // renders an "earned" badge too). Do NOT drop the "earned" case — it
    // carries live earned-but-unadvanced commission (was ~$36k on Epic Life).
    switch (c.status as string) {
      case "paid":
        paid += amount;
        break;
      case "pending":
        pending += amount;
        break;
      case "earned":
      case "unpaid":
        earned += amount;
        break;
      // cancelled / charged_back are excluded from the live pipeline.
      default:
        break;
    }
  }

  return { paid, earned, pending, total: paid + earned + pending };
}

/** Partition the policies into the four donut segments (sums to total). */
export function computeStatusMix(policies: Policy[]): PolicyStatusMix {
  let active = 0;
  let pending = 0;
  let cancelled = 0;

  for (const p of policies) {
    if (p.status === "pending") {
      pending += 1;
    } else if (p.status === "approved") {
      // Approved → split on lifecycle. Missing lifecycle reads as active.
      if (!p.lifecycleStatus || p.lifecycleStatus === "active") {
        active += 1;
      } else {
        // lapsed / cancelled / expired → closed/inactive
        cancelled += 1;
      }
    } else if (p.status === "denied" || p.status === "withdrawn") {
      cancelled += 1;
    }
    // anything else falls through → counted as incomplete via remainder
  }

  const total = policies.length;
  const incomplete = Math.max(0, total - active - pending - cancelled);
  return { active, pending, cancelled, incomplete, total };
}

/** Top N carriers by summed annual premium. */
export function computeTopCarriers(
  policies: Policy[],
  carrierNames: Record<string, string>,
  limit = 4,
): CarrierPremium[] {
  const totals = new Map<string, number>();
  for (const p of policies) {
    if (!p.carrierId) continue;
    totals.set(p.carrierId, (totals.get(p.carrierId) || 0) + (p.annualPremium || 0));
  }
  return Array.from(totals.entries())
    .map(([carrierId, premium]) => ({
      carrierId,
      name: carrierNames[carrierId] || "Unknown",
      premium,
    }))
    .sort((a, b) => b.premium - a.premium)
    .slice(0, limit);
}

/** Best available reference date for "when was this policy written". */
function policyReferenceDate(p: Policy): string | undefined {
  return p.submitDate || p.effectiveDate || p.createdAt;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Premium written per month for the trailing `months` calendar months
 * (oldest first, current month last). `now` is injectable for testing.
 */
export function computeMonthlyPremium(
  policies: Policy[],
  months = 6,
  now: Date = new Date(),
): MonthlyPremium[] {
  // Build the ordered buckets, keyed by year-month.
  const buckets: MonthlyPremium[] = [];
  const index = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    index.set(key, buckets.length);
    buckets.push({
      month: d,
      label: MONTH_LABELS[d.getMonth()],
      premium: 0,
    });
  }

  for (const p of policies) {
    const ref = policyReferenceDate(p);
    if (!ref) continue;
    // Parse as a LOCAL date — a bare "2026-06-01" parsed via `new Date()` is
    // UTC midnight and slips into the prior month in negative-offset zones.
    const d = parseLocalDate(ref);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const idx = index.get(key);
    if (idx === undefined) continue;
    buckets[idx].premium += p.annualPremium || 0;
  }

  return buckets;
}

/** Month-over-month growth fraction for the final two trend buckets. */
export function monthlyGrowth(trend: MonthlyPremium[]): number | null {
  if (trend.length < 2) return null;
  const last = trend[trend.length - 1].premium;
  const prev = trend[trend.length - 2].premium;
  if (prev <= 0) return null;
  return (last - prev) / prev;
}

/** Total annualized premium across the whole dataset. */
export function totalPremium(policies: Policy[]): number {
  return policies.reduce((sum, p) => sum + (p.annualPremium || 0), 0);
}
