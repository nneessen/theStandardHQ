// src/features/analytics/board/inbound/InboundCallsOverviewPanel.tsx
// Full-width inbound-call headline: volume / close rate / duration / premium
// KPI tiles, plus the outcome mix (sold / not sold / callback / …).
import { FlapTile, T } from "@/components/board";
import type { BarTone } from "@/components/board";
import { useKpiCallAnalytics, formatCallDuration } from "@/features/kpi";
import { formatCurrency } from "@/lib/format";
import { CallBoard, BarRow } from "./shared";
import { useInboundCallRange } from "./utils";

function outcomeTone(outcome: string): BarTone {
  if (outcome === "sold") return "green";
  if (outcome === "callback" || outcome === "no_sale_followup") return "amber";
  if (
    outcome === "not_sold" ||
    outcome === "not_qualified" ||
    outcome === "do_not_call" ||
    outcome === "wrong_number"
  ) {
    return "red";
  }
  return "blue";
}

export function InboundCallsOverviewPanel() {
  const range = useInboundCallRange();
  const { data, isLoading } = useKpiCallAnalytics(range);
  const totals = data?.totals;
  const byOutcome = data?.byOutcome ?? [];
  const isEmpty = !totals || totals.calls === 0;

  const avgDuration = formatCallDuration(totals?.avgDurationSec ?? null) ?? "—";

  return (
    <CallBoard
      title="Volume & conversion"
      subtitle="Recorded inbound calls in the selected period"
      isLoading={isLoading}
      isEmpty={isEmpty}
    >
      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <FlapTile label="Total Calls" value={totals?.calls ?? 0} sm />
        <FlapTile
          label="Close Rate"
          value={`${(totals?.closingRate ?? 0).toFixed(1)}%`}
          tone="green"
          sm
        />
        <FlapTile label="Avg Duration" value={avgDuration} tone="blue" sm />
        <FlapTile
          label="Total Premium"
          value={formatCurrency(totals?.premiumTotal ?? 0)}
          sm
        />
        <FlapTile
          label="Avg / Sale"
          value={
            totals?.avgPremium != null ? formatCurrency(totals.avgPremium) : "—"
          }
          tone="amber"
          sm
        />
      </div>

      {/* Outcome mix */}
      <div
        style={{
          font: `700 11px ${T.mono}`,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: T.mut2,
          marginBottom: 10,
        }}
      >
        Outcome mix
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {byOutcome.map((o) => (
          <BarRow
            key={o.outcome}
            label={o.label}
            valueText={`${o.count} · ${o.pct.toFixed(0)}%`}
            pct={o.pct / 100}
            tone={outcomeTone(o.outcome)}
          />
        ))}
      </div>
    </CallBoard>
  );
}
