// src/features/admin/components/lead-vendors/FreshVsAgedPanel.tsx

import { cn } from "@/lib/utils";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
} from "@/lib/format";
import type { FreshAgedAggregates } from "./LeadIntelligenceDashboard";

interface FreshVsAgedPanelProps {
  aggregates: FreshAgedAggregates;
}

interface ComparisonRow {
  label: string;
  freshValue: number;
  agedValue: number;
  format: (v: number) => string;
  /** If true, lower is better (flips the "winner" highlight) */
  invertWinner?: boolean;
}

export function FreshVsAgedPanel({ aggregates }: FreshVsAgedPanelProps) {
  const { fresh, aged } = aggregates;

  const rows: ComparisonRow[] = [
    {
      label: "Spend",
      freshValue: fresh.spend,
      agedValue: aged.spend,
      format: formatCompactCurrency,
    },
    {
      label: "Conv%",
      freshValue: fresh.convRate,
      agedValue: aged.convRate,
      format: (v) => formatPercent(v),
    },
    {
      label: "ROI%",
      freshValue: fresh.roi,
      agedValue: aged.roi,
      format: (v) => formatPercent(v),
    },
    {
      label: "CPL",
      freshValue: fresh.cpl,
      agedValue: aged.cpl,
      format: (v) => formatCurrency(v),
      invertWinner: true,
    },
  ];

  const hasData = fresh.count > 0 || aged.count > 0;

  return (
    <div className="bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-v2-ink-muted uppercase tracking-wide">
          Fresh vs Aged
        </span>
        <div className="flex items-center gap-2 text-[9px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-info" />
            <span className="text-v2-ink-muted">Fresh ({fresh.count})</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-warning" />
            <span className="text-v2-ink-muted">Aged ({aged.count})</span>
          </span>
        </div>
      </div>

      {!hasData ? (
        <div className="text-[11px] text-v2-ink-subtle text-center py-3">
          No data
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <ComparisonBar key={row.label} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComparisonBar({ row }: { row: ComparisonRow }) {
  const total = Math.abs(row.freshValue) + Math.abs(row.agedValue);
  const freshPct = total > 0 ? (Math.abs(row.freshValue) / total) * 100 : 50;
  const agedPct = 100 - freshPct;

  const freshBetter = row.invertWinner
    ? row.freshValue < row.agedValue
    : row.freshValue > row.agedValue;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-v2-ink-muted w-[36px] text-right flex-shrink-0">
        {row.label}
      </span>
      <span
        className={cn(
          "text-[10px] font-medium w-[52px] text-right flex-shrink-0",
          freshBetter ? "text-info" : "text-v2-ink-muted",
        )}
      >
        {row.format(row.freshValue)}
      </span>
      <div className="flex-1 flex h-[6px] rounded-full overflow-hidden bg-v2-ring">
        <div
          className="bg-info transition-all duration-300"
          style={{ width: `${freshPct}%` }}
        />
        <div
          className="bg-warning transition-all duration-300"
          style={{ width: `${agedPct}%` }}
        />
      </div>
      <span
        className={cn(
          "text-[10px] font-medium w-[52px] flex-shrink-0",
          !freshBetter && row.freshValue !== row.agedValue
            ? "text-warning"
            : "text-v2-ink-muted",
        )}
      >
        {row.format(row.agedValue)}
      </span>
    </div>
  );
}
