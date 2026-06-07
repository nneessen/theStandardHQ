// src/features/kpi/components/dashboard/RecordingsProvenance.tsx
// Divider strip that introduces the recordings-sourced sections and makes the
// dual-source model legible: Performance/Trend come from logged daily totals,
// while everything below is computed from this (usually smaller) set of analyzed
// call recordings. Surfaces the recordings universe so 835-daily-vs-158-recorded
// reads as a deliberate sample, not a bug.

import React from "react";
import { Board, Cap, T } from "@/components/board";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { useKpiCallAnalytics } from "../../hooks";
import { formatCallDuration } from "../../lib/format-call-duration";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

function Stat({
  value,
  label,
  tone = T.cream,
}: {
  value: string;
  label: string;
  tone?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          font: `800 19px ${T.disp}`,
          color: tone,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          font: `700 12px ${T.mono}`,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.mut2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function RecordingsProvenance({ range }: Props) {
  const { data } = useKpiCallAnalytics(range);
  const t = data?.totals;

  return (
    <Board pad={16}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <Cap>Analyzed Call Recordings</Cap>
          <div
            style={{ font: `500 12.5px ${T.data}`, color: T.mut, marginTop: 5 }}
          >
            The breakdowns below are computed from your analyzed recordings, not
            the full daily call log above.
          </div>
        </div>
        {t && t.calls > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 26,
              flexWrap: "wrap",
            }}
          >
            <Stat value={t.calls.toLocaleString()} label="Calls" />
            <Stat value={t.sold.toLocaleString()} label="Sold" />
            <Stat
              value={`${t.closingRate.toFixed(0)}%`}
              label="Close rate"
              tone={T.green}
            />
            <Stat
              value={formatCompactCurrency(t.premiumTotal)}
              label="Premium"
              tone={T.amber}
            />
            <Stat
              value={t.avgPremium != null ? formatCurrency(t.avgPremium) : "—"}
              label="Avg / sale"
              tone={T.amber}
            />
            <Stat
              value={formatCallDuration(t.avgDurationSec) ?? "—"}
              label="Avg length"
            />
          </div>
        ) : (
          <span style={{ font: `500 12.5px ${T.data}`, color: T.mut2 }}>
            No analyzed recordings in this period.
          </span>
        )}
      </div>
    </Board>
  );
}
