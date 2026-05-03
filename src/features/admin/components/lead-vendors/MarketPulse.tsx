// src/features/admin/components/lead-vendors/MarketPulse.tsx

import {
  Wallet,
  ShoppingCart,
  Target,
  DollarSign,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
  formatNumber,
} from "@/lib/format";

interface PortfolioMetrics {
  totalSpend: number;
  totalLeads: number;
  totalPolicies: number;
  totalCommission: number;
  totalPremium: number;
  convRate: number;
  roi: number;
  cpl: number;
}

interface MarketPulseProps {
  metrics: PortfolioMetrics;
  packCount: number;
}

const roiColor = (roi: number) =>
  roi > 0 ? "text-success" : roi < 0 ? "text-destructive" : "text-v2-ink-muted";

export function MarketPulse({ metrics, packCount }: MarketPulseProps) {
  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <BarChart3 className="h-3.5 w-3.5 text-info" />
        <span className="text-[11px] font-semibold text-v2-ink-muted uppercase tracking-wide">
          Market Pulse
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
        {/* Left column: Portfolio */}
        <div className="space-y-1">
          <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1">
            Portfolio
          </div>
          <MetricRow
            icon={Wallet}
            label="Spend"
            value={formatCompactCurrency(metrics.totalSpend)}
            iconColor="text-info"
          />
          <MetricRow
            icon={ShoppingCart}
            label="Leads"
            value={formatNumber(metrics.totalLeads)}
            subValue={`${packCount} packs`}
            iconColor="text-info"
          />
          <MetricRow
            icon={Target}
            label="Policies"
            value={formatNumber(metrics.totalPolicies)}
            subValue={formatPercent(metrics.convRate) + " conv"}
            iconColor="text-info"
          />
        </div>

        {/* Right column: Returns */}
        <div className="space-y-1">
          <div className="text-[9px] uppercase text-v2-ink-subtle font-semibold tracking-wider mb-1">
            Returns
          </div>
          <MetricRow
            icon={DollarSign}
            label="Commission"
            value={formatCompactCurrency(metrics.totalCommission)}
            iconColor="text-success"
          />
          <MetricRow
            icon={DollarSign}
            label="Premium"
            value={formatCompactCurrency(metrics.totalPremium)}
            iconColor="text-warning"
          />
          <MetricRow
            icon={TrendingUp}
            label="ROI"
            value={formatPercent(metrics.roi)}
            subValue={formatCurrency(metrics.cpl) + "/lead"}
            iconColor={roiColor(metrics.roi)}
            valueColor={roiColor(metrics.roi)}
          />
        </div>
      </div>
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
