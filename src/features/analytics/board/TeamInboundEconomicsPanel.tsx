// src/features/analytics/board/TeamInboundEconomicsPanel.tsx
// Team-scoped inbound economics — the team-tab counterpart to
// InboundEconomicsPanel. Aggregates me + my full downline:
//   • call volume   → team's logged daily totals (kpi_daily_call_metrics,
//                     upline-readable via RLS)
//   • sales/premium → the SAME team leaderboard the adjacent Agent Performance
//                     table renders (so the two panels never disagree)
//   • commission    → the team analytics RPC (the only team commission source;
//                     the leaderboard doesn't carry commission) — needed for ROI
// ROI is commission-based: (commission − call spend) ÷ call spend. The metric
// math is the shared helper used by the individual panel.

import { useMemo } from "react";
import { PhoneIncoming } from "lucide-react";
import { format } from "date-fns";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useTeamAnalyticsData } from "@/hooks/analytics";
import { useTeamDailyMetrics } from "@/features/kpi";
import { useAgentLeaderboard } from "@/hooks/leaderboard";
import { useMyDownlines } from "@/hooks/hierarchy";
import { useCurrentUserProfile } from "@/hooks/admin";
import type { LeaderboardFilters } from "@/types/leaderboard.types";
import { isCollectibleCommissionStatus } from "@/types/commission.types";
import { COST_PER_INBOUND_CALL } from "@/constants/financial";
import { formatCurrency } from "@/lib/format";
import { Board, Cap, FlapTile, Num, EmptyState, T } from "@/components/board";
import { computeInboundEconomics } from "./inboundEconomics";

export function TeamInboundEconomicsPanel() {
  const { dateRange } = useAnalyticsDateRange();

  // Team = me + my entire downline subtree (same scoping as AgentTablePanel).
  const { data: currentUser, isLoading: userLoading } = useCurrentUserProfile();
  const { data: downlines = [], isLoading: downlinesLoading } =
    useMyDownlines();

  const teamIds = useMemo(
    () => (currentUser ? [currentUser.id, ...downlines.map((d) => d.id)] : []),
    [currentUser, downlines],
  );

  // Call volume from the team's logged daily totals.
  const { summary: teamSummary, isLoading: callsLoading } = useTeamDailyMetrics(
    teamIds,
    {
      from: format(dateRange.startDate, "yyyy-MM-dd"),
      to: format(dateRange.endDate, "yyyy-MM-dd"),
    },
  );

  // Sales + premium from the SAME leaderboard query the Agent Performance table
  // uses (identical filters → TanStack dedupes, numbers always reconcile).
  const leaderboardFilters: LeaderboardFilters = {
    timePeriod: "custom",
    startDate: format(dateRange.startDate, "yyyy-MM-dd"),
    endDate: format(dateRange.endDate, "yyyy-MM-dd"),
    scope: "all",
  };
  const { data: leaderboard, isLoading: leaderboardLoading } =
    useAgentLeaderboard({ filters: leaderboardFilters, staleTime: 60_000 });

  // Commission from the team analytics RPC (the only team commission source).
  // Pass the already-resolved team ids so the hook doesn't re-fetch the downline.
  const { rawData, isLoading: analyticsLoading } = useTeamAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    teamUserIds: teamIds,
  });

  const isLoading =
    userLoading ||
    downlinesLoading ||
    callsLoading ||
    leaderboardLoading ||
    analyticsLoading;

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
          Team Inbound Economics
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

  // Calls drive cost. Sales (policy count) + premium (AP) come from the team
  // leaderboard, scoped to this user's team — identical to what the Agent
  // Performance table totals, so the two panels agree.
  const calls = teamSummary?.totalInboundCalls ?? 0;
  const teamIdSet = new Set(teamIds);
  const teamEntries = (leaderboard?.entries ?? []).filter((e) =>
    teamIdSet.has(e.agentId),
  );
  const policies = teamEntries.reduce((s, e) => s + e.policyCount, 0);
  const premium = teamEntries.reduce((s, e) => s + e.apTotal, 0);
  // Commission basis matches the individual panel: collectible statuses
  // (payment_status = the commissions.status column) summed on commission_amount
  // (= the commissions.amount advance), via the team RPC's aliased fields.
  const commission = (rawData?.commissions ?? [])
    .filter((c) => isCollectibleCommissionStatus(c.payment_status ?? ""))
    .reduce((s, c) => s + (c.commission_amount ?? 0), 0);

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
          <Cap>Team Inbound Economics</Cap>
          <div
            style={{ font: `500 18px ${T.data}`, color: T.mut, marginTop: 4 }}
          >
            You + downline · ${COST_PER_INBOUND_CALL.toFixed(2)}/call
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
          title="No team inbound activity this period"
          hint="Logged team calls and written policies appear here as cost, CPA & ROI."
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
              No team calls logged this period — log them on the Inbound tab to
              see cost, CPA & ROI.
            </div>
          )}
        </div>
      )}
    </Board>
  );
}
