// src/features/kpi/components/dashboard/LengthDistributionPanel.tsx
// Section 6 — Call Length Distribution. recharts histogram of call counts per
// length bucket + a closing-rate chip per bucket (does longer talk-time close?).
// Uses recharts (prod-proven), not nivo.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Hourglass } from "lucide-react";
import { Board, EmptyState, T } from "@/components/board";
import { useChartColors } from "@/components/board/useChartColors";
import { useKpiCallAnalytics } from "../../hooks";
import { SectionCap } from "./SectionCap";
import { LoadingRow, ErrorRow } from "./PerformanceBand";
import { rateColor } from "./chart-theme";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

// tipStyle: recharts default HTML tooltip (CSS context) — var() flips it.
const tipStyle = {
  background: "var(--panel)",
  border: `1px solid ${T.line2}`,
  borderRadius: 8,
  fontFamily: T.mono,
  fontSize: 12,
};

export function LengthDistributionPanel({ range }: Props) {
  const { data, isLoading, isError, error } = useKpiCallAnalytics(range);
  const chart = useChartColors();
  const axisTick = { fontSize: 12, fill: chart.axis, fontFamily: T.mono };

  const buckets = data?.byLengthBucket ?? [];
  const chartData = buckets.map((b) => ({ bucket: b.label, count: b.count }));
  const hasAny = buckets.some((b) => b.count > 0);

  return (
    <Board pad={22} style={{ height: "100%" }}>
      <SectionCap
        title="Call Length Distribution"
        subtitle="How long calls run — and whether longer conversations actually close."
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : !hasAny ? (
        <EmptyState
          icon={<Hourglass size={22} />}
          title="No call-length data yet"
          hint="Duration buckets appear once recordings capture call length."
          pad={28}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke={chart.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="bucket"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  contentStyle={tipStyle}
                  itemStyle={{ color: T.cream }}
                  labelStyle={{ color: T.mut2 }}
                  cursor={{ fill: chart.grid, opacity: 0.4 }}
                />
                <Bar
                  dataKey="count"
                  name="Calls"
                  fill={chart.blue}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={64}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Closing rate per bucket */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${buckets.length}, 1fr)`,
              gap: 8,
              borderTop: `1px solid ${T.line}`,
              paddingTop: 12,
            }}
          >
            {buckets.map((b) => {
              const color = rateColor(b.closingRate);
              return (
                <div
                  key={b.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ font: `600 12px ${T.mono}`, color: T.mut }}>
                    {b.label}
                  </span>
                  <span
                    style={{
                      font: `800 17px ${T.disp}`,
                      color: b.count === 0 ? T.mut2 : color,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {b.count === 0 ? "—" : `${b.closingRate.toFixed(0)}%`}
                  </span>
                  <span style={{ font: `500 12px ${T.mono}`, color: T.mut }}>
                    close rate
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
