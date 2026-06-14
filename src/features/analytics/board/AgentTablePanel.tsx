// src/features/analytics/board/AgentTablePanel.tsx
import { Users } from "lucide-react";
import { format } from "date-fns";
import { useAnalyticsDateRange } from "../context/AnalyticsDateContext";
import { useAgentLeaderboard } from "@/hooks/leaderboard";
import type { LeaderboardFilters } from "@/types/leaderboard.types";
import { formatCurrency } from "@/lib/format";
import { Board, Cap, FlapTile, EmptyState, T } from "@/components/board";

export function AgentTablePanel() {
  const { dateRange } = useAnalyticsDateRange();

  const filters: LeaderboardFilters = {
    timePeriod: "custom",
    startDate: format(dateRange.startDate, "yyyy-MM-dd"),
    endDate: format(dateRange.endDate, "yyyy-MM-dd"),
    scope: "all",
  };

  const { data, isLoading } = useAgentLeaderboard({
    filters,
    staleTime: 60_000,
  });

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
          Agent Performance
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

  const entries = data?.entries ?? [];
  const totals = data?.totals;
  const topAgent = entries[0];
  const totalAgentCount = totals?.totalEntries ?? entries.length;

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
          <Cap>Agent Performance</Cap>
          <div
            style={{
              font: `500 18px ${T.data}`,
              color: T.mut,
              marginTop: 4,
            }}
          >
            {totalAgentCount} agents · top 10 shown
          </div>
        </div>
        {topAgent && (
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                font: `800 24px ${T.disp}`,
                color: T.ink,
                lineHeight: 1.2,
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {topAgent.agentName}
            </div>
            <div
              style={{
                font: `500 11px ${T.mono}`,
                color: T.mut,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                marginTop: 3,
              }}
            >
              top performer
            </div>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="No agent data for this period"
          hint="Leaderboard fills in as policies are written."
          pad={40}
          style={{ flex: 1 }}
        />
      ) : (
        <>
          {/* Table */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${T.line2}`,
                  }}
                >
                  {(
                    [
                      { label: "#", align: "left" as const },
                      { label: "Agent", align: "left" as const },
                      { label: "Policies", align: "right" as const },
                      { label: "AP", align: "right" as const },
                      { label: "IP", align: "right" as const },
                    ] as const
                  ).map((col) => (
                    <th
                      key={col.label}
                      style={{
                        font: `700 12.5px ${T.mono}`,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: T.mut,
                        textAlign: col.align,
                        paddingBottom: 8,
                        paddingLeft: col.align === "right" ? 18 : 0,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 10).map((entry, idx, arr) => (
                  <tr
                    key={entry.agentId}
                    style={{
                      borderBottom:
                        idx < arr.length - 1 ? `1px solid ${T.line}` : "none",
                    }}
                  >
                    <td
                      style={{
                        font: `800 14px ${T.disp}`,
                        color: T.mut2,
                        padding: "14px 0",
                        width: 32,
                      }}
                    >
                      {entry.rankOverall}
                    </td>
                    <td
                      style={{
                        font: `700 16px ${T.disp}`,
                        color: T.ink,
                        padding: "14px 0",
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.agentName}
                    </td>
                    <td
                      style={{
                        font: `600 15px ${T.data}`,
                        color: T.ink,
                        textAlign: "right",
                        padding: "14px 0 14px 18px",
                      }}
                    >
                      {entry.policyCount}
                    </td>
                    <td
                      style={{
                        font: `600 15px ${T.data}`,
                        color: T.ink,
                        textAlign: "right",
                        padding: "14px 0 14px 18px",
                      }}
                    >
                      {formatCurrency(entry.apTotal)}
                    </td>
                    <td
                      style={{
                        font: `600 15px ${T.data}`,
                        color: T.ink,
                        textAlign: "right",
                        padding: "14px 0 14px 18px",
                      }}
                    >
                      {formatCurrency(entry.ipTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer FlapTiles */}
          {totals && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginTop: 16,
              }}
            >
              <FlapTile
                label="Total Policies"
                value={String(totals.totalPolicies)}
                tone="default"
                sm
              />
              <FlapTile
                label="Total AP"
                value={formatCurrency(totals.totalAp)}
                tone="default"
                sm
              />
              <FlapTile
                label="Total IP"
                value={formatCurrency(totals.totalIp)}
                tone="green"
                sm
              />
            </div>
          )}
        </>
      )}
    </Board>
  );
}
