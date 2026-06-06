// src/features/kpi/components/KpiDashboardTab.tsx
// Dashboard tab: a Board of FlapTiles summarizing the agent's entered daily
// metrics over a selectable date range, plus the manual-entry panel.
//
// Tile-suppression contract: a tile renders ONLY when its backing value is
// non-null (a real 0 renders; null suppresses). When no rows exist in the
// range, every aggregate is null → an EmptyState replaces the board.

import React, { useMemo, useState } from "react";
import {
  Board,
  FlapTile,
  EmptyState,
  type FlapTileTone,
} from "@/components/board";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { formatDateForDB } from "@/lib/date";
import { useAgentKpiSummary } from "../hooks";
import { formatCallDuration } from "../lib/format-call-duration";
import { ManualKpiEntryPanel } from "./ManualKpiEntryPanel";
import type { DateRange } from "../types/kpi.types";

type RangePreset =
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "ytd";

const RANGE_OPTIONS: ReadonlyArray<{ value: RangePreset; label: string }> = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "ytd", label: "Year to date" },
];

function computeRange(preset: RangePreset): DateRange {
  const today = new Date();
  const to = formatDateForDB(today);
  const start = new Date(today);

  switch (preset) {
    case "last_7_days":
      start.setDate(start.getDate() - 6);
      break;
    case "last_30_days":
      start.setDate(start.getDate() - 29);
      break;
    case "last_90_days":
      start.setDate(start.getDate() - 89);
      break;
    case "this_month":
      start.setDate(1);
      break;
    case "ytd":
      start.setMonth(0, 1);
      break;
  }
  return { from: formatDateForDB(start), to };
}

interface Tile {
  label: string;
  value: string | null;
  tone?: FlapTileTone;
  tooltip?: { title: string; description: string; formula?: string };
}

export const KpiDashboardTab: React.FC = () => {
  const [preset, setPreset] = useState<RangePreset>("last_30_days");
  const range = useMemo(() => computeRange(preset), [preset]);
  const { summary, isLoading, isError, error } = useAgentKpiSummary(range);

  const tiles = useMemo<Tile[]>(() => {
    if (!summary) return [];
    const s = summary;
    const all: Tile[] = [
      {
        label: "Inbound Calls",
        value:
          s.totalInboundCalls != null
            ? formatNumber(s.totalInboundCalls)
            : null,
      },
      {
        label: "Answered",
        value: s.answeredCalls != null ? formatNumber(s.answeredCalls) : null,
      },
      {
        label: "Connect Rate",
        value: s.connectRate != null ? formatPercent(s.connectRate) : null,
        tone: "blue",
        tooltip: {
          title: "Connect Rate",
          description: "Share of inbound calls that were answered.",
          formula: "answered ÷ inbound calls",
        },
      },
      {
        label: "Clients Sold",
        value: s.clientsSold != null ? formatNumber(s.clientsSold) : null,
        tone: "green",
      },
      {
        label: "Policies Sold",
        value: s.policiesSold != null ? formatNumber(s.policiesSold) : null,
        tone: "green",
      },
      {
        label: "Closing Rate",
        value: s.closingRate != null ? formatPercent(s.closingRate) : null,
        tone: "green",
        tooltip: {
          title: "Closing Rate",
          description: "Clients sold per inbound call.",
          formula: "clients sold ÷ inbound calls",
        },
      },
      {
        label: "Policies / Client",
        value:
          s.policiesPerClient != null ? s.policiesPerClient.toFixed(2) : null,
        tooltip: {
          title: "Policies per Client",
          description: "Average number of policies written per client sold.",
          formula: "policies sold ÷ clients sold",
        },
      },
      {
        label: "Premium Written",
        value:
          s.premiumWritten != null ? formatCurrency(s.premiumWritten) : null,
        tone: "amber",
      },
      {
        label: "Cost / Acquisition",
        value:
          s.costPerAcquisition != null
            ? formatCurrency(s.costPerAcquisition)
            : null,
        tone: "amber",
        tooltip: {
          title: "Cost per Acquisition",
          description: "Total lead + marketing spend per client sold.",
          formula: "(lead spend + marketing spend) ÷ clients sold",
        },
      },
      {
        label: "Total Talk Time",
        value: formatCallDuration(s.totalTalkTimeSeconds),
      },
    ];
    return all.filter((t) => t.value != null);
  }, [summary]);

  return (
    <div className="space-y-3">
      {/* Range selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-muted-foreground">
          {range.from} → {range.to}
        </div>
        <Select
          value={preset}
          onValueChange={(v) => setPreset(v as RangePreset)}
        >
          <SelectTrigger className="h-7 w-[150px] text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-[11px]">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metrics board */}
      {isLoading ? (
        <div className="py-10 text-center text-[11px] text-muted-foreground">
          Loading metrics…
        </div>
      ) : isError ? (
        <div className="py-10 text-center text-[11px] text-destructive">
          {error instanceof Error ? error.message : "Failed to load metrics"}
        </div>
      ) : tiles.length === 0 ? (
        <Board>
          <EmptyState
            title="No metrics yet"
            hint="Enter a day's call numbers below to populate this dashboard."
          />
        </Board>
      ) : (
        <Board>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            {tiles.map((t) => (
              <FlapTile
                key={t.label}
                tone={t.tone}
                label={
                  t.tooltip ? (
                    <span className="inline-flex items-center">
                      {t.label}
                      <MetricTooltip
                        title={t.tooltip.title}
                        description={t.tooltip.description}
                        formula={t.tooltip.formula}
                      />
                    </span>
                  ) : (
                    t.label
                  )
                }
                value={t.value}
              />
            ))}
          </div>
        </Board>
      )}

      {/* Manual entry */}
      <ManualKpiEntryPanel />
    </div>
  );
};
