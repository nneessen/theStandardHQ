// src/features/hierarchy/components/TeamKpiStrip.tsx
//
// Horizontal team-KPI strip — the 8 headline team metrics laid out as a single
// responsive row (2 → 4 → 8 columns) instead of the old fixed 320px vertical
// rail. Replaces the metric-list half of the deleted TeamMetricsCard.
//
// All values are real (HierarchyStats). Team AP / IP / Policies follow the
// page's timeframe selector (hence the period suffix); Override MTD is a fixed
// calendar-month figure. "QTD Override" from the old rail was fake
// (qtdOverride = mtdOverride) and is replaced here by the real Avg Premium/Agent.

import { AlertCircle } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { FlapTile } from "@/components/board";
import type { HierarchyStats } from "@/types/hierarchy.types";
import type { TimePeriod } from "@/utils/dateRange";

// Short period suffix for selector-driven labels (lifted from the old rail).
function getPeriodSuffix(period: TimePeriod): string {
  switch (period) {
    case "daily":
      return "(D)";
    case "weekly":
      return "(W)";
    case "MTD":
      return "(MTD)";
    case "monthly":
      return "(M)";
    case "yearly":
      return "(Y)";
    default:
      return "(M)";
  }
}

interface TeamKpiStripProps {
  stats: HierarchyStats | null | undefined;
  timePeriod?: TimePeriod;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function TeamKpiStrip({
  stats,
  timePeriod = "monthly",
  isLoading,
  isError,
  onRetry,
}: TeamKpiStripProps) {
  const suffix = getPeriodSuffix(timePeriod);

  if (isError) {
    return (
      <div className="bg-v2-card rounded-lg border border-v2-ring">
        <div className="flex items-center justify-center gap-2 text-[12px] text-destructive py-4">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to load team metrics.</span>
          {onRetry && (
            <button
              onClick={() => onRetry()}
              className="underline hover:text-destructive"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px] rounded-lg border border-v2-ring bg-v2-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  const teamAP = stats?.team_ap_total ?? 0;
  const teamIP = stats?.team_ip_total ?? 0;
  const policies = stats?.team_policies_count ?? 0;
  const pendingAP = stats?.team_pending_ap_total ?? 0;
  const overrideMTD = stats?.total_override_income_mtd ?? 0;
  const avgPremiumPerAgent = stats?.avg_premium_per_agent ?? 0;
  const retention = stats?.retention_rate ?? 0;
  const recruitment = stats?.recruitment_rate ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
      <FlapTile
        sm
        label={`Team AP ${suffix}`}
        value={formatCurrency(teamAP)}
        tone="blue"
      />
      <FlapTile
        sm
        label={`Team IP ${suffix}`}
        value={formatCurrency(teamIP)}
        tone="blue"
      />
      <FlapTile sm label={`Policies ${suffix}`} value={String(policies)} />
      <FlapTile
        sm
        label="Pending AP"
        value={formatCurrency(pendingAP)}
        tone="amber"
      />
      <FlapTile
        sm
        label="Override MTD"
        value={formatCurrency(overrideMTD)}
        tone="green"
      />
      <FlapTile
        sm
        label="Avg Premium / Agent"
        value={formatCurrency(avgPremiumPerAgent)}
      />
      <FlapTile
        sm
        label="Retention"
        value={formatPercent(retention)}
        tone={retention > 90 ? "green" : retention > 80 ? "amber" : "red"}
      />
      <FlapTile
        sm
        label="Recruitment"
        value={formatPercent(recruitment)}
        tone={recruitment > 20 ? "green" : recruitment > 10 ? "amber" : "red"}
      />
    </div>
  );
}
