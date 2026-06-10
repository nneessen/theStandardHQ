// src/features/analytics/board/inbound/CallTimingPanel.tsx
// When inbound calls close best — closing rate by hour-of-day (bars) and a
// compact day-of-week strip. Hour/day are viewer-local (matches aggregation).
import { T } from "@/components/board";
import { useKpiCallAnalytics } from "@/features/kpi";
import { CallBoard, BarRow, BarStack } from "./shared";
import { closingTone, useInboundCallRange } from "./utils";

export function CallTimingPanel() {
  const range = useInboundCallRange();
  const { data, isLoading } = useKpiCallAnalytics(range);
  const byHour = data?.byHour ?? [];
  const byDay = data?.byDay ?? [];

  return (
    <CallBoard
      eyebrow="Timing"
      title="When calls close"
      subtitle="Closing rate by time"
      isLoading={isLoading}
      isEmpty={byHour.length === 0}
    >
      <BarStack>
        {byHour.map((h) => (
          <BarRow
            key={h.hour}
            label={h.label}
            valueText={`${h.closingRate.toFixed(0)}% · ${h.calls}`}
            pct={h.closingRate / 100}
            tone={closingTone(h.closingRate)}
          />
        ))}
      </BarStack>

      {/* Day-of-week strip */}
      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 6,
        }}
      >
        {byDay.map((d) => (
          <div
            key={d.dow}
            title={`${d.calls} calls · ${d.closingRate.toFixed(0)}% close`}
            style={{
              textAlign: "center",
              padding: "8px 2px",
              borderRadius: 8,
              background: T.tile,
              minWidth: 0,
            }}
          >
            <div
              style={{
                font: `700 10px ${T.mono}`,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.mut2,
              }}
            >
              {d.label}
            </div>
            <div
              style={{
                font: `800 14px ${T.disp}`,
                color: d.calls > 0 ? T.cream : T.mut2,
                marginTop: 3,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {d.calls > 0 ? `${d.closingRate.toFixed(0)}%` : "—"}
            </div>
          </div>
        ))}
      </div>
    </CallBoard>
  );
}
