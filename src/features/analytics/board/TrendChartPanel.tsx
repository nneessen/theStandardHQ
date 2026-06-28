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
import { useChartColors } from "@/components/board/useChartColors";
import { useAnalyticsData } from "@/hooks";
// eslint-disable-next-line no-restricted-imports
import { getMonthlyPoliciesWritten } from "@/services/analytics/policyStatusService";

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
  // Period-independent: the 12-month new-business trend always reflects the
  // trailing year regardless of the page's period selector.
  const { raw, isLoading } = useAnalyticsData();
  const chart = useChartColors();

  // Honest production histogram — policies written (submitted) per month. Unlike
  // the old "active vs lapsed" trend, this does NOT paint today's lifecycle
  // status backward onto every prior month, so it's a real month-over-month
  // signal (retention itself is covered by the persistency band above).
  const data = useMemo(
    () => (raw?.policies ? getMonthlyPoliciesWritten(raw.policies) : []),
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

  const total12 = data.reduce((sum, m) => sum + m.written, 0);
  const thisMonth = data.length ? data[data.length - 1].written : 0;
  const monthlyAvg = data.length ? Math.round(total12 / data.length) : 0;
  const bestMonth = data.reduce((max, m) => Math.max(max, m.written), 0);

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
          <Cap>New Business · 12-Month Trend</Cap>
          <div
            style={{ font: `500 18px ${T.data}`, color: T.mut, marginTop: 4 }}
          >
            Policies written per month
          </div>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: "right" }}>
            <Num text={total12} size="lg" color={T.cream} />
            <div
              style={{ font: `500 12px ${T.data}`, color: T.mut, marginTop: 2 }}
            >
              written · 12 mo
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<Activity size={22} />}
          title="No policy data yet"
          hint="The trend appears once policies are written."
          pad={40}
        />
      ) : (
        <>
          {/* Flap Tiles — This month / Monthly avg / Best month */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <FlapTile label="This Month" value={thisMonth} tone="green" sm />
            <FlapTile
              label="Monthly Avg"
              value={monthlyAvg}
              tone="default"
              sm
            />
            <FlapTile label="Best Month" value={bestMonth} tone="blue" sm />
          </div>

          {/* Chart — policies written per month (blue gradient bars) */}
          <div style={{ flex: 1, minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={data}
                margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="writtenFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={chart.blue}
                      stopOpacity={0.95}
                    />
                    <stop
                      offset="100%"
                      stopColor={chart.blue}
                      stopOpacity={0.45}
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
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: chart.axis, fontFamily: T.mono }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: chart.grid, fillOpacity: 0.25 }}
                />
                <Bar
                  dataKey="written"
                  name="Policies written"
                  fill="url(#writtenFill)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={42}
                  isAnimationActive
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Board>
  );
}
