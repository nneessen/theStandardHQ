// src/features/close-kpi/components/widgets/CrossReferenceWidget.tsx
// Smart View × Status cross-reference.
// Expandable smart view rows with inline status distribution bars.
// Handles 35+ statuses and many smart views without truncation.

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Grid3X3 } from "lucide-react";
import type { CrossReferenceResult } from "../../types/close-kpi.types";

interface CrossReferenceWidgetProps {
  data: CrossReferenceResult;
}

// Muted color palette for status bars — cycles through these for variety
const BAR_COLORS = [
  "bg-zinc-500",
  "bg-zinc-400",
  "bg-zinc-600",
  "bg-zinc-350",
  "bg-zinc-700",
  "bg-zinc-300",
  "bg-zinc-500/80",
  "bg-zinc-400/80",
];

export const CrossReferenceWidget: React.FC<CrossReferenceWidgetProps> = ({
  data,
}) => {
  const { rows, statusLabels, totals, grandTotal } = data;
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Pre-compute sorted status list for each smart view
  const smartViewData = useMemo(() => {
    return rows.map((sv) => {
      const statuses = statusLabels
        .map((s) => ({
          id: s.id,
          label: s.label,
          count: sv.cells[s.id] ?? 0,
        }))
        .filter((s) => s.count > 0)
        .sort((a, b) => b.count - a.count);

      return { ...sv, statuses };
    });
  }, [rows, statusLabels]);

  // Global max for consistent bar widths across smart views
  const globalMaxStatusCount = useMemo(() => {
    let max = 1;
    for (const sv of smartViewData) {
      for (const s of sv.statuses) {
        if (s.count > max) max = s.count;
      }
    }
    return max;
  }, [smartViewData]);

  if (rows.length === 0 || statusLabels.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1">
        <Grid3X3 className="h-5 w-5 text-muted-foreground/40" />
        <p className="text-[10px] text-muted-foreground">
          No smart view data available. Configure smart views in Close CRM.
        </p>
      </div>
    );
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Grid3X3 className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Smart View × Status
        </span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {grandTotal.toLocaleString()} leads · {rows.length} views
        </span>
      </div>

      {/* Smart view rows */}
      <div className="flex flex-col gap-1">
        {smartViewData.map((sv) => {
          const isExpanded = expandedIds.has(sv.smartViewId);
          const topStatuses = sv.statuses.slice(0, 4);
          const pct =
            grandTotal > 0 ? Math.round((sv.total / grandTotal) * 100) : 0;

          return (
            <div
              key={sv.smartViewId}
              className="rounded-md border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden"
            >
              {/* Smart view header row — always visible */}
              <button
                onClick={() => toggleExpanded(sv.smartViewId)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}

                {/* Smart view name — full width, no truncation */}
                <span className="text-[11px] font-medium text-foreground min-w-0 flex-1 truncate">
                  {sv.smartViewName}
                </span>

                {/* Inline stacked bar preview */}
                <div className="flex h-2.5 w-24 shrink-0 rounded-sm overflow-hidden bg-muted/20">
                  {topStatuses.map((s, idx) => {
                    const barWidth =
                      sv.total > 0
                        ? Math.max((s.count / sv.total) * 100, 2)
                        : 0;
                    return (
                      <div
                        key={s.id}
                        className={`h-full ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                        style={{
                          width: `${barWidth}%`,
                          opacity: 1 - idx * 0.15,
                        }}
                        title={`${s.label}: ${s.count}`}
                      />
                    );
                  })}
                </div>

                {/* Count + percentage */}
                <span className="font-mono text-[11px] font-bold text-foreground shrink-0 w-10 text-right">
                  {sv.total.toLocaleString()}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground shrink-0 w-7 text-right">
                  {pct}%
                </span>
              </button>

              {/* Expanded: full status breakdown */}
              {isExpanded && (
                <div className="border-t border-zinc-200/40 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/30 px-2.5 py-1.5">
                  {sv.statuses.length === 0 ? (
                    <p className="text-[9px] text-muted-foreground py-1">
                      No leads in this smart view
                    </p>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {sv.statuses.map((s) => {
                        const barWidth = Math.max(
                          (s.count / globalMaxStatusCount) * 100,
                          2,
                        );
                        const statusPct =
                          sv.total > 0
                            ? Math.round((s.count / sv.total) * 100)
                            : 0;
                        return (
                          <div key={s.id} className="flex items-center gap-1.5">
                            {/* Status name — generous width */}
                            <span
                              className="text-[10px] text-foreground w-[140px] shrink-0 truncate"
                              title={s.label}
                            >
                              {s.label}
                            </span>
                            {/* Bar */}
                            <div className="flex-1 h-2 rounded-sm bg-muted/15 overflow-hidden">
                              <div
                                className="h-full rounded-sm bg-zinc-500 dark:bg-zinc-400"
                                style={{
                                  width: `${barWidth}%`,
                                  opacity: 0.7,
                                }}
                              />
                            </div>
                            {/* Count */}
                            <span className="font-mono text-[10px] font-semibold text-foreground w-8 text-right shrink-0">
                              {s.count.toLocaleString()}
                            </span>
                            {/* Pct */}
                            <span className="font-mono text-[9px] text-muted-foreground w-7 text-right shrink-0">
                              {statusPct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status totals summary — collapsed by default */}
      <StatusTotalsSummary
        statusLabels={statusLabels}
        totals={totals}
        grandTotal={grandTotal}
      />
    </div>
  );
};

// ─── Collapsible status totals ────────────────────────────────────

const StatusTotalsSummary: React.FC<{
  statusLabels: { id: string; label: string }[];
  totals: Record<string, number>;
  grandTotal: number;
}> = ({ statusLabels, totals, grandTotal }) => {
  const [expanded, setExpanded] = useState(false);

  const sortedStatuses = useMemo(() => {
    return statusLabels
      .map((s) => ({ ...s, count: totals[s.id] ?? 0 }))
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [statusLabels, totals]);

  const maxCount = sortedStatuses[0]?.count ?? 1;

  if (sortedStatuses.length === 0) return null;

  return (
    <div className="border-t border-zinc-200/40 dark:border-zinc-800/40 pt-1.5">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-2.5 w-2.5" />
        ) : (
          <ChevronRight className="h-2.5 w-2.5" />
        )}
        All Statuses ({sortedStatuses.length})
      </button>

      {expanded && (
        <div className="flex flex-col gap-0.5 mt-1">
          {sortedStatuses.map((s) => {
            const barWidth = Math.max((s.count / maxCount) * 100, 2);
            const pct =
              grandTotal > 0 ? Math.round((s.count / grandTotal) * 100) : 0;
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <span
                  className="text-[10px] text-foreground w-[140px] shrink-0 truncate"
                  title={s.label}
                >
                  {s.label}
                </span>
                <div className="flex-1 h-2 rounded-sm bg-muted/15 overflow-hidden">
                  <div
                    className="h-full rounded-sm bg-zinc-400 dark:bg-zinc-500"
                    style={{ width: `${barWidth}%`, opacity: 0.6 }}
                  />
                </div>
                <span className="font-mono text-[10px] font-semibold text-foreground w-8 text-right shrink-0">
                  {s.count.toLocaleString()}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground w-7 text-right shrink-0">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
