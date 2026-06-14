import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import {
  Board,
  Cap,
  EmptyState,
  ComparisonCard,
  T,
  type BarTone,
  type ComparisonDir,
} from "@/components/board";
import { useAnalyticsData } from "@/hooks";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { formatCompactCurrency } from "@/lib/format";

function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
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
    accent: BarTone;
  };

  // Accent-by-metric per the handoff §5.8 table.
  const metrics: Metric[] = [
    {
      label: "Policies Written",
      cur: curPolicies,
      prev: prevPolicies,
      fmt: "number",
      accent: "blue",
    },
    {
      label: "AP Written",
      cur: curAP,
      prev: prevAP,
      fmt: "currency",
      accent: "green",
    },
    {
      label: "Commissions",
      cur: curComm,
      prev: prevComm,
      fmt: "currency",
      accent: "amber",
    },
    {
      label: "Avg Premium",
      cur: curAvg,
      prev: prevAvg,
      fmt: "currency",
      accent: "blue",
    },
    {
      label: "Active Policies",
      cur: curActive,
      prev: prevActive,
      fmt: "number",
      accent: "green",
    },
    {
      label: "Pipeline",
      cur: curPipeline,
      prev: prevPipeline,
      fmt: "number",
      accent: "amber",
    },
  ];

  function fmtValue(val: number, fmt: MetricFmt) {
    if (fmt === "currency") return formatCompactCurrency(val);
    return val.toLocaleString();
  }

  return (
    <Board pad={26} style={{ display: "flex", flexDirection: "column" }}>
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
          <Cap>Trend Comparison · Period-over-Period</Cap>
          <div
            style={{ font: `500 18px ${T.data}`, color: T.mut, marginTop: 4 }}
          >
            This period vs. the same point 30 days ago
          </div>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                font: `800 26px ${T.disp}`,
                color: apUp ? T.green : T.red,
                letterSpacing: "-0.01em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {apUp ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              {apChangePct > 0 ? "+" : ""}
              {Math.round(apChangePct)}%
            </div>
            <div
              style={{
                font: `500 12px ${T.mono}`,
                color: T.mut,
                marginTop: 6,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              AP change
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
            gap: 16,
          }}
        >
          {metrics.map((m) => {
            const delta = pctChange(m.cur, m.prev);
            const dir: ComparisonDir =
              m.prev === 0 && m.cur > 0 ? "new" : delta < 0 ? "down" : "up";
            return (
              <ComparisonCard
                key={m.label}
                label={m.label}
                accent={m.accent}
                priorNum={m.prev}
                nowNum={m.cur}
                priorFmt={fmtValue(m.prev, m.fmt)}
                nowFmt={fmtValue(m.cur, m.fmt)}
                delta={`${Math.abs(Math.round(delta))}%`}
                dir={dir}
              />
            );
          })}
        </div>
      )}
    </Board>
  );
}
