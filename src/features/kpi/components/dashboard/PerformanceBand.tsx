// src/features/kpi/components/dashboard/PerformanceBand.tsx
// Section 1 — headline economics. Sourced from the agent's logged DAILY metrics
// (the complete call volume + economics), except Avg Call Length which only the
// per-call recordings carry. Big FlapTiles, "big & clean".

import React from "react";
import { Board, FlapTile, EmptyState } from "@/components/board";
import { Phone } from "lucide-react";
import { MetricTooltip } from "@/components/ui/MetricTooltip";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { useAgentKpiSummary, useKpiCallAnalytics } from "../../hooks";
import { formatCallDuration } from "../../lib/format-call-duration";
import { SectionCap } from "./SectionCap";
import type { FlapTileTone } from "@/components/board";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

interface Tile {
  label: string;
  value: string;
  tone?: FlapTileTone;
  tooltip?: { title: string; description: string; formula: string };
}

export function PerformanceBand({ range }: Props) {
  const { summary, isLoading, isError, error } = useAgentKpiSummary(range);
  const { data: analytics } = useKpiCallAnalytics(range);

  const dash = (s: string | null) => s ?? "—";

  const tiles: Tile[] = [
    {
      label: "Inbound Calls",
      value: dash(
        summary?.totalInboundCalls != null
          ? formatNumber(summary.totalInboundCalls)
          : null,
      ),
    },
    {
      label: "Closing Rate",
      value: dash(
        summary?.closingRate != null
          ? formatPercent(summary.closingRate)
          : null,
      ),
      tone: "green",
      tooltip: {
        title: "Closing Rate",
        description:
          "Clients sold per inbound call, from your logged daily totals.",
        formula: "clients sold ÷ inbound calls",
      },
    },
    {
      label: "Policies Sold",
      value: dash(
        summary?.policiesSold != null
          ? formatNumber(summary.policiesSold)
          : null,
      ),
      tone: "green",
    },
    {
      label: "Premium Written",
      value: dash(
        summary?.premiumWritten != null
          ? formatCurrency(summary.premiumWritten)
          : null,
      ),
      tone: "amber",
    },
    {
      label: "Cost / Acquisition",
      value: dash(
        summary?.costPerAcquisition != null
          ? formatCurrency(summary.costPerAcquisition)
          : null,
      ),
      tone: "amber",
      tooltip: {
        title: "Cost per Acquisition",
        description: "Total lead + marketing spend per client sold.",
        formula: "(lead spend + marketing spend) ÷ clients sold",
      },
    },
    {
      label: "Avg Call Length",
      value: dash(formatCallDuration(analytics?.totals.avgDurationSec ?? null)),
    },
  ];

  const hasAny = summary != null && summary.rowCount > 0;

  return (
    <Board pad={22}>
      <SectionCap
        title="Performance"
        subtitle="Your logged daily call volume, sales, and economics for this period."
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : !hasAny ? (
        <EmptyState
          icon={<Phone size={22} />}
          title="No daily metrics logged yet"
          hint="Use “Log day” to enter a day's call numbers and this fills in."
          pad={32}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
          }}
        >
          {tiles.map((t) => (
            <FlapTile
              key={t.label}
              tone={t.tone}
              label={
                t.tooltip ? (
                  <span
                    style={{ display: "inline-flex", alignItems: "center" }}
                  >
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
      )}
    </Board>
  );
}

export function LoadingRow() {
  return (
    <div
      style={{
        padding: "28px 0",
        textAlign: "center",
        fontSize: 13,
        color: "rgba(255,255,255,0.45)",
      }}
    >
      Loading…
    </div>
  );
}

export function ErrorRow({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "28px 0",
        textAlign: "center",
        fontSize: 13,
        color: "#ff6a5d",
      }}
    >
      {message}
    </div>
  );
}
