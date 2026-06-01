// src/features/analytics/board/FunnelPanel.tsx
import { Filter } from "lucide-react";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useAnalyticsData } from "@/hooks";
import { useLeadPurchases } from "@/hooks/lead-purchases";
import { parseLocalDate } from "@/lib/date";
import {
  Board,
  Cap,
  Bar,
  AnimatedNumber,
  FlapTile,
  EmptyState,
  T,
} from "@/components/board";
import type { BarTone } from "@/components/board";

interface FunnelStage {
  label: string;
  count: number;
  tone: BarTone;
}

export function FunnelPanel() {
  const { dateRange } = useAnalyticsDateRange();

  const { raw, isLoading: analyticsLoading } = useAnalyticsData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  const { data: leadPurchases, isLoading: leadsLoading } = useLeadPurchases();

  const isLoading = analyticsLoading || leadsLoading;

  if (isLoading) {
    return (
      <Board
        pad={26}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            font: `500 12px ${T.mono}`,
            color: T.mut2,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Conversion Funnel
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

  // Filter lead purchases within date range
  const periodLeadPurchases = (leadPurchases ?? []).filter((lp) => {
    const date = parseLocalDate(lp.purchaseDate);
    return date >= dateRange.startDate && date <= dateRange.endDate;
  });

  const leads = periodLeadPurchases.reduce((sum, lp) => sum + lp.leadCount, 0);
  const applications = raw.policies.filter((p) => p.submitDate).length;
  const approved = raw.policies.filter((p) => p.status === "approved").length;
  const active = raw.policies.filter(
    (p) => p.lifecycleStatus === "active",
  ).length;

  const isEmpty = leads === 0 && applications === 0;

  // Avg close time: days from submitDate to effectiveDate
  const closeTimes = raw.policies
    .filter((p) => p.submitDate && p.effectiveDate)
    .map((p) => {
      const submit = new Date(p.submitDate!);
      const effective = parseLocalDate(p.effectiveDate);
      return (effective.getTime() - submit.getTime()) / (1000 * 60 * 60 * 24);
    })
    .filter((d) => d >= 0);

  const avgCloseTime =
    closeTimes.length > 0
      ? Math.round(closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length)
      : 0;

  const leadToActivePct =
    leads > 0 ? ((active / leads) * 100).toFixed(1) : null;

  const stages: FunnelStage[] = [
    { label: "Leads Purchased", count: leads, tone: "blue" },
    { label: "Applications", count: applications, tone: "amber" },
    { label: "Approved", count: approved, tone: "amber" },
    { label: "Active", count: active, tone: "green" },
  ];

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

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
          <Cap>Conversion Funnel</Cap>
          <div
            style={{
              font: `600 18px ${T.data}`,
              color: T.ink,
              marginTop: 4,
            }}
          >
            Lead-to-policy pipeline
          </div>
        </div>
        {!isEmpty && leadToActivePct !== null && (
          <div style={{ textAlign: "right" }}>
            <AnimatedNumber
              value={parseFloat(leadToActivePct)}
              suffix="%"
              decimals={1}
              size="lg"
              color={T.green}
            />
            <div
              style={{
                font: `500 11px ${T.mono}`,
                color: T.mut2,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              lead → active
            </div>
          </div>
        )}
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<Filter size={22} />}
          title="No funnel data yet"
          hint="Funnel fills as you buy leads and write apps."
          pad={40}
          style={{ flex: 1 }}
        />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Stage bars */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              flex: 1,
            }}
          >
            {stages.map((stage, idx) => {
              const pct = stage.count / maxCount;
              const prevCount = idx > 0 ? stages[idx - 1].count : 0;
              const convPct =
                prevCount > 0
                  ? ((stage.count / prevCount) * 100).toFixed(1)
                  : null;

              return (
                <div key={stage.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        font: `500 12px ${T.data}`,
                        color: T.mut,
                      }}
                    >
                      {stage.label}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <AnimatedNumber
                        value={stage.count}
                        size="sm"
                        color={T.cream}
                      />
                      {convPct !== null && (
                        <span
                          style={{
                            font: `700 10px ${T.mono}`,
                            letterSpacing: "0.1em",
                            color:
                              Number(convPct) >= 50
                                ? T.green
                                : Number(convPct) >= 25
                                  ? T.amber
                                  : T.red,
                            background:
                              Number(convPct) >= 50
                                ? "rgba(95,208,138,0.12)"
                                : Number(convPct) >= 25
                                  ? "rgba(244,180,58,0.12)"
                                  : "rgba(255,106,93,0.12)",
                            padding: "2px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {convPct}%
                        </span>
                      )}
                    </div>
                  </div>
                  <Bar pct={pct} tone={stage.tone} height={8} />
                </div>
              );
            })}
          </div>

          {/* Footer flap tiles */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginTop: 18,
            }}
          >
            <FlapTile
              label="Lead → Active"
              value={leadToActivePct !== null ? `${leadToActivePct}%` : "—"}
              tone="green"
              sm
            />
            <FlapTile
              label="Avg Close Time"
              value={avgCloseTime > 0 ? `${avgCloseTime}d` : "—"}
              sm
            />
          </div>
        </div>
      )}
    </Board>
  );
}
