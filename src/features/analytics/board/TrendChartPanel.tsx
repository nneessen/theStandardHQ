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
import { useAnalyticsData } from "@/hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
// eslint-disable-next-line no-restricted-imports
import {
  getPolicyStatusSummary,
  getMonthlyTrendData,
} from "@/services/analytics/policyStatusService";

const GRADIENT_ID = "trendActiveGradient";

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
        background: "#161617",
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

const CustomLegend = () => (
  <div
    style={{
      display: "flex",
      gap: 16,
      justifyContent: "flex-end",
      marginTop: 6,
    }}
  >
    <span
      style={{
        font: `700 11px ${T.mono}`,
        color: T.mut,
        letterSpacing: "0.12em",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: T.green,
        }}
      />
      ACTIVE
    </span>
    <span
      style={{
        font: `700 11px ${T.mono}`,
        color: T.mut,
        letterSpacing: "0.12em",
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 12,
          height: 2,
          background: T.amber,
          borderRadius: 1,
        }}
      />
      LAPSED
    </span>
  </div>
);

export function TrendChartPanel() {
  const { dateRange } = useAnalyticsDateRange();
  const { raw, isLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const statusSummary = useMemo(
    () => (raw?.policies ? getPolicyStatusSummary(raw.policies) : null),
    [raw?.policies],
  );

  const monthlyTrend = useMemo(
    () => (raw?.policies ? getMonthlyTrendData(raw.policies) : []),
    [raw?.policies],
  );

  if (isLoading) {
    return (
      <Board
        pad={26}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            font: `500 13px ${T.data}`,
            color: T.mut2,
          }}
        >
          Loading...
        </div>
      </Board>
    );
  }

  const isEmpty =
    !raw?.policies?.length ||
    monthlyTrend.every((m) => m.active === 0 && m.lapsed === 0);

  const activeCount = statusSummary?.active?.count ?? 0;
  const lapsedCount = statusSummary?.lapsed?.count ?? 0;
  const cancelledCount = statusSummary?.cancelled?.count ?? 0;

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
          <Cap>Policy Status</Cap>
          <div
            style={{
              font: `600 18px ${T.data}`,
              color: T.ink,
              marginTop: 4,
            }}
          >
            12-Month Trend
          </div>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: "right" }}>
            <Num text={activeCount} size="lg" color={T.green} />
            <div
              style={{
                font: `500 12px ${T.data}`,
                color: T.mut,
                marginTop: 2,
              }}
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
          {/* Flap Tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <FlapTile label="Active" value={activeCount} tone="green" sm />
            <FlapTile label="Lapsed" value={lapsedCount} tone="amber" sm />
            <FlapTile label="Cancelled" value={cancelledCount} tone="red" sm />
          </div>

          {/* Chart */}
          <div style={{ flex: 1, minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart
                data={monthlyTrend}
                margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.green} stopOpacity={0.32} />
                    <stop
                      offset="100%"
                      stopColor={T.green}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke={T.line}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{
                    fontSize: 11,
                    fill: T.mut,
                    fontFamily: T.mono,
                  }}
                  axisLine={false}
                  tickLine={false}
                  interval={1}
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: T.mut,
                    fontFamily: T.mono,
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="active"
                  name="Active"
                  stroke={T.green}
                  strokeWidth={2}
                  fill={`url(#${GRADIENT_ID})`}
                  isAnimationActive
                  animationDuration={1100}
                />
                <Line
                  type="monotone"
                  dataKey="lapsed"
                  name="Lapsed"
                  stroke={T.amber}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive
                  animationDuration={1100}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <CustomLegend />
        </>
      )}
    </Board>
  );
}
