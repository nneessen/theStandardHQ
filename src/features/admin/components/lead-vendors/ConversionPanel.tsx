// src/features/admin/components/lead-vendors/ConversionPanel.tsx

import { useMemo } from "react";
import {
  Filter,
  Target,
  DollarSign,
  TrendingUp,
  BarChart3,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/format";
import type { LeadPackRow } from "@/types/lead-purchase.types";
import type { FreshAgedAggregates } from "./LeadIntelligenceDashboard";

interface ConversionPanelProps {
  filteredPacks: LeadPackRow[];
  freshAgedAggregates: FreshAgedAggregates;
}

const conversionColor = (rate: number) =>
  rate > 10
    ? "text-emerald-600 dark:text-emerald-400"
    : rate > 5
      ? "text-blue-600 dark:text-blue-400"
      : rate > 1
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

const zeroSaleColor = (pct: number) =>
  pct < 10
    ? "text-emerald-600 dark:text-emerald-400"
    : pct < 30
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

const roiColor = (roi: number) =>
  roi > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : roi < 0
      ? "text-red-600 dark:text-red-400"
      : "text-v2-ink-muted";

export function ConversionPanel({
  filteredPacks,
  freshAgedAggregates,
}: ConversionPanelProps) {
  const metrics = useMemo(() => {
    const totalLeads = filteredPacks.reduce((s, p) => s + p.leadCount, 0);
    const totalPolicies = filteredPacks.reduce((s, p) => s + p.policiesSold, 0);
    const totalSpend = filteredPacks.reduce((s, p) => s + p.totalCost, 0);
    const totalPremium = filteredPacks.reduce((s, p) => s + p.totalPremium, 0);
    const totalCommission = filteredPacks.reduce(
      (s, p) => s + p.commissionEarned,
      0,
    );
    const conversionRate =
      totalLeads > 0 ? (totalPolicies / totalLeads) * 100 : 0;
    const zeroSalePacks = filteredPacks.filter(
      (p) => p.policiesSold === 0,
    ).length;
    const zeroSalePct =
      filteredPacks.length > 0
        ? (zeroSalePacks / filteredPacks.length) * 100
        : 0;
    const costPerConversion =
      totalPolicies > 0 ? totalSpend / totalPolicies : 0;
    const premiumPerLead = totalLeads > 0 ? totalPremium / totalLeads : 0;
    const avgPoliciesPerPack =
      filteredPacks.length > 0 ? totalPolicies / filteredPacks.length : 0;
    const overallRoi =
      totalSpend > 0 ? ((totalCommission - totalSpend) / totalSpend) * 100 : 0;

    return {
      totalLeads,
      totalPolicies,
      conversionRate,
      zeroSalePacks,
      zeroSalePct,
      costPerConversion,
      premiumPerLead,
      avgPoliciesPerPack,
      overallRoi,
    };
  }, [filteredPacks]);

  const { fresh, aged } = freshAgedAggregates;
  const freshWins = fresh.convRate > aged.convRate;

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
        {/* Left column: Funnel */}
        <div className="space-y-1">
          <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1">
            Funnel
          </div>
          <MetricRow
            icon={Package}
            label="Total Leads"
            value={formatNumber(metrics.totalLeads)}
            iconColor="text-indigo-500"
          />
          <MetricRow
            icon={Target}
            label="Policies Sold"
            value={formatNumber(metrics.totalPolicies)}
            iconColor="text-violet-500"
          />
          <MetricRow
            icon={Filter}
            label="Conversion Rate"
            value={formatPercent(metrics.conversionRate)}
            iconColor="text-blue-500"
            valueColor={conversionColor(metrics.conversionRate)}
          />
          <MetricRow
            icon={BarChart3}
            label="Zero-Sale Packs"
            value={`${metrics.zeroSalePacks} (${formatPercent(metrics.zeroSalePct, 0)})`}
            iconColor="text-v2-ink-subtle"
            valueColor={zeroSaleColor(metrics.zeroSalePct)}
          />
        </div>

        {/* Right column: Efficiency */}
        <div className="space-y-1">
          <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1">
            Efficiency
          </div>
          <MetricRow
            icon={DollarSign}
            label="Cost / Conversion"
            value={formatCurrency(metrics.costPerConversion)}
            iconColor="text-amber-500"
          />
          <MetricRow
            icon={DollarSign}
            label="Premium / Lead"
            value={formatCurrency(metrics.premiumPerLead)}
            iconColor="text-emerald-500"
          />
          <MetricRow
            icon={Target}
            label="Avg Policies/Pack"
            value={metrics.avgPoliciesPerPack.toFixed(1)}
            iconColor="text-violet-500"
          />
          <MetricRow
            icon={TrendingUp}
            label="Overall ROI"
            value={formatPercent(metrics.overallRoi)}
            iconColor={roiColor(metrics.overallRoi)}
            valueColor={roiColor(metrics.overallRoi)}
          />
        </div>
      </div>

      {/* Fresh vs Aged Conversion comparison */}
      {(fresh.count > 0 || aged.count > 0) && (
        <div className="mt-3 pt-2 border-t border-v2-ring/60">
          <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1.5">
            Fresh vs Aged Conversion
          </div>
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex-1 rounded px-2 py-1",
                freshWins
                  ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
                  : "bg-v2-canvas",
              )}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                  Fresh
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    freshWins
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-v2-ink-muted dark:text-v2-ink-subtle",
                  )}
                >
                  {formatPercent(fresh.convRate)} conv
                </span>
                <span className="text-[10px] text-v2-ink-subtle">
                  {formatPercent(fresh.roi)} ROI
                </span>
              </div>
            </div>
            <div
              className={cn(
                "flex-1 rounded px-2 py-1",
                !freshWins && fresh.count > 0 && aged.count > 0
                  ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                  : "bg-v2-canvas",
              )}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-medium text-v2-ink-muted dark:text-v2-ink-subtle">
                  Aged
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    !freshWins && fresh.count > 0 && aged.count > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-v2-ink-muted dark:text-v2-ink-subtle",
                  )}
                >
                  {formatPercent(aged.convRate)} conv
                </span>
                <span className="text-[10px] text-v2-ink-subtle">
                  {formatPercent(aged.roi)} ROI
                </span>
              </div>
            </div>
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
