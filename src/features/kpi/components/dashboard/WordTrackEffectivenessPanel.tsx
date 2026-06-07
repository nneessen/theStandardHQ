// src/features/kpi/components/dashboard/WordTrackEffectivenessPanel.tsx
// Section 7 — Word-Track Effectiveness (the AI centerpiece). Ranked table of
// scripted phrases by lift: closing rate when the phrase is used vs the overall
// baseline. Sorted by delta desc. EmptyState guides users to analyze calls.

import React from "react";
import { MessageSquareQuote } from "lucide-react";
import { Board, EmptyState, Pill, T } from "@/components/board";
import { useWordTrackEffectiveness } from "../../hooks";
import { SectionCap } from "./SectionCap";
import { LoadingRow, ErrorRow } from "./PerformanceBand";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

function titleCase(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const TH: React.CSSProperties = {
  font: `700 12px ${T.mono}`,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: T.mut2,
  padding: "0 12px 10px",
  textAlign: "left",
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  font: `500 13px ${T.data}`,
  color: T.cream,
  padding: "11px 12px",
  borderTop: `1px solid ${T.line}`,
  verticalAlign: "middle",
};

export function WordTrackEffectivenessPanel({ range }: Props) {
  const { data, isLoading, isError, error } = useWordTrackEffectiveness(range);

  const rows = data?.rows ?? [];
  const baseline = data?.baseline ?? 0;

  return (
    <Board pad={22}>
      <SectionCap
        title="Word-Track Effectiveness"
        subtitle="Which scripted phrases actually close deals — closing rate when used vs your baseline."
        right={
          rows.length > 0 ? (
            <Pill tone="blue">Baseline {baseline.toFixed(0)}%</Pill>
          ) : undefined
        }
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote size={22} />}
          title="No word-track detections yet"
          hint="Add word tracks and upload + analyze call recordings to see which phrases close."
          pad={30}
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Phrase</th>
                <th style={TH}>Category</th>
                <th style={{ ...TH, textAlign: "right" }}>Times used</th>
                <th style={{ ...TH, textAlign: "right" }}>
                  Close rate when used
                </th>
                <th style={{ ...TH, textAlign: "left" }}>Typical timing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const up = r.delta >= 0;
                const deltaColor =
                  Math.abs(r.delta) < 1 ? T.mut : up ? T.green : T.red;
                return (
                  <tr key={r.id}>
                    <td style={{ ...TD, fontWeight: 600 }}>{r.label}</td>
                    <td
                      style={{
                        ...TD,
                        color: T.mut,
                        font: `500 12.5px ${T.mono}`,
                      }}
                    >
                      {titleCase(r.category)}
                    </td>
                    <td
                      style={{
                        ...TD,
                        textAlign: "right",
                        font: `600 13px ${T.mono}`,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.timesUsed}
                    </td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <span
                        style={{
                          font: `800 15px ${T.disp}`,
                          color: T.cream,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {r.closingRateWhenUsed.toFixed(0)}%
                      </span>
                      <span
                        style={{
                          marginLeft: 8,
                          font: `700 12.5px ${T.mono}`,
                          color: deltaColor,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {up ? "+" : "−"}
                        {Math.abs(r.delta).toFixed(0)}
                      </span>
                    </td>
                    <td
                      style={{
                        ...TD,
                        color: T.mut,
                        font: `500 12.5px ${T.mono}`,
                      }}
                    >
                      {r.typicalTiming ? titleCase(r.typicalTiming) : "—"}
                      {r.avgPositionPct != null && (
                        <span style={{ color: T.mut2 }}>
                          {" "}
                          · {r.avgPositionPct.toFixed(0)}% in
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Board>
  );
}
