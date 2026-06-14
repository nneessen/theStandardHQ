import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Board, Cap, Num, FlapTile, EmptyState, T } from "@/components/board";
import { useAnalyticsData, useConstants, useCalculatedTargets } from "@/hooks";
import { useHistoricalAverages } from "../../../hooks/targets/useHistoricalAverages";
import { resolveGoalAvgAP } from "@/lib/goal";

const GRADIENT_ID = "growthCommissionGradient";

/** Per-point confidence colour: idx 0-3 = green, 4-7 = amber, 8-11 = red */
function confidenceColor(idx: number): string {
  if (idx <= 3) return T.green;
  if (idx <= 7) return T.amber;
  return T.red;
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div
      style={{
        background: "#161617",
        border: `1px solid ${T.line2}`,
        borderRadius: 8,
        padding: "10px 14px",
        minWidth: 160,
      }}
    >
      <div
        style={{
          font: `700 11px ${T.mono}`,
          color: T.mut,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: `700 12px ${T.mono}`,
          color: T.blue,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(val)}
      </div>
    </div>
  );
};

/** Recharts custom dot — hollow ring: fill = panel bg, stroke = confidence color */
const ConfidenceDot = (props: { cx?: number; cy?: number; index?: number }) => {
  const { cx, cy, index = 0 } = props;
  if (cx == null || cy == null) return null;
  const color = confidenceColor(index);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#161617"
      stroke={color}
      strokeWidth={2.4}
      style={{ filter: `drop-shadow(0 0 4px ${color})` }}
    />
  );
};

const CustomLegend = ({ goalLabel }: { goalLabel: string }) => (
  <div
    style={{
      display: "flex",
      gap: 14,
      justifyContent: "flex-end",
      marginTop: 6,
      flexWrap: "wrap",
    }}
  >
    {(
      [
        { color: T.green, label: "HIGH" },
        { color: T.amber, label: "MEDIUM" },
        { color: T.red, label: "LOW" },
      ] as { color: string; label: string }[]
    ).map(({ color, label }) => (
      <span
        key={label}
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
            background: color,
            boxShadow: `0 0 5px ${color}`,
          }}
        />
        {label}
      </span>
    ))}
    {/* Goal reference line legend entry */}
    <span
      style={{
        font: `700 11px ${T.mono}`,
        color: T.blue,
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
          borderTop: `2px dashed ${T.blue}`,
          opacity: 0.7,
        }}
      />
      {goalLabel}
    </span>
  </div>
);

function formatYAxis(value: number): string {
  if (value === 0) return "$0";
  return `$${(value / 1000).toFixed(0)}k`;
}

export function GrowthChartPanel() {
  // Period-independent: growth forecast + renewal projection are inherently
  // 12-month / forward views computed from the full book.
  const { forecast, isLoading: analyticsLoading } = useAnalyticsData();
  const { data: constants, isLoading: constantsLoading } = useConstants();
  const { calculated: calculatedTargets, isLoading: targetsLoading } =
    useCalculatedTargets();
  const { averages: historicalAverages, isLoading: averagesLoading } =
    useHistoricalAverages();

  const isLoading =
    analyticsLoading || constantsLoading || targetsLoading || averagesLoading;

  const growth = useMemo(() => forecast?.growth ?? [], [forecast?.growth]);
  const renewals = useMemo(
    () => forecast?.renewals ?? [],
    [forecast?.renewals],
  );

  const next3Renewals = useMemo(
    () =>
      renewals.slice(0, 3).reduce((s, r) => s + (r.expectedRenewals ?? 0), 0),
    [renewals],
  );

  const next3Revenue = useMemo(
    () =>
      renewals.slice(0, 3).reduce((s, r) => s + (r.expectedRevenue ?? 0), 0),
    [renewals],
  );

  // Monthly AP goal — same formula as AnalyticsHero / DashboardHome.
  const avgAP = resolveGoalAvgAP(constants?.avgAP, historicalAverages ?? {});
  const policyTarget =
    calculatedTargets && calculatedTargets.realisticMonthlyAppsToWrite > 0
      ? calculatedTargets.realisticMonthlyAppsToWrite
      : 0;
  const monthlyGoal = avgAP > 0 && policyTarget > 0 ? avgAP * policyTarget : 0;

  // Format goal for legend label, e.g. "$34K goal"
  const goalLabelK =
    monthlyGoal > 0 ? `$${Math.round(monthlyGoal / 1000)}K goal` : "$34K goal";

  // Projected growth: (lastPoint - firstPoint) / firstPoint, capped to avoid
  // compounding artifacts.  Falls back to the compounded monthly rate when the
  // series has fewer than 2 points.
  const firstProjected = growth[0]?.projectedRevenue ?? 0;
  const lastProjected = growth[growth.length - 1]?.projectedRevenue ?? 0;
  const projectedGrowthPct =
    firstProjected > 0 && lastProjected > 0
      ? ((lastProjected - firstProjected) / firstProjected) * 100
      : (Math.pow(1 + (growth[0]?.growthRate ?? 0) / 100, 12) - 1) * 100;
  const growthUp = projectedGrowthPct >= 0;

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

  const isEmpty = growth.length === 0;

  const revenueFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(next3Revenue);

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
          <Cap>Predictive Analytics</Cap>
          <div
            style={{
              font: `600 18px ${T.data}`,
              color: T.ink,
              marginTop: 4,
            }}
          >
            Growth forecast &amp; renewals
          </div>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                justifyContent: "flex-end",
              }}
            >
              {growthUp ? (
                <TrendingUp
                  size={16}
                  color={T.green}
                  style={{ flexShrink: 0 }}
                />
              ) : (
                <TrendingDown
                  size={16}
                  color={T.red}
                  style={{ flexShrink: 0 }}
                />
              )}
              <Num
                text={`${growthUp ? "+" : ""}${projectedGrowthPct.toFixed(1)}%`}
                size="lg"
                color={growthUp ? T.green : T.red}
              />
            </div>
            <div
              style={{
                font: `500 12px ${T.data}`,
                color: T.mut,
                marginTop: 2,
              }}
            >
              projected growth
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          title="No forecast yet"
          hint="Projections appear once you have policy history."
          pad={40}
        />
      ) : (
        <>
          {/* Flap Tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <FlapTile
              label="Next 3 Mo · Renewals"
              value={next3Renewals}
              tone="default"
              sm
            />
            <FlapTile
              label="Est. Renewal Revenue"
              value={revenueFormatted}
              tone="green"
              sm
            />
          </div>

          {/* Chart */}
          <div style={{ flex: 1, minHeight: 250 }}>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart
                data={growth}
                margin={{ top: 4, right: 4, left: -4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.blue} stopOpacity={0.32} />
                    <stop offset="100%" stopColor={T.blue} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 10"
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
                  tickFormatter={formatYAxis}
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
                  dataKey="projectedRevenue"
                  name="Projected AP"
                  stroke={T.blue}
                  strokeWidth={2}
                  fill={`url(#${GRADIENT_ID})`}
                  dot={<ConfidenceDot />}
                  activeDot={{ r: 5, fill: T.blue }}
                  isAnimationActive
                  animationDuration={1100}
                />
                {monthlyGoal > 0 && (
                  <ReferenceLine
                    y={monthlyGoal}
                    stroke={T.blue}
                    strokeDasharray="5 5"
                    opacity={0.7}
                    strokeWidth={1.5}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <CustomLegend goalLabel={goalLabelK} />

          {/* Footnote */}
          <div
            style={{
              marginTop: 12,
              font: `500 13px ${T.data}`,
              color: T.mut,
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: T.mut }}>Note:</strong> Renewal revenue is
            an <strong style={{ color: T.mut }}>estimate</strong> based on 25%
            of first-year commission rates. Actual renewal rates vary by carrier
            and product.
          </div>
        </>
      )}
    </Board>
  );
}
