// src/features/admin/components/lead-vendors/SpeedPanel.tsx

import { useMemo } from "react";
import { Clock, Zap, TrendingUp, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import type {
  PackHeatMetrics,
  LeadRecentPolicy,
  LeadPackRow,
  VendorAdminOverview,
} from "@/types/lead-purchase.types";

interface SpeedPanelProps {
  packMetrics: PackHeatMetrics[];
  recentPolicies: LeadRecentPolicy[];
  allPacks: LeadPackRow[];
  vendors: VendorAdminOverview[];
}

const BUCKETS = [
  { label: "\u22647d", max: 7, color: "bg-success" },
  { label: "8-30d", max: 30, color: "bg-info" },
  { label: "31-60d", max: 60, color: "bg-warning" },
  { label: ">60d", max: Infinity, color: "bg-destructive" },
] as const;

const daysColor = (days: number) =>
  days <= 7
    ? "text-success"
    : days <= 30
      ? "text-info"
      : days <= 60
        ? "text-warning"
        : "text-destructive";

export function SpeedPanel({
  packMetrics,
  recentPolicies,
  allPacks,
  vendors,
}: SpeedPanelProps) {
  const metrics = useMemo(() => {
    // Collect valid daysToFirstSale values
    const daysValues: number[] = [];
    for (const pm of packMetrics) {
      if (pm.daysToFirstSale >= 0) {
        daysValues.push(pm.daysToFirstSale);
      }
    }

    // Mean
    const avgDays =
      daysValues.length > 0
        ? daysValues.reduce((s, d) => s + d, 0) / daysValues.length
        : null;

    // Median
    let medianDays: number | null = null;
    if (daysValues.length > 0) {
      const sorted = [...daysValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianDays =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
    }

    // Sales last 30d
    const salesLast30d = packMetrics.reduce((s, pm) => s + pm.salesLast30d, 0);

    // Fastest vendor by avg daysToFirstSale
    const vendorDays = new Map<string, number[]>();
    for (const pm of packMetrics) {
      if (pm.daysToFirstSale >= 0) {
        let arr = vendorDays.get(pm.vendorId);
        if (!arr) {
          arr = [];
          vendorDays.set(pm.vendorId, arr);
        }
        arr.push(pm.daysToFirstSale);
      }
    }

    let fastestVendor: { name: string; days: number } | null = null;
    const vendorMap = new Map(vendors.map((v) => [v.vendorId, v.vendorName]));
    for (const [vendorId, days] of vendorDays.entries()) {
      const avg = days.reduce((s, d) => s + d, 0) / days.length;
      if (!fastestVendor || avg < fastestVendor.days) {
        fastestVendor = {
          name: vendorMap.get(vendorId) ?? "Unknown",
          days: avg,
        };
      }
    }

    // Fastest agent: cross-ref policies with packs
    const packMap = new Map(allPacks.map((p) => [p.packId, p]));
    const agentDays = new Map<string, { name: string; days: number[] }>();
    for (const policy of recentPolicies) {
      if (!policy.submitDate) continue;
      const pack = packMap.get(policy.packId);
      if (!pack) continue;
      const submit = new Date(policy.submitDate).getTime();
      const purchase = new Date(pack.purchaseDate).getTime();
      const diff = Math.floor((submit - purchase) / (1000 * 60 * 60 * 24));
      if (diff < 0) continue;

      let entry = agentDays.get(policy.agentId);
      if (!entry) {
        entry = { name: policy.agentName, days: [] };
        agentDays.set(policy.agentId, entry);
      }
      entry.days.push(diff);
    }

    let fastestAgent: { name: string; days: number } | null = null;
    for (const entry of agentDays.values()) {
      const avg = entry.days.reduce((s, d) => s + d, 0) / entry.days.length;
      if (!fastestAgent || avg < fastestAgent.days) {
        fastestAgent = { name: entry.name, days: avg };
      }
    }

    // Distribution buckets
    const bucketCounts = [0, 0, 0, 0];
    for (const d of daysValues) {
      if (d <= 7) bucketCounts[0]++;
      else if (d <= 30) bucketCounts[1]++;
      else if (d <= 60) bucketCounts[2]++;
      else bucketCounts[3]++;
    }
    const totalWithSales = daysValues.length;

    return {
      avgDays,
      medianDays,
      salesLast30d,
      fastestVendor,
      fastestAgent,
      bucketCounts,
      totalWithSales,
    };
  }, [packMetrics, recentPolicies, allPacks, vendors]);

  const hasData = metrics.totalWithSales > 0;

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
        {/* Left column: Time to First Sale */}
        <div className="space-y-1">
          <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1">
            Time to First Sale
          </div>
          <MetricRow
            icon={Clock}
            label="Avg Days"
            value={
              metrics.avgDays !== null
                ? `${Math.round(metrics.avgDays)}d`
                : "\u2014"
            }
            iconColor="text-info"
            valueColor={
              metrics.avgDays !== null
                ? daysColor(metrics.avgDays)
                : "text-v2-ink-subtle"
            }
          />
          <MetricRow
            icon={Clock}
            label="Median Days"
            value={
              metrics.medianDays !== null
                ? `${Math.round(metrics.medianDays)}d`
                : "\u2014"
            }
            iconColor="text-info"
            valueColor={
              metrics.medianDays !== null
                ? daysColor(metrics.medianDays)
                : "text-v2-ink-subtle"
            }
          />
        </div>

        {/* Right column: Velocity */}
        <div className="space-y-1">
          <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1">
            Velocity
          </div>
          <MetricRow
            icon={Zap}
            label="Sales (30d)"
            value={formatNumber(metrics.salesLast30d)}
            iconColor="text-warning"
          />
          <MetricRow
            icon={TrendingUp}
            label="Fastest Vendor"
            value={
              metrics.fastestVendor ? metrics.fastestVendor.name : "\u2014"
            }
            subValue={
              metrics.fastestVendor
                ? `${Math.round(metrics.fastestVendor.days)}d`
                : undefined
            }
            iconColor="text-success"
            valueColor={
              metrics.fastestVendor
                ? daysColor(metrics.fastestVendor.days)
                : "text-v2-ink-subtle"
            }
          />
          <MetricRow
            icon={User}
            label="Fastest Agent"
            value={metrics.fastestAgent ? metrics.fastestAgent.name : "\u2014"}
            subValue={
              metrics.fastestAgent
                ? `${Math.round(metrics.fastestAgent.days)}d`
                : undefined
            }
            iconColor="text-info"
            valueColor={
              metrics.fastestAgent
                ? daysColor(metrics.fastestAgent.days)
                : "text-v2-ink-subtle"
            }
          />
        </div>
      </div>

      {/* Distribution bar */}
      {hasData && (
        <div className="mt-3 pt-2 border-t border-v2-ring/60">
          <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1.5">
            Distribution
          </div>
          <div className="flex h-[6px] rounded-full overflow-hidden bg-v2-ring">
            {BUCKETS.map((bucket, i) => {
              const pct =
                metrics.totalWithSales > 0
                  ? (metrics.bucketCounts[i] / metrics.totalWithSales) * 100
                  : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={bucket.label}
                  className={cn(bucket.color, "transition-all duration-300")}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {BUCKETS.map((bucket, i) => {
              const pct =
                metrics.totalWithSales > 0
                  ? (metrics.bucketCounts[i] / metrics.totalWithSales) * 100
                  : 0;
              return (
                <div key={bucket.label} className="flex items-center gap-1">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full flex-shrink-0",
                      bucket.color,
                    )}
                  />
                  <span className="text-[10px] text-v2-ink-muted">
                    {bucket.label}
                  </span>
                  <span className="text-[10px] font-semibold text-v2-ink-muted">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricRow({
  icon: Icon,
  label,
  value,
  subValue,
  iconColor,
  valueColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subValue?: string;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3 w-3", iconColor)} />
        <span className="text-[11px] text-v2-ink-muted">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "text-[12px] font-semibold",
            valueColor || "text-v2-ink",
          )}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-[10px] text-v2-ink-subtle">{subValue}</span>
        )}
      </div>
    </div>
  );
}
