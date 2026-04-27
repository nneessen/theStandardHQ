// src/features/the-standard-team/TheStandardTeamPage.tsx
// Licensing and writing numbers workspace (legacy route path: /the-standard-team)

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Users,
  FileText,
  MapPin,
  Search,
  UserCircle2,
  Network,
  Grid2X2,
  Focus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UpgradePrompt } from "@/components/subscription";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WritingNumbersTab } from "./components/WritingNumbersTab";
import { StateLicensesTab } from "./components/StateLicensesTab";
import { useTheStandardAgents } from "./hooks/useTheStandardAgents";
import {
  LICENSING_WORKSPACE_PAID_FEATURE,
  LICENSING_WORKSPACE_TRIAL_DAYS,
  useLicensingWorkspaceAccess,
} from "./hooks/useLicensingWorkspaceAccess";
import { useCurrentUserProfile } from "@/hooks/admin";
import { AgentCarrierContractsCard } from "@/features/contracting";

type TabType = "writing-numbers" | "state-licenses";
type ViewMode = "team" | "agent";

interface TheStandardTeamPageProps {
  initialTab?: string;
  trialBanner?: {
    daysRemaining: number;
    endsAt: string | null;
  };
}

function formatAccessDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function TheStandardTeamRoutePage({
  initialTab,
}: TheStandardTeamPageProps) {
  const access = useLicensingWorkspaceAccess();

  if (access.isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] p-3">
        <div className="h-full rounded-lg border border-v2-ring dark:border-v2-ring bg-v2-card flex items-center justify-center">
          <div className="flex items-center gap-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking licensing workspace access...
          </div>
        </div>
      </div>
    );
  }

  if (!access.hasAccess) {
    const trialEndedOn = formatAccessDate(access.trialEndsAt);

    return (
      <div className="h-[calc(100vh-4rem)] p-3">
        <div className="h-full rounded-lg border border-v2-ring dark:border-v2-ring bg-v2-card p-4 md:p-6 overflow-auto">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            <div className="rounded-lg border border-v2-ring dark:border-v2-ring bg-v2-canvas/80 dark:bg-v2-card/40 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
                    Licensing &amp; Writing Numbers Workspace
                  </h1>
                  <p className="mt-1 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                    The team workspace is free for{" "}
                    {LICENSING_WORKSPACE_TRIAL_DAYS} days, then requires a Pro
                    or Team plan.
                  </p>
                </div>
                <Badge variant="outline" size="sm">
                  Trial Ended
                </Badge>
              </div>
              <div className="mt-3 text-[11px] text-v2-ink-muted dark:text-v2-ink-muted space-y-1">
                {trialEndedOn && (
                  <p>Your free workspace access ended on {trialEndedOn}.</p>
                )}
                <p>
                  Free carrier contract toggles are still available in Settings
                  &rarr; Profile.
                </p>
                <p>
                  Pro/Team adds hierarchy tools to manage team writing numbers
                  and compare state licenses across uplines and downlines so
                  licensing gaps are visible both ways.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/settings" search={{ tab: "profile" }}>
                  <Button type="button" variant="outline" size="sm">
                    Go to Settings Profile
                  </Button>
                </Link>
                <Link to="/billing">
                  <Button type="button" size="sm">
                    Upgrade to Pro or Team
                  </Button>
                </Link>
              </div>
            </div>

            <UpgradePrompt
              feature={LICENSING_WORKSPACE_PAID_FEATURE}
              variant="card"
              title="Unlock the Team Licensing Workspace"
              description="Manage team writing numbers and compare state licenses across uplines/downlines in one hierarchy-scoped workspace, while keeping carrier contract visibility in sync."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <TheStandardTeamPage
      initialTab={initialTab}
      trialBanner={
        access.hasTrialAccess
          ? {
              daysRemaining: access.trialDaysRemaining,
              endsAt: access.trialEndsAt,
            }
          : undefined
      }
    />
  );
}

export function TheStandardTeamPage({
  initialTab,
  trialBanner,
}: TheStandardTeamPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>(
    initialTab === "state-licenses" ? "state-licenses" : "writing-numbers",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("team");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const {
    data: agents = [],
    isLoading: agentsLoading,
    error: agentsError,
  } = useTheStandardAgents();
  const { data: currentProfile } = useCurrentUserProfile();

  // Update URL when tab changes
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  useEffect(() => {
    if (agents.length === 0) {
      setSelectedAgentId(null);
      return;
    }

    const preferredId = currentProfile?.id || agents[0]?.id;

    if (
      !selectedAgentId ||
      !agents.some((agent) => agent.id === selectedAgentId)
    ) {
      setSelectedAgentId(preferredId || agents[0].id);
    }
  }, [agents, currentProfile?.id, selectedAgentId]);

  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return agents;

    return agents.filter((agent) => {
      const fullName =
        `${agent.first_name || ""} ${agent.last_name || ""}`.trim();
      return (
        fullName.toLowerCase().includes(query) ||
        agent.email.toLowerCase().includes(query)
      );
    });
  }, [agents, searchQuery]);

  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) || null;

  const displayAgents =
    viewMode === "agent"
      ? selectedAgent
        ? [selectedAgent]
        : []
      : filteredAgents;

  const classificationAgencyId =
    selectedAgent?.agency_id || currentProfile?.agency_id || undefined;
  const canEditStateClassifications = Boolean(
    currentProfile?.is_super_admin ||
    currentProfile?.is_admin ||
    (classificationAgencyId &&
      currentProfile?.agency_id &&
      currentProfile.agency_id === classificationAgencyId),
  );

  // Tab configuration
  const tabs: { id: TabType; label: string; icon: typeof FileText }[] = [
    { id: "writing-numbers", label: "Carrier Writing Numbers", icon: FileText },
    { id: "state-licenses", label: "State Licenses", icon: MapPin },
  ];

  const totalAgents = agents.length;
  const downlineCount = Math.max(0, totalAgents - (currentProfile?.id ? 1 : 0));
  const trialEndsOn = formatAccessDate(trialBanner?.endsAt ?? null);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 gap-2.5">
      {trialBanner && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 px-3 py-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" size="sm">
                  7-Day Trial
                </Badge>
                <Badge variant="outline" size="sm">
                  {trialBanner.daysRemaining} day
                  {trialBanner.daysRemaining === 1 ? "" : "s"} left
                </Badge>
              </div>
              <p className="mt-1 text-[11px] font-medium text-v2-ink dark:text-v2-ink">
                Play around with Licenses/Writing #&apos;s while your 7-day
                trial is active.
              </p>
              <p className="mt-0.5 text-[10px] text-v2-ink-muted dark:text-v2-ink-muted">
                Use it to manage your entire team&apos;s writing numbers, see
                which agents have which carrier contracts, compare which states
                each agent is licensed in, and more. After the trial
                {trialEndsOn ? ` (ends ${trialEndsOn})` : ""}, this feature
                requires a Pro or Team plan. Free carrier contract toggles
                remain in Settings &rarr; Profile.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link to="/billing">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                >
                  View Pro/Team Plans
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring dark:border-v2-ring">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-v2-ink dark:text-v2-ink" />
            <h1 className="text-sm font-semibold text-v2-ink dark:text-v2-ink">
              Licensing &amp; Writing Numbers
            </h1>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-blue-500" />
              <span className="font-medium text-v2-ink dark:text-v2-ink">
                {totalAgents}
              </span>
              <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                agents
              </span>
            </div>
            <div className="flex items-center gap-1">
              <UserCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="font-medium text-v2-ink dark:text-v2-ink">
                {downlineCount}
              </span>
              <span className="text-v2-ink-muted dark:text-v2-ink-subtle">
                downlines
              </span>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted">
          Hierarchy-scoped workspace for your team and downlines
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_320px] gap-2.5">
        <aside className="min-h-0 bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring flex flex-col">
          <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-v2-ink-subtle" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-v2-ink dark:text-v2-ink">
                Agent Scope
              </h2>
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-v2-ink-subtle absolute left-2 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agents"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Button
                type="button"
                variant={viewMode === "team" ? "default" : "ghost"}
                size="xs"
                onClick={() => setViewMode("team")}
              >
                <Grid2X2 className="h-3 w-3" />
                Team Grid
              </Button>
              <Button
                type="button"
                variant={viewMode === "agent" ? "default" : "ghost"}
                size="xs"
                onClick={() => setViewMode("agent")}
                disabled={!selectedAgent}
              >
                <Focus className="h-3 w-3" />
                Agent Focus
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredAgents.length === 0 && !agentsLoading && (
                <div className="px-2 py-3 text-center text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  No agents match your search
                </div>
              )}

              {filteredAgents.map((agent) => {
                const isSelected = agent.id === selectedAgentId;
                const isSelf = agent.id === currentProfile?.id;
                const depth = agent.hierarchy_depth ?? 0;

                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={cn(
                      "w-full text-left rounded-md border px-2 py-2 transition-colors",
                      isSelected
                        ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20"
                        : "border-v2-ring dark:border-v2-ring hover:bg-v2-canvas dark:hover:bg-v2-card-tinted/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-v2-ink dark:text-v2-ink truncate">
                          {[agent.first_name, agent.last_name]
                            .filter(Boolean)
                            .join(" ") || agent.email}
                        </p>
                        <p className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle truncate">
                          {agent.email}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {isSelf ? (
                          <Badge variant="info" size="sm">
                            Me
                          </Badge>
                        ) : depth <= 1 ? (
                          <Badge variant="secondary" size="sm">
                            Direct
                          </Badge>
                        ) : (
                          <Badge variant="outline" size="sm">
                            L{depth}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        <section className="min-w-0 min-h-0 bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-0.5 bg-v2-card-tinted dark:bg-v2-card/50 rounded-md p-0.5 flex-1 min-w-[280px]">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all",
                        isActive
                          ? "bg-white dark:bg-v2-ring-strong shadow-sm text-v2-ink dark:text-v2-ink"
                          : "text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-canvas hover:bg-v2-card-tinted/50 dark:hover:bg-v2-card-tinted/50",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle">
                {viewMode === "agent"
                  ? "Focused on selected agent"
                  : `Showing ${displayAgents.length} of ${filteredAgents.length} filtered agents`}
              </div>
            </div>

            {searchQuery.trim() && viewMode === "team" && (
              <div className="text-[10px] text-v2-ink-subtle dark:text-v2-ink-muted">
                Team grid is filtered by search. Select an agent from the left
                panel to manage contracts in the sidebar.
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 flex">
            {agentsLoading ? (
              <div className="h-full flex items-center justify-center p-4">
                <div className="flex items-center gap-2 text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading hierarchy agents...
                </div>
              </div>
            ) : agentsError ? (
              <div className="h-full flex items-center justify-center p-4">
                <p className="text-[11px] text-red-500">
                  Failed to load hierarchy agents: {agentsError.message}
                </p>
              </div>
            ) : displayAgents.length === 0 ? (
              <div className="h-full flex items-center justify-center p-4">
                <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle text-center">
                  {viewMode === "agent"
                    ? "Select an agent to enter Agent Focus mode"
                    : "No agents match the current search filter"}
                </p>
              </div>
            ) : activeTab === "writing-numbers" ? (
              <WritingNumbersTab
                agents={displayAgents}
                selectedAgentId={selectedAgentId || undefined}
              />
            ) : (
              <StateLicensesTab
                agents={displayAgents}
                selectedAgentId={selectedAgentId || undefined}
                classificationAgencyId={classificationAgencyId}
                canEditClassifications={canEditStateClassifications}
              />
            )}
          </div>
        </section>

        <aside className="min-h-0 bg-v2-card rounded-lg border border-v2-ring dark:border-v2-ring overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-v2-ring dark:border-v2-ring">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-3.5 w-3.5 text-v2-ink-subtle" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-v2-ink dark:text-v2-ink">
                Selected Agent
              </h2>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {selectedAgent ? (
                <>
                  <div className="rounded-lg border border-v2-ring dark:border-v2-ring bg-v2-canvas/80 dark:bg-v2-card/40 p-3 space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-v2-ink dark:text-v2-ink">
                        {[selectedAgent.first_name, selectedAgent.last_name]
                          .filter(Boolean)
                          .join(" ") || selectedAgent.email}
                      </p>
                      <p className="text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle break-all">
                        {selectedAgent.email}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedAgent.id === currentProfile?.id ? (
                        <Badge variant="info" size="sm">
                          Me
                        </Badge>
                      ) : (
                        <Badge variant="secondary" size="sm">
                          {selectedAgent.hierarchy_depth &&
                          selectedAgent.hierarchy_depth > 1
                            ? `Downline L${selectedAgent.hierarchy_depth}`
                            : "Direct Downline"}
                        </Badge>
                      )}
                      {selectedAgent.agency_id && (
                        <Badge variant="outline" size="sm">
                          Agency
                        </Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-v2-ink-muted dark:text-v2-ink-subtle space-y-1">
                      <p>
                        View mode affects the center workspace only. Contract
                        toggles always apply to this selected agent.
                      </p>
                      {classificationAgencyId &&
                        activeTab === "state-licenses" && (
                          <p>
                            State color classifications use the selected
                            agent&apos;s agency
                            {canEditStateClassifications
                              ? "."
                              : " (view-only outside your agency unless admin)."}
                          </p>
                        )}
                    </div>
                  </div>

                  <AgentCarrierContractsCard
                    agentId={selectedAgent.id}
                    title="Carrier Contracts"
                    description="Toggle whether this agent currently has an active carrier contract. Uplines can manage visible downline contracts."
                  />
                </>
              ) : (
                <div className="py-8 text-center text-[11px] text-v2-ink-muted dark:text-v2-ink-subtle">
                  Select an agent to view contract toggles and details
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
