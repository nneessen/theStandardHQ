// src/features/hierarchy/HierarchyDashboardCompact.tsx

import { useState, useMemo } from "react";
import { Download, UserPlus, AlertCircle } from "lucide-react";
import { PillButton, SoftCard, SectionShell, PillNav } from "@/components/v2";
import { Board, Cap, FlapTile, Num, T } from "@/components/board";
import { useMyDownlines, useMyHierarchyStats } from "@/hooks";
import { useCurrentUserProfile } from "@/hooks/admin";
import { useFeatureAccess } from "@/hooks";
import { OWNER_EMAILS } from "@/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { SendInvitationModal } from "./components/SendInvitationModal";
import { TeamMetricsCard } from "./components/TeamMetricsCard";
import { AgentTable } from "./components/AgentTable";
import { IssuedPremiumTable } from "./components/IssuedPremiumTable";
import { InvitationsList } from "./components/InvitationsList";
import { PendingInvitationBanner } from "./components/PendingInvitationBanner";
import { TeamActivityFeed } from "./components/TeamActivityFeed";
import { TeamAnalyticsDashboard } from "./components/TeamAnalyticsDashboard";
import { toast } from "sonner";
import { downloadCSV } from "@/utils/exportHelpers";
import type { UserProfile } from "@/types/hierarchy.types";
import {
  TimePeriodSwitcher,
  PeriodNavigator,
  DateRangeDisplay,
} from "@/features/dashboard";
import { getDateRange, type TimePeriod } from "@/utils/dateRange";

// Extended agent type with additional fields
interface Agent extends UserProfile {
  name?: string;
  is_active?: boolean;
  parent_agent_id?: string | null;
}

export function HierarchyDashboardCompact() {
  const { data: downlinesRaw = [], isLoading: downlinesLoading } =
    useMyDownlines();
  const { data: currentUserProfile } = useCurrentUserProfile();
  const { user } = useAuth();
  const { hasAccess: hasTeamAnalyticsAccess } =
    useFeatureAccess("team_analytics");

  // Owner (super-admin) always has access to team analytics
  const isOwner = OWNER_EMAILS.map((e) => e.toLowerCase()).includes(
    user?.email?.toLowerCase() ?? "",
  );
  const canViewTeamAnalytics = isOwner || hasTeamAnalyticsAccess;

  // Timeframe state
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("monthly");
  const [periodOffset, setPeriodOffset] = useState<number>(0);

  // Calculate date range from timeframe (memoized to ensure stable query keys)
  const { dateRange, startDate, endDate } = useMemo(() => {
    const range = getDateRange(timePeriod, periodOffset);
    return {
      dateRange: range,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
    };
  }, [timePeriod, periodOffset]);

  // Handler for changing time period (resets offset)
  const handleTimePeriodChange = (newPeriod: TimePeriod) => {
    setTimePeriod(newPeriod);
    setPeriodOffset(0); // Reset to current period when granularity changes
  };

  // Fetch stats with date range
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useMyHierarchyStats({
    startDate,
    endDate,
  });

  // Transform UserProfile to Agent type
  const downlines: Agent[] = downlinesRaw.map((profile) => ({
    ...profile,
    name:
      `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
      profile.email,
    is_active: profile.approval_status === "approved",
    parent_agent_id: profile.upline_id,
  }));

  // Transform current user (owner) to Agent type for display in table
  const owner: Agent | null = currentUserProfile
    ? {
        ...currentUserProfile,
        name:
          `${currentUserProfile.first_name || ""} ${currentUserProfile.last_name || ""}`.trim() ||
          currentUserProfile.email,
        is_active: currentUserProfile.approval_status === "approved",
        parent_agent_id: currentUserProfile.upline_id,
      }
    : null;

  const [sendInvitationModalOpen, setSendInvitationModalOpen] = useState(false);
  // One team-production table at a time — submissions (AP) vs issued (IP) —
  // instead of two near-identical tables stacked (which read as duplicates).
  const [teamTableView, setTeamTableView] = useState<"submissions" | "issued">(
    "submissions",
  );

  const handleExportCSV = () => {
    try {
      const exportData = downlines.map((agent) => ({
        Name: agent.name || "N/A",
        Email: agent.email || "N/A",
        "Contract Level": agent.contract_level || 100,
        Status: agent.is_active ? "Active" : "Inactive",
        "Join Date": agent.created_at ? formatDate(agent.created_at) : "N/A",
        "MTD Override": formatCurrency(0), // Would need actual data
        "YTD Override": formatCurrency(0), // Would need actual data
      }));

      downloadCSV(exportData, "team-hierarchy");
      toast.success("Team data exported to CSV!");
    } catch (_error) {
      toast.error("Failed to export CSV");
    }
  };

  const isLoading = downlinesLoading || statsLoading;
  const hasError = statsError;

  // Compact $k formatter for inline header chips
  const compactDollar = (n: number): string => {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${Math.round(n / 1000)}k`;
    return `$${Math.round(n)}`;
  };

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Departure-board header — eyebrow + title + actions */}
          <header
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>AGENCY HIERARCHY</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Team
              </h1>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <PillButton
                onClick={handleExportCSV}
                tone="ghost"
                size="sm"
                className="h-7 px-2.5 text-[12px]"
              >
                <Download className="h-3 w-3" />
                CSV
              </PillButton>
              <PillButton
                onClick={() => setSendInvitationModalOpen(true)}
                tone="black"
                size="sm"
                className="h-7 px-2.5 text-[12px]"
              >
                <UserPlus className="h-3 w-3" />
                Invite
              </PillButton>
            </div>
          </header>

          {/* Hero band — team override snapshot (real stats) */}
          <Board
            pad={20}
            rivets
            style={{
              background: `radial-gradient(130% 180% at 0% 0%, rgba(107,151,255,0.12), rgba(107,151,255,0.01)), ${T.panelGradient}`,
              border: "1px solid rgba(107,151,255,0.28)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 24,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <Cap>TEAM SIZE</Cap>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    marginTop: 4,
                  }}
                >
                  <Num
                    text={(
                      stats?.total_downlines ?? downlines.length
                    ).toLocaleString()}
                    size="xl"
                    lit
                  />
                  <span style={{ font: `500 12px ${T.data}`, color: T.mut }}>
                    agents
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
                  gap: 10,
                  flex: 1,
                  minWidth: 240,
                }}
              >
                <FlapTile
                  label="Direct"
                  value={(stats?.direct_downlines ?? 0).toLocaleString()}
                  tone="blue"
                />
                <FlapTile
                  label="Override MTD"
                  value={compactDollar(stats?.total_override_income_mtd ?? 0)}
                  tone="green"
                />
                <FlapTile
                  label="Override YTD"
                  value={compactDollar(stats?.total_override_income_ytd ?? 0)}
                  tone="default"
                />
                <FlapTile
                  label="Pending"
                  value={(stats?.pending_invitations ?? 0).toLocaleString()}
                  tone={
                    (stats?.pending_invitations ?? 0) > 0 ? "amber" : "default"
                  }
                />
              </div>
            </div>
          </Board>

          {/* Main Content */}
          <div className="flex flex-col gap-2">
            {/* Pending Invitation Banner (for invitees) */}
            <PendingInvitationBanner />

            {/* Timeframe Selector — compact row */}
            <SoftCard
              padding="none"
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 overflow-x-auto"
            >
              <div className="text-[11px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] shrink-0">
                Team metrics
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0">
                <TimePeriodSwitcher
                  timePeriod={timePeriod}
                  onTimePeriodChange={handleTimePeriodChange}
                />
                <PeriodNavigator
                  timePeriod={timePeriod}
                  periodOffset={periodOffset}
                  onOffsetChange={setPeriodOffset}
                  dateRange={dateRange}
                />
                <DateRangeDisplay
                  timePeriod={timePeriod}
                  dateRange={dateRange}
                />
              </div>
            </SoftCard>

            {/* Team Metrics Card */}
            <TeamMetricsCard
              stats={stats}
              agentCount={downlines.length}
              isLoading={isLoading}
              isError={hasError}
              onRetry={refetchStats}
              timePeriod={timePeriod}
            />

            {/* Team production — ONE table at a time (AP submissions vs IP
                issued), toggled, so they don't stack as confusing duplicates. */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Cap>Team Production</Cap>
                <span style={{ font: `500 12px ${T.data}`, color: T.mut }}>
                  {teamTableView === "submissions"
                    ? "All submissions by submit date · Annual Premium"
                    : "Active issued policies only · Issued Premium"}
                </span>
              </div>
              <PillNav
                size="sm"
                activeValue={teamTableView}
                onChange={(v) =>
                  setTeamTableView(v as "submissions" | "issued")
                }
                items={[
                  { label: "Submissions · AP", value: "submissions" },
                  { label: "Issued · IP", value: "issued" },
                ]}
              />
            </div>

            {teamTableView === "submissions" ? (
              <AgentTable
                agents={downlines}
                owner={owner}
                isLoading={isLoading}
                dateRange={{ start: startDate, end: endDate }}
              />
            ) : (
              <IssuedPremiumTable
                agents={downlines}
                owner={owner}
                isLoading={isLoading}
                dateRange={{ start: startDate, end: endDate }}
              />
            )}

            {/* Team Analytics Dashboard - Premium Feature (Team tier or Owner) */}
            {downlines.length > 0 && canViewTeamAnalytics && (
              <TeamAnalyticsDashboard
                startDate={startDate}
                endDate={endDate}
                teamUserIds={
                  owner
                    ? [owner.id, ...downlines.map((d) => d.id)]
                    : downlines.map((d) => d.id)
                }
              />
            )}

            {/* Bottom Grid: Invitations and Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <InvitationsList />
              <TeamActivityFeed agents={downlines} />
            </div>

            {/* Performance Insights */}
            {stats && stats.direct_downlines > 0 && (
              <SoftCard padding="none" className="px-3 py-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-v2-ink-subtle mt-0.5" />
                  <div className="text-[12px]">
                    <span className="font-semibold text-v2-ink">
                      Team performance insights
                    </span>
                    <div className="text-[11px] text-v2-ink-muted mt-0.5 space-y-0.5">
                      {stats.total_downlines < 5 && (
                        <p>
                          · Build your team: you have {stats.total_downlines}{" "}
                          agents. Consider recruiting more to increase override
                          income.
                        </p>
                      )}
                      {stats.total_override_income_mtd === 0 && (
                        <p>
                          · No override income this month. Check agent activity
                          and commission settings.
                        </p>
                      )}
                      {stats.direct_downlines > 10 && (
                        <p>
                          · Great team size. Focus on helping underperforming
                          agents improve their results.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </SoftCard>
            )}
          </div>
        </div>

        {/* Send Invitation Modal */}
        <SendInvitationModal
          open={sendInvitationModalOpen}
          onOpenChange={setSendInvitationModalOpen}
        />
      </div>
    </SectionShell>
  );
}
