// src/features/analytics/board/inbound/CallDemographicsPanel.tsx
// Caller demographics: closing rate by age band (bars) + caller gender split.
import { T } from "@/components/board";
import { useKpiCallAnalytics } from "@/features/kpi";
import { CallBoard, BarRow, BarStack } from "./shared";
import { closingTone, useInboundCallRange } from "./utils";

export function CallDemographicsPanel() {
  const range = useInboundCallRange();
  const { data, isLoading } = useKpiCallAnalytics(range);
  const byAgeBand = data?.byAgeBand ?? [];
  const byGender = data?.byGender ?? [];
  const genderTotal = byGender.reduce((s, g) => s + g.count, 0);

  return (
    <CallBoard
      eyebrow="Demographics"
      title="Caller demographics"
      subtitle="Closing rate by age · gender split"
      isLoading={isLoading}
      isEmpty={byAgeBand.length === 0 && byGender.length === 0}
    >
      <BarStack>
        {byAgeBand.map((b) => (
          <BarRow
            key={b.band}
            label={b.label}
            valueText={`${b.closingRate.toFixed(0)}% · ${b.calls}`}
            pct={b.closingRate / 100}
            tone={closingTone(b.closingRate)}
          />
        ))}
      </BarStack>

      {byGender.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              font: `700 10px ${T.mono}`,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: T.mut2,
              marginBottom: 8,
            }}
          >
            Gender split
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {byGender.map((g) => {
              const pct = genderTotal > 0 ? (g.count / genderTotal) * 100 : 0;
              return (
                <div
                  key={g.gender}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "center",
                    padding: "8px 4px",
                    borderRadius: 8,
                    background: T.tile,
                  }}
                >
                  <div
                    style={{
                      font: `800 16px ${T.disp}`,
                      color: T.cream,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {pct.toFixed(0)}%
                  </div>
                  <div
                    style={{
                      font: `600 11px ${T.data}`,
                      color: T.mut,
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {g.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </CallBoard>
  );
}
