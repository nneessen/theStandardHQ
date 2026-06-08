// src/features/the-standard-team/WritingNumbersTab.tsx
// Body-only "Writing Numbers" tab for the Licensing hub. Owns the Pro/Team
// paywall gate (useLicensingWorkspaceAccess) and the My/Team/Compare switcher.
// The hub provides the outer SectionShell + page header, so this renders body only.

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, UserSquare2, Users, LayoutGrid, IdCard } from "lucide-react";
import { UpgradePrompt } from "@/components/subscription";
import { Button } from "@/components/ui/button";
import { NEW_SUBSCRIPTIONS_ENABLED } from "@/lib/subscription/subscription-availability";
import { useCurrentUserProfile } from "@/hooks/admin";
import { Board, Cap, EmptyState, Pill, T } from "@/components/board";
import {
  LICENSING_WORKSPACE_PAID_FEATURE,
  LICENSING_WORKSPACE_TRIAL_DAYS,
  useLicensingWorkspaceAccess,
} from "./hooks/useLicensingWorkspaceAccess";
import { MyWritingNumbersView } from "./components/MyWritingNumbersView";
import { TeamWritingNumbersOverview } from "./components/TeamWritingNumbersOverview";
import { AgentDetailView } from "./components/AgentDetailView";
import { WritingNumbersMatrixView } from "./components/WritingNumbersMatrixView";
import { useTheStandardAgents } from "./hooks/useTheStandardAgents";

type ViewMode = "my" | "team" | "agent-detail" | "compare";

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

export function WritingNumbersTab() {
  const access = useLicensingWorkspaceAccess();

  if (access.isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          font: `500 12px ${T.data}`,
          color: T.mut,
        }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking workspace access…
      </div>
    );
  }

  if (!access.hasAccess) {
    const trialEndedOn = formatAccessDate(access.trialEndsAt);
    return (
      <div style={{ height: "100%", overflowY: "auto", padding: 16 }}>
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          <Board pad={20}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <Cap>Writing Numbers</Cap>
                <p
                  style={{
                    font: `500 12px ${T.data}`,
                    color: T.mut,
                    marginTop: 6,
                  }}
                >
                  Free for {LICENSING_WORKSPACE_TRIAL_DAYS} days, then requires
                  a Pro or Team plan.
                </p>
              </div>
              <Pill tone="amber">Trial Ended</Pill>
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                font: `500 12px ${T.data}`,
                color: T.mut,
              }}
            >
              {trialEndedOn && (
                <p style={{ margin: 0 }}>
                  Your free workspace access ended on {trialEndedOn}.
                </p>
              )}
              <p style={{ margin: 0 }}>
                Free carrier contract toggles are still available in Settings
                &rarr; Profile.
              </p>
              <p style={{ margin: 0 }}>
                Pro/Team unlocks the team writing-numbers view so you can see
                carrier coverage across your downlines at a glance.
              </p>
            </div>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <Link to="/settings" search={{ tab: "profile" }}>
                <Button type="button" variant="outline" size="sm">
                  Go to Settings Profile
                </Button>
              </Link>
              {NEW_SUBSCRIPTIONS_ENABLED && (
                <Link to="/billing">
                  <Button type="button" size="sm">
                    Upgrade to Pro or Team
                  </Button>
                </Link>
              )}
            </div>
          </Board>

          <UpgradePrompt
            feature={LICENSING_WORKSPACE_PAID_FEATURE}
            variant="card"
            title="Unlock the Team Writing Numbers Workspace"
            description="See which carriers each downline has writing numbers for, drill into one agent at a time, and keep contract toggles synced — all in one hierarchy-scoped workspace."
          />
        </div>
      </div>
    );
  }

  return (
    <WritingNumbersBody
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

interface WritingNumbersBodyProps {
  trialBanner?: { daysRemaining: number; endsAt: string | null };
}

function WritingNumbersBody({ trialBanner }: WritingNumbersBodyProps) {
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
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 16,
        minHeight: 0,
      }}
    >
      {/* sub-view switcher */}
      {view !== "agent-detail" && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              background: T.tile,
              borderRadius: 9,
              padding: 3,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
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
        </div>
      )}

      {trialBanner && (
        <Board
          pad={14}
          rivets={false}
          style={{ borderLeft: `3px solid ${T.amber}` }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <Pill tone="amber">7-Day Trial</Pill>
                <Pill tone="amber" style={{ background: "transparent" }}>
                  {trialBanner.daysRemaining} day
                  {trialBanner.daysRemaining === 1 ? "" : "s"} left
                </Pill>
              </div>
              <p
                style={{
                  font: `500 11px ${T.data}`,
                  color: T.mut,
                  marginTop: 6,
                }}
              >
                Try the team writing-numbers workspace while your trial is
                active. After the trial
                {trialEndsOn ? ` (ends ${trialEndsOn})` : ""}, this requires a
                Pro or Team plan. Free carrier contract toggles remain in
                Settings &rarr; Profile.
              </p>
            </div>
            <Link to="/billing">
              <Button type="button" size="sm" className="h-7 px-2 text-[10px]">
                View Pro/Team Plans
              </Button>
            </Link>
          </div>
        </Board>
      )}

      <Board
        pad={0}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {agentsLoading ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              font: `500 12px ${T.data}`,
              color: T.mut,
            }}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading agents…
          </div>
        ) : agentsError ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EmptyState
              icon={<IdCard size={20} />}
              title="Failed to load agents"
              hint={agentsError.message}
              pad={40}
            />
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
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: `500 12px ${T.data}`,
              color: T.mut,
            }}
          >
            Select a view above to get started.
          </div>
        )}
      </Board>
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 7,
        border: "none",
        cursor: "pointer",
        font: `700 12px ${T.mono}`,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: active ? "rgba(91,155,255,0.16)" : "transparent",
        color: active ? T.blue : T.mut,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
