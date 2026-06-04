import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Board, Cap, Num, EmptyState, T } from "@/components/board";
import { useAnalyticsData } from "@/hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { formatCompactCurrency } from "@/lib/format";

// Axis-less sparkline: smooth monotone line + glowing end-dot.
function Sparkline({
  data,
  color,
}: {
  data: Array<{ v: number }>;
  color: string;
}) {
  return (
    <div style={{ height: 36, width: "100%" }}>
      <ResponsiveContainer width="100%" height={36}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
        >
          <Tooltip
            contentStyle={{
              background: "#161617",
              border: `1px solid ${T.line2}`,
              borderRadius: 6,
              font: `700 11px ${T.mono}`,
              color: T.mut,
              padding: "4px 8px",
            }}
            itemStyle={{ color }}
            formatter={(v: number) => [v.toLocaleString(), ""]}
            labelFormatter={() => ""}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={(props: { cx: number; cy: number; index: number }) => {
              if (props.index !== data.length - 1)
                return <g key={props.index} />;
              return (
                <circle
                  key="end-dot"
                  cx={props.cx}
                  cy={props.cy}
                  r={3}
                  fill={color}
                  style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                />
              );
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function DeltaBadge({ pct, isNew = false }: { pct: number; isNew?: boolean }) {
  const isUp = isNew || pct > 0;
  const isDown = !isNew && pct < 0;
  const color = isUp ? T.green : isDown ? T.red : T.mut;
  const bg = isUp
    ? "rgba(95,208,138,0.12)"
    : isDown
      ? "rgba(255,106,93,0.12)"
      : "rgba(236,226,205,0.06)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: "1px 5px",
        borderRadius: 4,
        font: `700 10px ${T.mono}`,
        color,
        background: bg,
        letterSpacing: "0.04em",
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {isNew ? "NEW" : isUp ? "▲" : isDown ? "▼" : "—"}
      {!isNew && (isUp || isDown) ? `${Math.abs(Math.round(pct))}%` : ""}
    </span>
  );
}

export function TrendComparisonPanel() {
  const { dateRange } = useAnalyticsDateRange();

  const rangeLengthMs =
    dateRange.endDate.getTime() - dateRange.startDate.getTime();
  const prevStart = new Date(dateRange.startDate.getTime() - rangeLengthMs);
  const prevEnd = new Date(dateRange.startDate.getTime() - 1);

  const { raw: curRaw, isLoading: curLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  const { raw: prevRaw, isLoading: prevLoading } = useAnalyticsData({
    startDate: prevStart,
    endDate: prevEnd,
  });

  if (curLoading || prevLoading) {
    return (
      <Board
        pad={26}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div style={{ font: `500 13px ${T.data}`, color: T.mut2 }}>
          Loading...
        </div>
      </Board>
    );
  }

  const curPolicies = curRaw.policies.length;
  const prevPolicies = prevRaw.policies.length;

  const curAP = curRaw.policies.reduce((s, p) => s + (p.annualPremium ?? 0), 0);
  const prevAP = prevRaw.policies.reduce(
    (s, p) => s + (p.annualPremium ?? 0),
    0,
  );

  const curComm = curRaw.commissions.reduce((s, c) => s + (c.amount ?? 0), 0);
  const prevComm = prevRaw.commissions.reduce((s, c) => s + (c.amount ?? 0), 0);

  const curAvg = curPolicies > 0 ? curAP / curPolicies : 0;
  const prevAvg = prevPolicies > 0 ? prevAP / prevPolicies : 0;

  const curActive = curRaw.policies.filter(
    (p) => p.lifecycleStatus === "active",
  ).length;
  const prevActive = prevRaw.policies.filter(
    (p) => p.lifecycleStatus === "active",
  ).length;

  const curPipeline = curRaw.policies.filter(
    (p) => p.status === "pending",
  ).length;
  const prevPipeline = prevRaw.policies.filter(
    (p) => p.status === "pending",
  ).length;

  const isEmpty = curPolicies === 0 && prevPolicies === 0;

  const apChangePct = pctChange(curAP, prevAP);
  const apUp = apChangePct >= 0;

  type MetricFmt = "currency" | "number";
  type Metric = {
    label: string;
    cur: number;
    prev: number;
    fmt: MetricFmt;
    color: string;
  };

  const metrics: Metric[] = [
    {
      label: "Policies Written",
      cur: curPolicies,
      prev: prevPolicies,
      fmt: "number",
      color: T.blue,
    },
    {
      label: "AP Written",
      cur: curAP,
      prev: prevAP,
      fmt: "currency",
      color: T.green,
    },
    {
      label: "Commissions",
      cur: curComm,
      prev: prevComm,
      fmt: "currency",
      color: T.amber,
    },
    {
      label: "Avg Premium",
      cur: curAvg,
      prev: prevAvg,
      fmt: "currency",
      color: T.blue,
    },
    {
      label: "Active Policies",
      cur: curActive,
      prev: prevActive,
      fmt: "number",
      color: T.green,
    },
    {
      label: "Pipeline",
      cur: curPipeline,
      prev: prevPipeline,
      fmt: "number",
      color: T.amber,
    },
  ];

  function fmtValue(val: number, fmt: MetricFmt) {
    if (fmt === "currency") return formatCompactCurrency(val);
    return val.toLocaleString();
  }

  return (
    <Board
      pad={26}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <div>
          <Cap>Trend Comparison</Cap>
          <div
            style={{ font: `600 18px ${T.data}`, color: T.ink, marginTop: 4 }}
          >
            Period-over-Period
          </div>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                font: `700 22px ${T.disp}`,
                color: apUp ? T.green : T.red,
                letterSpacing: "-0.01em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {apUp ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              {apChangePct > 0 ? "+" : ""}
              {Math.round(apChangePct)}%
            </div>
            <div
              style={{
                font: `500 11px ${T.mono}`,
                color: T.mut2,
                marginTop: 2,
                letterSpacing: "0.1em",
              }}
            >
              AP CHANGE
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<Activity size={22} />}
          title="No comparison yet"
          hint="Period-over-period deltas appear once you have history."
          pad={40}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            flex: 1,
          }}
        >
          {metrics.map((m) => {
            const delta = pctChange(m.cur, m.prev);
            const sparkData = [{ v: m.prev }, { v: m.cur }];
            return (
              <div
                key={m.label}
                style={{
                  background: T.tile,
                  borderRadius: 8,
                  border: `1px solid ${T.line}`,
                  padding: "10px 12px 8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {/* Label + delta */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      font: `700 10px ${T.mono}`,
                      color: T.mut2,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {m.label}
                  </span>
                  <DeltaBadge pct={delta} isNew={m.prev === 0 && m.cur > 0} />
                </div>
                {/* Big value */}
                <Num text={fmtValue(m.cur, m.fmt)} size="sm" color={T.cream} />
                {/* Sparkline */}
                <Sparkline data={sparkData} color={m.color} />
              </div>
            );
          })}
        </div>
      )}
    </Board>
  );
}
