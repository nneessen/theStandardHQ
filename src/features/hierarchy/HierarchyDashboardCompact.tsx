// src/features/hierarchy/HierarchyDashboardCompact.tsx

import { useState, useMemo, useEffect, type ElementType } from "react";
import {
  Download,
  AlertCircle,
  LineChart,
  BarChart3,
  Users,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { PillButton, SoftCard, SectionShell, PillNav } from "@/components/v2";
import { Cap, Num, T } from "@/components/board";
import { cn } from "@/lib/utils";
import { useMyDownlines, useMyHierarchyStats } from "@/hooks";
import { useCurrentUserProfile } from "@/hooks/admin";
import { useFeatureAccess } from "@/hooks";
import { OWNER_EMAILS } from "@/hooks";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { PaceHero } from "./components/PaceHero";
import { TeamKpiStrip } from "./components/TeamKpiStrip";
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

// Team-page sub-views. Analytics only appears when the team has downlines AND the
// viewer has access, so it is filtered out of the tab bar below in those cases.
const ALL_TABS = [
  { id: "production", label: "Production", icon: LineChart },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "members", label: "Members & Activity", icon: Users },
] as const;

type TeamTabId = (typeof ALL_TABS)[number]["id"];

function isTeamTabId(v: string | undefined): v is TeamTabId {
  return v != null && ALL_TABS.some((t) => t.id === v);
}

export function HierarchyDashboardCompact({
  initialTab,
}: {
  initialTab?: string;
}) {
  const navigate = useNavigate();
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

  // One team-production table at a time — submissions (AP) vs issued (IP) —
  // instead of two near-identical tables stacked (which read as duplicates).
  const [teamTableView, setTeamTableView] = useState<"submissions" | "issued">(
    "submissions",
  );

  const isLoading = downlinesLoading || statsLoading;
  const hasError = statsError;

  // Analytics is a full-width tab only when there's a team AND the viewer can see it.
  const analyticsTabVisible = downlines.length > 0 && canViewTeamAnalytics;
  const tabs = ALL_TABS.filter(
    (t) => t.id !== "analytics" || analyticsTabVisible,
  ) as ReadonlyArray<{ id: TeamTabId; label: string; icon: ElementType }>;

  const [activeTab, setActiveTab] = useState<TeamTabId>(
    isTeamTabId(initialTab) ? initialTab : "production",
  );

  // If the Analytics tab disappears (team shrinks / access lost) while it's the
  // active tab — or a stale ?tab=analytics deep-link lands without access — fall
  // back to Production so the body is never blank.
  useEffect(() => {
    if (activeTab === "analytics" && !analyticsTabVisible) {
      setActiveTab("production");
    }
  }, [activeTab, analyticsTabVisible]);

  const selectTab = (id: TeamTabId) => {
    setActiveTab(id);
    navigate({ to: "/hierarchy", search: { tab: id }, replace: true });
  };

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

  const teamSize = stats?.total_downlines ?? downlines.length;
  const directCount = stats?.direct_downlines ?? 0;
  const pendingCount = stats?.pending_invitations ?? 0;

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Header — eyebrow + title on the left; team-size identity cluster +
              CSV export on the right (identity moved here from the old hero band). */}
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
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
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <Cap>Team Size</Cap>
                <div className="flex items-baseline gap-1.5">
                  <Num text={teamSize.toLocaleString()} size="lg" lit />
                  <span style={{ font: `500 11px ${T.data}`, color: T.mut }}>
                    agents
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                  <span className="text-v2-ink-muted">
                    {directCount} direct
                  </span>
                  {pendingCount > 0 && (
                    <span style={{ color: T.amber, fontWeight: 600 }}>
                      {pendingCount} pending
                    </span>
                  )}
                </div>
              </div>
              <PillButton
                onClick={handleExportCSV}
                tone="ghost"
                size="sm"
                className="h-7 px-2.5 text-[12px]"
              >
                <Download className="h-3 w-3" />
                CSV
              </PillButton>
            </div>
          </header>

          {/* Team Pace — the headline. Always visible; calendar-fixed scope. */}
          <PaceHero
            stats={stats}
            isLoading={isLoading}
            isError={hasError}
            onRetry={refetchStats}
          />

          {/* Pending Invitation Banner (for invitees) */}
          <PendingInvitationBanner />

          {/* Timeframe Selector — governs the KPI strip + production table below
              (NOT the calendar-fixed pace hero above). */}
          <SoftCard
            padding="none"
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 overflow-x-auto"
          >
            <div className="text-[11px] font-semibold text-v2-ink-subtle uppercase tracking-[0.18em] shrink-0">
              Timeframe · metrics &amp; production
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

          {/* KPI strip — 8 headline team metrics, horizontal (was the side rail) */}
          <TeamKpiStrip
            stats={stats}
            timePeriod={timePeriod}
            isLoading={isLoading}
            isError={hasError}
            onRetry={refetchStats}
          />

          {/* Tab bar — underline style; rotates the heavy sections so only one
              tall block shows at a time (no short-rail-beside-tall-table gap). */}
          <nav
            className="flex flex-wrap items-center gap-1 border-b border-v2-ring"
            aria-label="Team sections"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-v2-accent text-v2-ink"
                      : "border-transparent text-v2-ink-muted hover:text-v2-ink",
                  )}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* ── Production tab ── */}
          {activeTab === "production" && (
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 2 }}
                >
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
            </div>
          )}

          {/* ── Analytics tab (only mounted when visible) ── */}
          {activeTab === "analytics" && analyticsTabVisible && (
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

          {/* ── Members & Activity tab ── */}
          {activeTab === "members" && (
            <div className="flex flex-col gap-2">
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
                            agents. Consider recruiting more to increase
                            override income.
                          </p>
                        )}
                        {stats.total_override_income_mtd === 0 && (
                          <p>
                            · No override income this month. Check agent
                            activity and commission settings.
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
          )}
        </div>
      </div>
    </SectionShell>
  );
}
