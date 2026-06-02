// src/features/admin/components/lead-vendors/MarketPulse.tsx
// "The Board" — portfolio pulse as a row of big FlapTiles.

import {
  formatCompactCurrency,
  formatPercent,
  formatNumber,
} from "@/lib/format";
import { Board, Cap, FlapTile } from "@/components/board";

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

export function MarketPulse({ metrics, packCount }: MarketPulseProps) {
  const roiTone =
    metrics.roi > 0 ? "green" : metrics.roi < 0 ? "red" : "default";

  return (
    <Board pad={20}>
      <Cap style={{ marginBottom: 14 }}>Market Pulse</Cap>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
          gap: 10,
        }}
      >
        <FlapTile
          label="Spend"
          value={formatCompactCurrency(metrics.totalSpend)}
          tone="blue"
        />
        <FlapTile label="Leads" value={formatNumber(metrics.totalLeads)} />
        <FlapTile label="Packs" value={formatNumber(packCount)} />
        <FlapTile
          label="Policies"
          value={formatNumber(metrics.totalPolicies)}
        />
        <FlapTile label="Conv Rate" value={formatPercent(metrics.convRate)} />
        <FlapTile
          label="Commission"
          value={formatCompactCurrency(metrics.totalCommission)}
          tone="green"
        />
        <FlapTile
          label="Premium"
          value={formatCompactCurrency(metrics.totalPremium)}
          tone="amber"
        />
        <FlapTile
          label="ROI"
          value={formatPercent(metrics.roi)}
          tone={roiTone}
        />
      </div>
    </Board>
  );
}
