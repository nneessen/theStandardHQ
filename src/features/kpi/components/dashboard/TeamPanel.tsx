// src/features/kpi/components/dashboard/TeamPanel.tsx
// Section 8 — Team leaderboard. One row per agent visible to the caller (RLS),
// ranked by closing rate. Renders even with a single agent.

import React from "react";
import { Users } from "lucide-react";
import { Board, EmptyState, T } from "@/components/board";
import { formatCurrency } from "@/lib/format";
import { useKpiCallAnalytics } from "../../hooks";
import { SectionCap } from "./SectionCap";
import { LoadingRow, ErrorRow } from "./PerformanceBand";
import { rateColor } from "./chart-theme";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

const TH: React.CSSProperties = {
  font: `700 12px ${T.mono}`,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: T.mut2,
  padding: "0 12px 10px",
  whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  font: `500 13px ${T.data}`,
  color: T.cream,
  padding: "11px 12px",
  borderTop: `1px solid ${T.line}`,
  verticalAlign: "middle",
};

export function TeamPanel({ range }: Props) {
  const { data, isLoading, isError, error } = useKpiCallAnalytics(range);
  const agents = data?.byAgent ?? [];

  return (
    <Board pad={22}>
      <SectionCap
        title="Team"
        subtitle="How each agent's analyzed calls compare — ranked by closing rate."
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No agent activity yet"
          hint="The leaderboard fills in once calls are recorded for your team."
          pad={28}
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: "left", width: 36 }}>#</th>
                <th style={{ ...TH, textAlign: "left" }}>Agent</th>
                <th style={{ ...TH, textAlign: "right" }}>Calls</th>
                <th style={{ ...TH, textAlign: "right" }}>Closing rate</th>
                <th style={{ ...TH, textAlign: "right" }}>Policies</th>
                <th style={{ ...TH, textAlign: "right" }}>Premium</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => {
                const color = rateColor(a.closingRate);
                const num: React.CSSProperties = {
                  ...TD,
                  textAlign: "right",
                  font: `600 13px ${T.mono}`,
                  fontVariantNumeric: "tabular-nums",
                };
                return (
                  <tr key={a.agentId}>
                    <td
                      style={{
                        ...TD,
                        color: T.mut2,
                        font: `700 13px ${T.mono}`,
                      }}
                    >
                      {i + 1}
                    </td>
                    <td style={{ ...TD, fontWeight: 600 }}>{a.name}</td>
                    <td style={num}>{a.calls}</td>
                    <td style={{ ...num, color }}>
                      <span style={{ font: `800 15px ${T.disp}` }}>
                        {a.closingRate.toFixed(0)}%
                      </span>
                    </td>
                    <td style={num}>{a.policies}</td>
                    <td style={{ ...num, color: T.amber }}>
                      {formatCurrency(a.premium)}
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
