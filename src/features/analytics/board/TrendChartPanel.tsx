import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Activity } from "lucide-react";
import { Board, Cap, Num, FlapTile, EmptyState, T } from "@/components/board";
import { useAnalyticsData } from "@/hooks";
// eslint-disable-next-line no-restricted-imports
import {
  getPolicyStatusSnapshot,
  getMonthlyPoliciesWritten,
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

export function TrendChartPanel() {
  // Period-independent: the 12-month trend + current-status snapshot always
  // reflect the full book, not the page's period selector.
  const { raw, isLoading } = useAnalyticsData();

  const snapshot = useMemo(
    () => (raw?.policies ? getPolicyStatusSnapshot(raw.policies) : null),
    [raw?.policies],
  );

  const monthlyWritten = useMemo(
    () => (raw?.policies ? getMonthlyPoliciesWritten(raw.policies) : []),
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
    !raw?.policies?.length || monthlyWritten.every((m) => m.written === 0);

  const activeCount = snapshot?.active ?? 0;
  const lapsedCount = snapshot?.lapsed ?? 0;
  const cancelledCount = snapshot?.cancelled ?? 0;
  const pendingCount = snapshot?.pending ?? 0;

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
            Written · Last 12 Months
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
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <FlapTile label="Active" value={activeCount} tone="green" sm />
            <FlapTile label="Lapsed" value={lapsedCount} tone="amber" sm />
            <FlapTile label="Cancelled" value={cancelledCount} tone="red" sm />
            <FlapTile label="Pending" value={pendingCount} tone="blue" sm />
          </div>

          {/* Chart — policies written per month (production histogram) */}
          <div style={{ flex: 1, minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={monthlyWritten}
                margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
              >
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
                  allowDecimals={false}
                  tick={{
                    fontSize: 11,
                    fill: T.mut,
                    fontFamily: T.mono,
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: T.line, opacity: 0.4 }}
                />
                <Bar
                  dataKey="written"
                  name="Written"
                  fill={T.green}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive
                  animationDuration={1100}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Board>
  );
}
