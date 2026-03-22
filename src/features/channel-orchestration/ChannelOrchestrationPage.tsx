// src/features/channel-orchestration/ChannelOrchestrationPage.tsx
import { useState } from "react";
import {
  Construction,
  Network,
  ListChecks,
  PhoneOutgoing,
  History,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  // No access — direct to chat bot or voice agent setup
  if (!hasAccess) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <Network className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
          Channel Orchestration
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center max-w-sm">
          Configure SMS + Voice routing rules for your leads. Requires an AI
          Chat Bot or Premium Voice subscription.
        </p>
      </div>
    );
  }

  // Agent not provisioned
  if (!agent) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <Network className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
          Set Up Your Bot First
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center max-w-sm">
          {agentError
            ? "Unable to reach the bot service. Please try again later."
            : "Visit the Chat Bot or Voice Agent page to provision your agent before configuring channel rules."}
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5 bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-foreground">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="co-grid"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#co-grid)" />
          </svg>
        </div>
        <div
          className="absolute top-1/3 -left-16 w-64 h-64 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(59,130,246,0.12)" }}
        />
        <div
          className="absolute bottom-0 -right-16 w-48 h-48 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(139,92,246,0.08)" }}
        />
        <div className="relative px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
              style={{ backgroundColor: "rgba(59,130,246,0.2)" }}
            >
              <Network className="h-4 w-4 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white dark:text-black tracking-tight">
                Channel Orchestration
              </h1>
              <p className="text-[10px] text-white/50 dark:text-black/40">
                SMS + Voice routing rules, post-call actions, voice session
                history
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Under Construction Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 dark:border-amber-700 dark:bg-amber-950/30">
        <Construction className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
            Under Construction
          </p>
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            Channel Orchestration is actively being built. Rules, post-call
            actions, and session history are not yet functional.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-md p-0.5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded transition-all whitespace-nowrap flex-shrink-0",
              activeTab === tab.id
                ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
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
  );
}
