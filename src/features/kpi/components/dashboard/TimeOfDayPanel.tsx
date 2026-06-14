// src/features/kpi/components/dashboard/TimeOfDayPanel.tsx
// Section 4 — Time of Day & Day of Week. Hand-built heatmap: one row per hour
// that has calls (volume bar + closing-rate color), a day-of-week strip, and a
// "best window" pill. Hours are NOT clamped to 9–5 (inbound peaks evenings).

import React from "react";
import { Clock } from "lucide-react";
import { Board, EmptyState, Pill, T } from "@/components/board";
import { useKpiCallAnalytics } from "../../hooks";
import { SectionCap } from "./SectionCap";
import { LoadingRow, ErrorRow } from "./PerformanceBand";
import { rateColor } from "./chart-theme";
import type { DateRange } from "../../types/kpi.types";
import type { HourStat, DayStat } from "../../lib/call-analytics";

interface Props {
  range: DateRange;
}

/** Best bucket by closing rate, ignoring tiny samples (< 3 calls). */
function bestBy<T extends { closingRate: number; calls: number }>(
  rows: T[],
): T | null {
  const eligible = rows.filter((r) => r.calls >= 3);
  if (eligible.length === 0) return null;
  return eligible.reduce((a, b) => (b.closingRate > a.closingRate ? b : a));
}

export function TimeOfDayPanel({ range }: Props) {
  const { data, isLoading, isError, error } = useKpiCallAnalytics(range);

  const hours: HourStat[] = data?.byHour ?? [];
  const days: DayStat[] = data?.byDay ?? [];
  const maxHourCalls = Math.max(...hours.map((h) => h.calls), 1);
  const bestHour = bestBy(hours);
  const bestDay = bestBy(days);

  const pills =
    bestHour || bestDay ? (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {bestHour && (
          <Pill tone="green" dot>
            {bestHour.label} · {bestHour.closingRate.toFixed(0)}%
          </Pill>
        )}
        {bestDay && (
          <Pill tone="green">
            {bestDay.label} · {bestDay.closingRate.toFixed(0)}%
          </Pill>
        )}
      </div>
    ) : null;

  return (
    <Board pad={22} style={{ height: "100%" }}>
      <SectionCap
        title="Time of Day & Day of Week"
        subtitle="When inbound calls actually close — your best windows to staff the phones."
        right={pills}
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : hours.length === 0 ? (
        <EmptyState
          icon={<Clock size={22} />}
          title="No call-time data yet"
          hint="Time-of-day patterns appear once recordings have a call time."
          pad={28}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Hourly heatmap rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {hours.map((h) => {
              const color = rateColor(h.closingRate);
              const width = `${Math.max((h.calls / maxHourCalls) * 100, 4)}%`;
              return (
                <div
                  key={h.hour}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span
                    style={{
                      width: 52,
                      flexShrink: 0,
                      textAlign: "right",
                      font: `600 12.5px ${T.mono}`,
                      color: T.mut,
                    }}
                  >
                    {h.label}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 16,
                      borderRadius: 4,
                      background: "rgba(0,0,0,0.4)",
                      overflow: "hidden",
                      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.55)",
                    }}
                  >
                    <div
                      style={{
                        width,
                        height: "100%",
                        borderRadius: 4,
                        background: color,
                        boxShadow: `0 0 8px ${color}`,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      width: 90,
                      flexShrink: 0,
                      textAlign: "right",
                      font: `700 12.5px ${T.mono}`,
                      color: T.cream,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    <span style={{ color }}>{h.closingRate.toFixed(0)}%</span>
                    <span style={{ color: T.mut, fontWeight: 500 }}>
                      {" "}
                      ({h.calls})
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Day-of-week strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
              borderTop: `1px solid ${T.line}`,
              paddingTop: 12,
            }}
          >
            {days.map((d) => {
              const color = rateColor(d.closingRate);
              return (
                <div
                  key={d.dow}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "8px 2px",
                    borderRadius: 7,
                    background:
                      d.calls === 0 ? "rgba(0,0,0,0.25)" : `${color}22`,
                  }}
                >
                  <span style={{ font: `600 12px ${T.mono}`, color: T.mut }}>
                    {d.label}
                  </span>
                  <span
                    style={{
                      font: `800 15px ${T.disp}`,
                      color: d.calls === 0 ? T.mut2 : color,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {d.calls === 0 ? "—" : `${d.closingRate.toFixed(0)}%`}
                  </span>
                  <span style={{ font: `500 12px ${T.mono}`, color: T.mut }}>
                    {d.calls}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Board>
  );
}
