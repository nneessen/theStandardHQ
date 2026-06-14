// src/features/analytics/board/inbound/CallAgentLeaderboardPanel.tsx
// Per-agent inbound-call leaderboard — calls, sold, closing rate, premium.
// Ranked by closing rate (byAgent is pre-sorted); top 10 shown.
import { T } from "@/components/board";
import { useKpiCallAnalytics } from "@/features/kpi";
import { formatCurrency } from "@/lib/format";
import { CallBoard } from "./shared";
import { closingTone, useInboundCallRange } from "./utils";

const thStyle: React.CSSProperties = {
  font: `700 12.5px ${T.mono}`,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: T.mut,
  paddingBottom: 8,
  borderBottom: `1px solid ${T.line}`,
};

const TONE_COLOR: Record<string, string> = {
  green: T.green,
  amber: T.amber,
  red: T.red,
  blue: T.blue,
};

export function CallAgentLeaderboardPanel() {
  const range = useInboundCallRange();
  const { data, isLoading } = useKpiCallAnalytics(range);
  const rows = (data?.byAgent ?? []).slice(0, 10);

  return (
    <CallBoard
      eyebrow="Leaderboard"
      title="Agent leaderboard"
      subtitle="Inbound performance by agent"
      isLoading={isLoading}
      isEmpty={rows.length === 0}
    >
      <div style={{ flex: 1, overflowX: "auto", minWidth: 0 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: "left", width: 28 }}>#</th>
              <th style={{ ...thStyle, textAlign: "left" }}>Agent</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Calls</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Sold</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Close</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Premium</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, idx) => (
              <tr
                key={a.agentId}
                style={{ borderBottom: `1px solid ${T.line}` }}
              >
                <td
                  style={{
                    font: `800 13px ${T.disp}`,
                    color: T.mut,
                    padding: "9px 0",
                  }}
                >
                  {idx + 1}
                </td>
                <td
                  style={{
                    font: `700 13px ${T.disp}`,
                    color: T.ink,
                    padding: "9px 8px 9px 0",
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.name}
                </td>
                <td
                  style={{
                    font: `500 12px ${T.mono}`,
                    color: T.mut,
                    textAlign: "right",
                    padding: "9px 0",
                  }}
                >
                  {a.calls}
                </td>
                <td
                  style={{
                    font: `500 12px ${T.mono}`,
                    color: T.mut,
                    textAlign: "right",
                    padding: "9px 0",
                  }}
                >
                  {a.sold}
                </td>
                <td
                  style={{
                    font: `700 12px ${T.mono}`,
                    color: TONE_COLOR[closingTone(a.closingRate)],
                    textAlign: "right",
                    padding: "9px 0",
                  }}
                >
                  {a.closingRate.toFixed(0)}%
                </td>
                <td
                  style={{
                    font: `600 12px ${T.mono}`,
                    color: T.cream,
                    textAlign: "right",
                    padding: "9px 0 9px 8px",
                  }}
                >
                  {formatCurrency(a.premium)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CallBoard>
  );
}
