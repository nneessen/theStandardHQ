// src/features/kpi/components/dashboard/TrendPanel.tsx
// Section 2 — daily trend. Inbound calls (bars) + policies sold (line) per day
// over the range, from the logged daily metrics. recharts ComposedChart.

import React, { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { LineChart as LineIcon } from "lucide-react";
import { Board, EmptyState, T } from "@/components/board";
import { useDailyMetrics } from "../../hooks";
import { SectionCap } from "./SectionCap";
import { LoadingRow, ErrorRow } from "./PerformanceBand";
import type { DateRange } from "../../types/kpi.types";

interface Props {
  range: DateRange;
}

interface Point {
  date: string; // "M/D"
  calls: number;
  policies: number;
}

const TooltipBox = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#161617",
        border: `1px solid ${T.line2}`,
        borderRadius: 8,
        padding: "10px 14px",
        minWidth: 150,
      }}
    >
      <div
        style={{
          font: `700 12px ${T.mono}`,
          color: T.mut2,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {payload.map((p) => (
        <div
          key={p.name}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            font: `700 12.5px ${T.mono}`,
            color: p.color,
            fontVariantNumeric: "tabular-nums",
            marginBottom: 2,
          }}
        >
          <span style={{ color: T.mut }}>{p.name}</span>
          <span>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function TrendPanel({ range }: Props) {
  const { data, isLoading, isError, error } = useDailyMetrics(range);

  const points = useMemo<Point[]>(() => {
    const rows = data ?? [];
    return rows
      .slice()
      .sort((a, b) => a.metric_date.localeCompare(b.metric_date))
      .map((r) => {
        const [, m, d] = r.metric_date.split("-");
        return {
          date: `${Number(m)}/${Number(d)}`,
          calls: r.total_inbound_calls ?? 0,
          policies: r.policies_sold ?? 0,
        };
      });
  }, [data]);

  const isEmpty = points.length === 0 || points.every((p) => p.calls === 0);

  return (
    <Board pad={22}>
      <SectionCap
        title="Trend"
        subtitle="Inbound call volume and policies sold, day by day across the period."
      />
      {isLoading ? (
        <LoadingRow />
      ) : isError ? (
        <ErrorRow
          message={error instanceof Error ? error.message : "Failed to load"}
        />
      ) : isEmpty ? (
        <EmptyState
          icon={<LineIcon size={22} />}
          title="No daily activity yet"
          hint="Log a few days of call numbers to see the trend build."
          pad={32}
        />
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart
              data={points}
              margin={{ top: 6, right: 8, left: -10, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                stroke={T.line}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: T.mut, fontFamily: T.mono }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: T.mut, fontFamily: T.mono }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<TooltipBox />}
                cursor={{ fill: T.line, opacity: 0.4 }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 12,
                  fontFamily: T.mono,
                  color: T.mut,
                  paddingTop: 6,
                }}
              />
              <Bar
                dataKey="calls"
                name="Inbound calls"
                fill={T.blue}
                radius={[3, 3, 0, 0]}
                isAnimationActive
                animationDuration={900}
              />
              <Line
                type="monotone"
                dataKey="policies"
                name="Policies sold"
                stroke={T.green}
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: T.green, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={900}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Board>
  );
}
