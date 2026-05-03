// src/features/hierarchy/HierarchyDashboardCompact.tsx

import { useState, useMemo } from "react";
import { Download, UserPlus, AlertCircle, Users } from "lucide-react";
import { PillButton, SoftCard } from "@/components/v2";
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
    <>
      <div className="flex flex-col gap-2">
        {/* Compact header — title + inline metric chips + actions in ONE row */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Users className="h-4 w-4 text-v2-ink" />
              <h1 className="text-base font-semibold tracking-tight text-v2-ink">
                Team
              </h1>
            </div>
            {stats && (
              <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-v2-ink-muted flex-wrap leading-tight">
                <span>
                  <span className="text-v2-ink font-semibold">
                    {(
                      stats.total_downlines ?? downlines.length
                    ).toLocaleString()}
                  </span>{" "}
                  agents
                </span>
                <span className="text-v2-ink-subtle">·</span>
                <span>
                  <span className="text-v2-ink font-semibold">
                    {(stats.direct_downlines ?? 0).toLocaleString()}
                  </span>{" "}
                  direct
                </span>
                <span className="text-v2-ink-subtle">·</span>
                <span>
                  <span className="text-success font-semibold">
                    {compactDollar(stats.total_override_income_mtd ?? 0)}
                  </span>{" "}
                  override MTD
                </span>
                <span className="text-v2-ink-subtle">·</span>
                <span>
                  <span className="text-v2-ink font-semibold">
                    {compactDollar(stats.total_override_income_ytd ?? 0)}
                  </span>{" "}
                  YTD
                </span>
                {stats.pending_invitations !== undefined &&
                  stats.pending_invitations > 0 && (
                    <>
                      <span className="text-v2-ink-subtle">·</span>
                      <span>
                        <span className="text-warning font-semibold">
                          {stats.pending_invitations}
                        </span>{" "}
                        pending
                      </span>
                    </>
                  )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <PillButton
              onClick={handleExportCSV}
              tone="ghost"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
            >
              <Download className="h-3 w-3" />
              CSV
            </PillButton>
            <PillButton
              onClick={() => setSendInvitationModalOpen(true)}
              tone="black"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
            >
              <UserPlus className="h-3 w-3" />
              Invite
            </PillButton>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-col gap-2">
          {/* Pending Invitation Banner (for invitees) */}
          <PendingInvitationBanner />

          {/* Timeframe Selector — compact row */}
          <SoftCard
            padding="none"
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 overflow-x-auto"
          >
            <div className="text-[10px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] shrink-0">
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
              <DateRangeDisplay timePeriod={timePeriod} dateRange={dateRange} />
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

          {/* Agent Table - Submissions (all policies by effective_date) */}
          <AgentTable
            agents={downlines}
            owner={owner}
            isLoading={isLoading}
            dateRange={{ start: startDate, end: endDate }}
          />

          {/* Issued Premium Table - Active policies only */}
          <IssuedPremiumTable
            agents={downlines}
            owner={owner}
            isLoading={isLoading}
            dateRange={{ start: startDate, end: endDate }}
          />

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
                <div className="text-[11px]">
                  <span className="font-semibold text-v2-ink">
                    Team performance insights
                  </span>
                  <div className="text-[10px] text-v2-ink-muted mt-0.5 space-y-0.5">
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
    </>
  );
}
