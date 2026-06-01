// src/features/channel-orchestration/ChannelOrchestrationPage.tsx
import { useState } from "react";
import {
  AlertTriangle,
  Construction,
  Network,
  ListChecks,
  PhoneOutgoing,
  History,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";
import { useChatBotAgent, useIsOnExemptTeam } from "@/features/chat-bot";
import { useUserActiveAddons } from "@/hooks/subscription";
import { useImo } from "@/contexts/ImoContext";
import { RulesTab } from "./components/rules/RulesTab";
import { PostCallTab } from "./components/post-call/PostCallTab";
import { VoiceSessionsTab } from "./components/sessions/VoiceSessionsTab";

type TabId = "rules" | "post-call" | "sessions";

const TABS: { id: TabId; label: string; icon: typeof Network }[] = [
  { id: "rules", label: "Rules", icon: ListChecks },
  { id: "post-call", label: "Post-Call Actions", icon: PhoneOutgoing },
  { id: "sessions", label: "Voice Sessions", icon: History },
];

export function ChannelOrchestrationPage() {
  const [activeTab, setActiveTab] = useState<TabId>("rules");
  const { isSuperAdmin } = useImo();
  const { activeAddons, isLoading: addonsLoading } = useUserActiveAddons();
  const { data: isOnExemptTeam = false } = useIsOnExemptTeam();

  const chatBotAddon = activeAddons.find(
    (a) => a.addon?.name === "ai_chat_bot",
  );
  const voiceAddon = activeAddons.find(
    (a) => a.addon?.name === "premium_voice",
  );
  const hasAccess =
    !!chatBotAddon || !!voiceAddon || isSuperAdmin || isOnExemptTeam;

  const {
    data: agent,
    isLoading: agentLoading,
    error: agentError,
  } = useChatBotAgent(hasAccess);

  // Loading state
  if (addonsLoading || agentLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-v2-canvas dark:bg-v2-canvas">
        <Loader2 className="h-5 w-5 animate-spin text-v2-ink-subtle" />
      </div>
    );
  }

  // No access — direct to chat bot or voice agent setup
  if (!hasAccess) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 bg-v2-canvas dark:bg-v2-canvas">
        <Network className="h-10 w-10 text-v2-ink-subtle dark:text-v2-ink-muted mb-3" />
        <h2 className="text-sm font-semibold text-v2-ink dark:text-v2-ink-muted mb-1">
          Channel Orchestration
        </h2>
        <p className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle text-center max-w-sm">
          Configure SMS + Voice routing rules for your leads. Requires an AI
          Chat Bot or Premium Voice subscription.
        </p>
      </div>
    );
  }

  // Agent not provisioned
  if (!agent) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 bg-v2-canvas dark:bg-v2-canvas">
        <Network className="h-10 w-10 text-v2-ink-subtle dark:text-v2-ink-muted mb-3" />
        <h2 className="text-sm font-semibold text-v2-ink dark:text-v2-ink-muted mb-1">
          Set Up Your Bot First
        </h2>
        <p className="text-xs text-v2-ink-muted dark:text-v2-ink-subtle text-center max-w-sm">
          {agentError
            ? "Unable to reach the bot service. Please try again later."
            : "Visit the Chat Bot or Voice Agent page to provision your agent before configuring channel rules."}
        </p>
      </div>
    );
  }

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* header */}
          <header style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Cap>CHANNELS</Cap>
            <h1
              style={{
                font: `800 26px ${T.disp}`,
                color: T.ink,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: 0,
              }}
            >
              Orchestrator
            </h1>
          </header>

          {/* Channel availability warning */}
          {!agent.botEnabled && !agent.voiceEnabled && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 dark:border-destructive dark:bg-destructive/15">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-[10px] text-destructive">
                Both SMS Bot and Voice Agent are disabled. Orchestration rules
                will not be evaluated until at least one channel is active.
              </p>
            </div>
          )}

          {/* Per-tab status banners */}
          {activeTab === "rules" && (
            <div className="flex items-center gap-3 rounded-lg border border-info/30 bg-info/10 px-4 py-2 dark:border-info dark:bg-info/10">
              <ListChecks className="h-3.5 w-3.5 shrink-0 text-info" />
              <p className="text-[10px] text-info">
                Rules are evaluated in real-time for SMS and voice channels.
                {!agent.voiceEnabled &&
                  " Voice Agent is not active — voice-only rules will have no effect."}
                {!agent.botEnabled &&
                  " SMS Bot is not active — SMS-only rules will have no effect."}
              </p>
            </div>
          )}
          {activeTab === "post-call" && (
            <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 dark:border-warning dark:bg-warning/15">
              <Construction className="h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-[10px] text-warning">
                Configuration is saved. Automatic post-call execution requires
                backend Retell integration (coming soon).
              </p>
            </div>
          )}
          {activeTab === "sessions" && (
            <div className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 dark:border-warning dark:bg-warning/15">
              <Construction className="h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-[10px] text-warning">
                Voice session history depends on backend call recording
                integration.
              </p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-0.5 bg-v2-card-tinted dark:bg-v2-card-tinted/50 rounded-md p-0.5 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded transition-all whitespace-nowrap flex-shrink-0",
                  activeTab === tab.id
                    ? "bg-v2-card shadow-sm text-v2-ink dark:text-v2-ink"
                    : "text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink dark:hover:text-v2-ink-subtle",
                )}
              >
                <tab.icon className="h-3 w-3" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "rules" && <RulesTab />}
            {activeTab === "post-call" && <PostCallTab />}
            {activeTab === "sessions" && <VoiceSessionsTab />}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
