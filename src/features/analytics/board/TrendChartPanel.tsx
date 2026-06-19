import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";
import { Board, Cap, Num, FlapTile, EmptyState, T } from "@/components/board";
import { useChartColors } from "@/components/board/useChartColors";
import { useAnalyticsData } from "@/hooks";
// eslint-disable-next-line no-restricted-imports
import {
  getPolicyStatusSnapshot,
  getMonthlyTrendData,
} from "@/services/analytics/policyStatusService";

const CustomTooltip = ({
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
        background: "var(--panel)",
        border: `1px solid ${T.line2}`,
        borderRadius: 8,
        padding: "10px 14px",
        minWidth: 140,
      }}
    >
      <div
        style={{
          font: `700 11px ${T.mono}`,
          color: T.mut2,
          letterSpacing: "0.14em",
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
            gap: 16,
            font: `700 12px ${T.mono}`,
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

/** Legend dot + label below the chart. */
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        font: `600 14px ${T.data}`,
        color: T.mut,
      }}
    >
      <i
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
        }}
      />
      {label}
    </span>
  );
}

export function TrendChartPanel() {
  // Period-independent: the 12-month trend + current-status snapshot always
  // reflect the full book, not the page's period selector.
  const { raw, isLoading } = useAnalyticsData();
  const chart = useChartColors();

  const snapshot = useMemo(
    () => (raw?.policies ? getPolicyStatusSnapshot(raw.policies) : null),
    [raw?.policies],
  );

  // Active-vs-lapsed retention trend over the last 12 months (the handoff's
  // "Policy Status · 12-Month Trend" — a retention curve, not a new-business
  // histogram). `month` arrives as "MMM yyyy"; the axis shows just the abbrev.
  const trend = useMemo(
    () => (raw?.policies ? getMonthlyTrendData(raw.policies) : []),
    [raw?.policies],
  );

  if (isLoading) {
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

  const isEmpty = !raw?.policies?.length;

  const activeCount = snapshot?.active ?? 0;
  const lapsedCount = snapshot?.lapsed ?? 0;
  const cancelledCount = snapshot?.cancelled ?? 0;

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
          marginBottom: 16,
        }}
      >
        <div>
          <Cap>Policy Status · 12-Month Trend</Cap>
          <div
            style={{ font: `500 18px ${T.data}`, color: T.mut, marginTop: 4 }}
          >
            Active vs lapsed retention
          </div>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: "right" }}>
            <Num text={activeCount} size="lg" color={T.cream} />
            <div
              style={{ font: `500 12px ${T.data}`, color: T.mut, marginTop: 2 }}
            >
              active
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<Activity size={22} />}
          title="No policy data yet"
          hint="Status trend appears once policies are written."
          pad={40}
        />
      ) : (
        <>
          {/* Flap Tiles — Active / Lapsed / Cancelled */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <FlapTile label="Active" value={activeCount} tone="green" sm />
            <FlapTile label="Lapsed" value={lapsedCount} tone="amber" sm />
            <FlapTile label="Cancelled" value={cancelledCount} tone="red" sm />
          </div>

          {/* Chart — Active (green, gradient area) vs Lapsed (amber, dashed) */}
          <div style={{ flex: 1, minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart
                data={trend}
                margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="trendActiveFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={chart.green}
                      stopOpacity={0.32}
                    />
                    <stop
                      offset="100%"
                      stopColor={chart.green}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 10"
                  stroke={chart.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={(m: string) => String(m).split(" ")[0]}
                  tick={{ fontSize: 11, fill: chart.axis, fontFamily: T.mono }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: chart.axis, fontFamily: T.mono }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: chart.grid }}
                />
                <Area
                  type="monotone"
                  dataKey="active"
                  name="Active policies"
                  stroke={chart.green}
                  strokeWidth={2.4}
                  fill="url(#trendActiveFill)"
                  dot={false}
                  isAnimationActive
                  animationDuration={1100}
                />
                <Line
                  type="monotone"
                  dataKey="lapsed"
                  name="Lapsed"
                  stroke={chart.amber}
                  strokeWidth={2.4}
                  strokeDasharray="7 5"
                  dot={false}
                  isAnimationActive
                  animationDuration={1100}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 22,
              justifyContent: "center",
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            <LegendItem color={T.green} label="Active policies" />
            <LegendItem color={T.amber} label="Lapsed" />
          </div>
        </>
      )}
    </Board>
  );
}
