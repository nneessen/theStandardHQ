// src/features/analytics/board/inbound/WordTrackEffectivenessPanel.tsx
// Script adherence & lift — for each word track, how often it was used on
// inbound calls and how much it moves the closing rate vs the baseline.
import { T } from "@/components/board";
import { useWordTrackEffectiveness } from "@/features/kpi";
import { CallBoard } from "./shared";
import { useInboundCallRange } from "./utils";

const thStyle: React.CSSProperties = {
  font: `700 10px ${T.mono}`,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: T.mut2,
  paddingBottom: 8,
  borderBottom: `1px solid ${T.line}`,
};

function deltaColor(delta: number): string {
  if (delta > 0.5) return T.green;
  if (delta < -0.5) return T.red;
  return T.mut;
}

export function WordTrackEffectivenessPanel() {
  const range = useInboundCallRange();
  const { data, isLoading } = useWordTrackEffectiveness(range);
  const rows = data?.rows ?? [];
  const baseline = data?.baseline ?? 0;

  return (
    <CallBoard
      eyebrow="Coaching"
      title="Word-track effectiveness"
      subtitle={`Baseline close rate ${baseline.toFixed(1)}% · lift shown vs baseline`}
      isLoading={isLoading}
      isEmpty={rows.length === 0}
      emptyTitle="No word-track detections yet"
      emptyHint="Lift appears once analyzed calls contain detected phrases."
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
              <th style={{ ...thStyle, textAlign: "left" }}>Word track</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Used</th>
              <th style={{ ...thStyle, textAlign: "right" }}>
                Close when used
              </th>
              <th style={{ ...thStyle, textAlign: "right" }}>Lift</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                <td
                  style={{
                    font: `700 13px ${T.disp}`,
                    color: T.ink,
                    padding: "9px 8px 9px 0",
                    maxWidth: 280,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={r.label}
                >
                  {r.label}
                </td>
                <td
                  style={{
                    font: `500 12px ${T.mono}`,
                    color: T.mut,
                    textAlign: "right",
                    padding: "9px 0",
                  }}
                >
                  {r.timesUsed}
                </td>
                <td
                  style={{
                    font: `700 12px ${T.mono}`,
                    color: T.cream,
                    textAlign: "right",
                    padding: "9px 0",
                  }}
                >
                  {r.closingRateWhenUsed.toFixed(0)}%
                </td>
                <td
                  style={{
                    font: `700 12px ${T.mono}`,
                    color: deltaColor(r.delta),
                    textAlign: "right",
                    padding: "9px 0",
                  }}
                >
                  {r.delta >= 0 ? "+" : ""}
                  {r.delta.toFixed(1)} pts
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CallBoard>
  );
}
