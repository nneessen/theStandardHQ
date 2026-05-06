// src/features/the-standard-team/TheStandardTeamPage.tsx
// Writing numbers workspace (legacy route path: /the-standard-team)

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Network, UserSquare2, Users, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { UpgradePrompt } from "@/components/subscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUserProfile } from "@/hooks/admin";
import { useTheStandardAgents } from "./hooks/useTheStandardAgents";
import {
  LICENSING_WORKSPACE_PAID_FEATURE,
  LICENSING_WORKSPACE_TRIAL_DAYS,
  useLicensingWorkspaceAccess,
} from "./hooks/useLicensingWorkspaceAccess";
import { MyWritingNumbersView } from "./components/MyWritingNumbersView";
import { TeamWritingNumbersOverview } from "./components/TeamWritingNumbersOverview";
import { AgentDetailView } from "./components/AgentDetailView";
import { WritingNumbersMatrixView } from "./components/WritingNumbersMatrixView";

type ViewMode = "my" | "team" | "agent-detail" | "compare";

interface TheStandardTeamPageProps {
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

export function TheStandardTeamRoutePage() {
  const access = useLicensingWorkspaceAccess();

  if (access.isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] p-3">
        <div className="h-full rounded-lg border border-border bg-card flex items-center justify-center">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking workspace access...
          </div>
        </div>
      </div>
    );
  }

  if (!access.hasAccess) {
    const trialEndedOn = formatAccessDate(access.trialEndsAt);

    return (
      <div className="h-[calc(100vh-4rem)] p-3">
        <div className="h-full rounded-lg border border-border bg-card p-4 md:p-6 overflow-auto">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="text-sm font-semibold text-foreground">
                    Writing Numbers Workspace
                  </h1>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Free for {LICENSING_WORKSPACE_TRIAL_DAYS} days, then
                    requires a Pro or Team plan.
                  </p>
                </div>
                <Badge variant="outline" size="sm">
                  Trial Ended
                </Badge>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground space-y-1">
                {trialEndedOn && (
                  <p>Your free workspace access ended on {trialEndedOn}.</p>
                )}
                <p>
                  Free carrier contract toggles are still available in Settings
                  &rarr; Profile.
                </p>
                <p>
                  Pro/Team unlocks the team writing-numbers view so you can see
                  carrier coverage across your downlines at a glance.
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
              title="Unlock the Team Writing Numbers Workspace"
              description="See which carriers each downline has writing numbers for, drill into one agent at a time, and keep contract toggles synced — all in one hierarchy-scoped workspace."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <TheStandardTeamPage
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

export function TheStandardTeamPage({ trialBanner }: TheStandardTeamPageProps) {
  const {
    data: agents = [],
    isLoading: agentsLoading,
    error: agentsError,
  } = useTheStandardAgents();
  const { data: currentProfile } = useCurrentUserProfile();

  const isUpline = useMemo(
    () =>
      currentProfile?.id
        ? agents.some((agent) => agent.id !== currentProfile.id)
        : false,
    [agents, currentProfile?.id],
  );

  const [view, setView] = useState<ViewMode>("my");
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);

  const detailAgent =
    view === "agent-detail" && detailAgentId
      ? agents.find((agent) => agent.id === detailAgentId)
      : null;

  const handleSelectAgent = (agentId: string) => {
    setDetailAgentId(agentId);
    setView("agent-detail");
  };

  const handleBackToTeam = () => {
    setView("team");
    setDetailAgentId(null);
  };

  const trialEndsOn = formatAccessDate(trialBanner?.endsAt ?? null);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 gap-2.5">
      {trialBanner && (
        <div className="rounded-md border border-border border-l-4 border-l-warning bg-card px-3 py-2">
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
              <p className="mt-1 text-[11px] font-medium text-foreground">
                Try the team writing-numbers workspace while your trial is
                active.
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                See your team&apos;s coverage at a glance, drill into a single
                agent, or compare side-by-side. After the trial
                {trialEndsOn ? ` (ends ${trialEndsOn})` : ""}, this requires a
                Pro or Team plan. Free carrier contract toggles remain in
                Settings &rarr; Profile.
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

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-card rounded-lg px-3 py-2 border border-border">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-foreground" />
          <h1 className="text-sm font-semibold text-foreground">
            Writing Numbers
          </h1>
        </div>

        {view !== "agent-detail" && (
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <ViewModeButton
              active={view === "my"}
              onClick={() => setView("my")}
              icon={UserSquare2}
              label="My numbers"
            />
            {isUpline && (
              <ViewModeButton
                active={view === "team"}
                onClick={() => setView("team")}
                icon={Users}
                label="Team"
              />
            )}
            {isUpline && (
              <ViewModeButton
                active={view === "compare"}
                onClick={() => setView("compare")}
                icon={LayoutGrid}
                label="Compare"
              />
            )}
          </div>
        )}
      </div>

      <section className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
        {agentsLoading ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading agents...
            </div>
          </div>
        ) : agentsError ? (
          <div className="h-full flex items-center justify-center p-4">
            <p className="text-[11px] text-destructive">
              Failed to load agents: {agentsError.message}
            </p>
          </div>
        ) : view === "my" && currentProfile?.id ? (
          <MyWritingNumbersView agentId={currentProfile.id} />
        ) : view === "team" ? (
          <TeamWritingNumbersOverview
            agents={agents}
            currentUserId={currentProfile?.id}
            onSelectAgent={handleSelectAgent}
          />
        ) : view === "agent-detail" && detailAgent ? (
          <AgentDetailView
            agent={detailAgent}
            isSelf={detailAgent.id === currentProfile?.id}
            onBack={handleBackToTeam}
          />
        ) : view === "compare" ? (
          <WritingNumbersMatrixView agents={agents} />
        ) : (
          <div className="h-full flex items-center justify-center p-4">
            <p className="text-[11px] text-muted-foreground">
              Select a view above to get started.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

interface ViewModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: typeof UserSquare2;
  label: string;
}

function ViewModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: ViewModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium rounded transition-all",
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
