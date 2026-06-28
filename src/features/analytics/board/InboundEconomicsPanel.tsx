// src/features/analytics/board/InboundEconomicsPanel.tsx
// Inbound economics — the inbound-model replacement for the old outbound
// "Conversion Funnel". Every inbound call costs a flat COST_PER_INBOUND_CALL, so
// spend = calls × that, and the headline is commission-based ROI = (commission
// earned − spend) ÷ spend. Calls come from the agent's logged daily totals;
// sales/premium/commission come from the real policy + commission records the
// app already tracks (no invented rate).

import { PhoneIncoming } from "lucide-react";
import { format } from "date-fns";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useAnalyticsData } from "@/hooks";
import { useAgentKpiSummary } from "@/features/kpi";
import { isCollectibleCommissionStatus } from "@/types/commission.types";
import { COST_PER_INBOUND_CALL } from "@/constants/financial";
import { formatCurrency } from "@/lib/format";
import { Board, Cap, FlapTile, Num, EmptyState, T } from "@/components/board";
import { computeInboundEconomics } from "./inboundEconomics";

export function InboundEconomicsPanel() {
  const { dateRange } = useAnalyticsDateRange();

  const { raw, isLoading: analyticsLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const { summary, isLoading: kpiLoading } = useAgentKpiSummary({
    from: format(dateRange.startDate, "yyyy-MM-dd"),
    to: format(dateRange.endDate, "yyyy-MM-dd"),
  });

  const isLoading = analyticsLoading || kpiLoading;

  if (isLoading) {
    return (
      <Board
        pad={26}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            font: `500 12px ${T.mono}`,
            color: T.mut,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Inbound Economics
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `500 13px ${T.data}`,
            color: T.mut2,
          }}
        >
          Loading…
        </div>
      </Board>
    );
  }

  // Calls drive cost (every inbound call is answered, so total calls is the cost
  // driver). Sales / premium / commission come from the real records.
  const calls = summary?.totalInboundCalls ?? 0;
  const policies = raw.policies.length;
  const premium = raw.policies.reduce((s, p) => s + (p.annualPremium || 0), 0);
  const commission = raw.commissions
    .filter((c) => isCollectibleCommissionStatus(c.status))
    .reduce((s, c) => s + (c.amount ?? 0), 0);

  // Cost / close-rate / CPA / net / ROI derive from {calls, policies, premium,
  // commission} via the shared helper (same math as the team panel).
  const { spend, closeRate, cpa, avgPremium, netProfit, roi, isEmpty } =
    computeInboundEconomics({ calls, policies, premium, commission });

  const fmtPct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
  const fmtMoney = (v: number | null) => (v == null ? "—" : formatCurrency(v));

  return (
    <Board
      pad={26}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header — ROI hero */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <div>
          <Cap>Inbound Economics</Cap>
          <div
            style={{ font: `500 18px ${T.data}`, color: T.mut, marginTop: 4 }}
          >
            Calls in → commission out · ${COST_PER_INBOUND_CALL.toFixed(2)}/call
          </div>
        </div>
        {!isEmpty && (
          <div style={{ textAlign: "right" }}>
            <Num
              text={roi == null ? "—" : `${Math.round(roi)}%`}
              size="lg"
              color={roi == null ? T.mut2 : roi >= 0 ? T.green : T.red}
            />
            <div
              style={{ font: `500 12px ${T.mono}`, color: T.mut, marginTop: 2 }}
            >
              ROI
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<PhoneIncoming size={22} />}
          title="No inbound activity this period"
          hint="Log inbound calls and write policies to see cost, CPA & ROI."
          pad={40}
          style={{ flex: 1 }}
        />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <FlapTile label="Calls" value={String(calls)} tone="default" sm />
            <FlapTile
              label="Close Rate"
              value={fmtPct(closeRate)}
              tone="blue"
              sm
            />
            <FlapTile
              label="Sales"
              value={String(policies)}
              tone="default"
              sm
            />
            <FlapTile
              label="Premium"
              value={fmtMoney(premium)}
              tone="default"
              sm
            />
            <FlapTile
              label="Commission"
              value={fmtMoney(commission)}
              tone="green"
              sm
            />
            <FlapTile
              label="Call Spend"
              value={fmtMoney(spend)}
              tone="amber"
              sm
            />
            <FlapTile label="CPA" value={fmtMoney(cpa)} tone="default" sm />
            <FlapTile
              label="Net Profit"
              value={fmtMoney(netProfit)}
              tone={
                netProfit == null ? "default" : netProfit >= 0 ? "green" : "red"
              }
              sm
            />
          </div>

          {avgPremium != null && (
            <div
              style={{
                marginTop: 14,
                textAlign: "center",
                font: `600 14px ${T.data}`,
                color: T.mut,
              }}
            >
              Avg premium / sale ·{" "}
              <b style={{ color: T.cream, fontWeight: 700 }}>
                {formatCurrency(avgPremium)}
              </b>
            </div>
          )}

          {calls === 0 && (
            <div
              style={{
                marginTop: 10,
                textAlign: "center",
                font: `500 12px ${T.data}`,
                color: T.amber,
              }}
            >
              No calls logged this period — log them on the Inbound tab to see
              cost, CPA & ROI.
            </div>
          )}
        </div>
      )}
    </Board>
  );
}
