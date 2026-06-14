// src/features/kpi/components/dashboard/DemographicsPanel.tsx
// Section 5 — Caller Demographics. Age-band distribution (recharts bars: calls
// per band + a close-rate chip row) and a gender split donut. Uses recharts
// (proven in prod) — NOT nivo, which pulls @react-spring and caused a
// duplicate-React crash in the production bundle.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Users } from "lucide-react";
import { Board, EmptyState, T } from "@/components/board";
import { useKpiCallAnalytics } from "../../hooks";
import { SectionCap } from "./SectionCap";
import { LoadingRow, ErrorRow } from "./PerformanceBand";
import { rateColor } from "./chart-theme";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

const GENDER_COLORS: Record<string, string> = {
  male: T.blue,
  female: T.amber,
  other: T.green,
  unknown: "rgba(255,255,255,0.4)",
};

const axisTick = { fontSize: 12, fill: T.mut, fontFamily: T.mono };
const tipStyle = {
  background: "#252525",
  border: `1px solid ${T.line2}`,
  borderRadius: 8,
  fontFamily: T.mono,
  fontSize: 12,
};

export function DemographicsPanel({ range }: Props) {
  const { data, isLoading, isError, error } = useKpiCallAnalytics(range);

  const ageBands = data?.byAgeBand ?? [];
  const ageData = ageBands.map((b) => ({ band: b.label, calls: b.calls }));
  const genderData = (data?.byGender ?? []).map((g) => ({
    id: g.label,
    label: g.label,
    value: g.count,
    color: GENDER_COLORS[g.gender] ?? T.blue,
  }));
  const genderTotal = genderData.reduce((n, g) => n + g.value, 0);
  const isEmpty = ageBands.length === 0 && genderData.length === 0;

  return (
    <Board pad={22} style={{ height: "100%" }}>
      <SectionCap
        title="Caller Demographics"
        subtitle="Who is calling in — call mix by age band (with close rate) and gender."
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : isEmpty ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No demographic data yet"
          hint="Age and gender appear once recordings capture caller details."
          pad={28}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 190px",
            gap: 18,
            alignItems: "start",
          }}
        >
          {/* Age-band bars + close-rate chips */}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                font: `600 12.5px ${T.mono}`,
                color: T.mut,
                marginBottom: 4,
              }}
            >
              Calls by age band
            </div>
            <div style={{ height: 168 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ageData}
                  margin={{ top: 8, right: 6, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke={T.line}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="band"
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
                    cursor={{ fill: T.line, opacity: 0.4 }}
                  />
                  <Bar
                    dataKey="calls"
                    name="Calls"
                    fill={T.blue}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={46}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${ageBands.length}, 1fr)`,
                gap: 6,
                borderTop: `1px solid ${T.line}`,
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              {ageBands.map((b) => (
                <div
                  key={b.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <span
                    style={{
                      font: `700 14px ${T.disp}`,
                      color: b.calls === 0 ? T.mut2 : rateColor(b.closingRate),
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {b.calls === 0 ? "—" : `${b.closingRate.toFixed(0)}%`}
                  </span>
                  <span style={{ font: `500 11.5px ${T.mono}`, color: T.mut }}>
                    close
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gender donut + legend */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ font: `600 12.5px ${T.mono}`, color: T.mut }}>
              Gender
            </div>
            <div style={{ height: 120, width: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={36}
                    outerRadius={56}
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {genderData.map((g) => (
                      <Cell key={g.id} fill={g.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tipStyle}
                    itemStyle={{ color: T.cream }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                width: "100%",
              }}
            >
              {genderData.map((g) => {
                const pct =
                  genderTotal > 0
                    ? Math.round((g.value / genderTotal) * 100)
                    : 0;
                return (
                  <div
                    key={g.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      font: `500 12.5px ${T.mono}`,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        background: g.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: T.mut, flex: 1 }}>{g.label}</span>
                    <span
                      style={{
                        color: T.cream,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {g.value}
                    </span>
                    <span style={{ color: T.mut2 }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Board>
  );
}
