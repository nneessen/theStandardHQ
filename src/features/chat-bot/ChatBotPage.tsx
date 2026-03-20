// src/features/chat-bot/ChatBotPage.tsx
// Main page with tab layout for AI Chat Bot management

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Bot,
  Settings,
  MessageSquare,
  Calendar,
  Activity,
  Loader2,
  CreditCard,
  Lock,
  AlertTriangle,
  RefreshCw,
  WifiOff,
  TrendingUp,
  BarChart3,
  HeartPulse,
  BookOpen,
  Power,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useChatBotAgent,
  useUpdateBotConfig,
  useProvisionTeamBot,
  useIsOnExemptTeam,
  ChatBotApiError,
  type ChatBotAgent,
} from "./hooks/useChatBot";
import { useUserActiveAddons } from "@/hooks/subscription";
import { useImo } from "@/contexts/ImoContext";
import { useQueryClient } from "@tanstack/react-query";
// eslint-disable-next-line no-restricted-imports
import { subscriptionService } from "@/services/subscription";
import { ChatBotLanding } from "./components/ChatBotLanding";
import { SetupWizard } from "./components/SetupWizard";
import { SetupTab } from "./components/SetupTab";
import { ConversationsTab } from "./components/ConversationsTab";
import { AppointmentsTab } from "./components/AppointmentsTab";
import { UsageTab } from "./components/UsageTab";
import { AllBotsTab } from "./components/AllBotsTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { MonitoringTab } from "./components/MonitoringTab";
import { SetupGuideTab } from "./components/SetupGuideTab";
import { ChatBotOverviewTab } from "./components/ChatBotOverviewTab";
import { AdminTab } from "./components/AdminTab";

type TabId =
  | "overview"
  | "plans"
  | "guide"
  | "all-bots"
  | "setup"
  | "conversations"
  | "appointments"
  | "usage"
  | "analytics"
  | "monitoring"
  | "admin";

// Read initial tab from URL search params (e.g., after Calendly OAuth redirect with ?tab=setup)
// NOTE: Do NOT call history.replaceState here — it triggers TanStack Router's Transitioner
// during render, breaking event handlers. URL cleanup is done in a useEffect instead.
function getInitialTab(): TabId {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  if (
    tab === "plans" ||
    tab === "setup" ||
    tab === "guide" ||
    tab === "all-bots" ||
    tab === "conversations" ||
    tab === "appointments" ||
    tab === "usage" ||
    tab === "analytics" ||
    tab === "monitoring" ||
    tab === "admin"
  ) {
    return tab;
  }
  return "overview";
}

function isSetupComplete(agent: ChatBotAgent): boolean {
  const closeConnected = agent.connections?.close?.connected || false;
  const calendarConnected =
    agent.connections?.calendly?.connected ||
    false ||
    agent.connections?.google?.connected ||
    false;
  const hasLeadSources = (agent.autoOutreachLeadSources?.length ?? 0) > 0;
  const hasLeadStatuses = (agent.allowedLeadStatuses?.length ?? 0) > 0;
  return (
    closeConnected && calendarConnected && hasLeadSources && hasLeadStatuses
  );
}

function getWizardDoneKey(agentId: string): string {
  return `chatbot_wizard_done_${agentId}`;
}

export function ChatBotPage() {
  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const { isSuperAdmin } = useImo();
  const { data: isOnExemptTeam = false } = useIsOnExemptTeam();
  const isTeamMember = isOnExemptTeam || isSuperAdmin;
  const { activeAddons, isLoading: addonsLoading } = useUserActiveAddons();
  const chatBotAddon = activeAddons.find(
    (a) => a.addon?.name === "ai_chat_bot",
  );
  const hasAddon = !!chatBotAddon;
  const hasAccess = hasAddon || isTeamMember;
  const currentTierId = chatBotAddon?.tier_id || null;
  const {
    data: agent,
    isLoading: agentLoading,
    error: agentError,
    refetch: refetchAgent,
  } = useChatBotAgent(hasAccess);
  const isServiceError =
    agentError instanceof ChatBotApiError && agentError.isServiceError;

  const isLoading = addonsLoading || (hasAccess && agentLoading);
  const provisionTeamBot = useProvisionTeamBot();
  const updateConfig = useUpdateBotConfig();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  // Retry provisioning when addon exists but agent is missing/failed
  const handleRetryProvision = useCallback(async () => {
    if (!chatBotAddon?.addon_id || !currentTierId || retrying) return;
    setRetrying(true);
    try {
      const result = await subscriptionService.addSubscriptionAddon(
        chatBotAddon.addon_id,
        currentTierId,
      );
      if (result.success) {
        toast.success("Bot provisioning started! Refreshing...");
        queryClient.invalidateQueries({ queryKey: ["chat-bot"] });
      } else {
        toast.error(result.error || "Provisioning failed. Please try again.");
      }
    } catch {
      toast.error("Provisioning failed. Please try again later.");
    } finally {
      setRetrying(false);
    }
  }, [chatBotAddon?.addon_id, currentTierId, retrying, queryClient]);

  // Clean URL params after mount and show success toasts for OAuth callbacks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar") === "connected") {
      toast.success("Calendar connected successfully!");
    } else if (params.get("error")) {
      toast.error(`Calendar connection failed: ${params.get("error")}`);
    }
    if (params.has("tab") || params.has("calendar") || params.has("error")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      url.searchParams.delete("calendar");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + (url.search || ""));
    }
  }, []);

  // Track previous hasAddon to detect when user just subscribed
  const prevHasAddon = useRef(hasAddon);
  useEffect(() => {
    if (!prevHasAddon.current && hasAddon && agent) {
      // User just subscribed — switch to setup tab
      setActiveTab("setup");
    }
    prevHasAddon.current = hasAddon;
  }, [hasAddon, agent]);

  // Check if wizard was completed (persisted in localStorage)
  const wizardDone = agent
    ? localStorage.getItem(getWizardDoneKey(agent.id)) === "true"
    : false;

  const setupComplete = agent ? isSetupComplete(agent) : false;

  const handleWizardComplete = useCallback(() => {
    if (agent) {
      localStorage.setItem(getWizardDoneKey(agent.id), "true");
      window.location.reload();
    }
  }, [agent]);

  // Callback for when user purchases a plan — switch to setup tab
  const handlePlanActivated = useCallback(() => {
    setActiveTab("setup");
  }, []);

  // Build visible tabs based on state
  const tabs: {
    id: TabId;
    label: string;
    icon: React.ElementType;
    locked?: boolean;
  }[] = [
    { id: "overview", label: "Overview", icon: Sparkles },
    { id: "plans", label: "Plans", icon: CreditCard },
    { id: "guide", label: "Setup Guide", icon: BookOpen },
    { id: "all-bots", label: "All Bots", icon: TrendingUp },
    {
      id: "setup",
      label: "Bot Configuration",
      icon: Settings,
      locked: !hasAccess,
    },
  ];

  // Only show dashboard tabs when setup is complete
  if (hasAccess && agent && (setupComplete || wizardDone)) {
    tabs.push(
      { id: "conversations", label: "Conversations", icon: MessageSquare },
      { id: "appointments", label: "Appointments", icon: Calendar },
      { id: "usage", label: "Usage", icon: Activity },
      { id: "analytics", label: "My Analytics", icon: BarChart3 },
    );
    if (isSuperAdmin) {
      tabs.push({ id: "monitoring", label: "Monitoring", icon: HeartPulse });
    }
  }

  // Super-admin panel — always visible, no access/agent requirement
  if (isSuperAdmin) {
    tabs.push({ id: "admin", label: "Admin Panel", icon: ShieldCheck });
  }

  // Status badge
  const statusBadge = !hasAccess ? null : !agent ? null : setupComplete ||
    wizardDone ? (
    agent.botEnabled ? (
      <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
        Active
      </Badge>
    ) : (
      <Badge
        variant="secondary"
        className="text-[9px] h-4 px-1.5 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      >
        Inactive
      </Badge>
    )
  ) : (
    <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
      Setup Required
    </Badge>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5 bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
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
                id="cb-grid"
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
            <rect width="100%" height="100%" fill="url(#cb-grid)" />
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
              <Bot className="h-4 w-4 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white dark:text-black tracking-tight">
                AI Chat Bot
              </h1>
              <p className="text-[10px] text-white/50 dark:text-black/40">
                SMS appointment setter powered by AI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge}
            {hasAccess &&
              agent &&
              (setupComplete || wizardDone) &&
              !agent.botEnabled && (
                <Button
                  size="sm"
                  className="h-7 px-4 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all animate-pulse"
                  disabled={updateConfig.isPending}
                  onClick={() => updateConfig.mutate({ botEnabled: true })}
                >
                  {updateConfig.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Power className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Enable Bot
                </Button>
              )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-md p-0.5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (!tab.locked) setActiveTab(tab.id);
            }}
            className={cn(
              "flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded transition-all whitespace-nowrap flex-shrink-0",
              tab.locked
                ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                : activeTab === tab.id
                  ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
            )}
            title={tab.locked ? "Choose a plan first" : undefined}
          >
            {tab.locked ? (
              <Lock className="h-3 w-3" />
            ) : (
              <tab.icon className="h-3 w-3" />
            )}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview tab — SaaS marketing + live metrics */}
        {activeTab === "overview" && (
          <ChatBotOverviewTab
            hasAccess={hasAccess}
            agent={agent}
            setupComplete={setupComplete}
            wizardDone={wizardDone}
            isTeamMember={isTeamMember}
            currentTierId={currentTierId}
            onNavigateToTab={(tabId) => setActiveTab(tabId as TabId)}
          />
        )}

        {/* Plans tab — plan selection + info */}
        {activeTab === "plans" && (
          <ChatBotLanding
            currentTierId={currentTierId}
            onPlanActivated={handlePlanActivated}
            isTeamMember={isTeamMember}
            isBillingExempt={agent?.billingExempt === true}
          />
        )}

        {/* Setup tab — locked, wizard, or full config */}
        {activeTab === "setup" &&
          (!hasAccess ? (
            /* No addon and not a team member — prompt to choose a plan */
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                <Lock className="h-5 w-5 text-zinc-400" />
              </div>
              <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                Choose a Plan First
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center max-w-xs mb-4">
                Select a plan on the &quot;Plans&quot; tab to unlock bot
                configuration. You can start with the free plan — no credit card
                required.
              </p>
              <button
                onClick={() => setActiveTab("plans")}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Go to Plans
              </button>
            </div>
          ) : !agent ? (
            isTeamMember && !hasAddon ? (
              /* Team member who hasn't provisioned yet */
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-3">
                  <Bot className="h-5 w-5 text-indigo-500" />
                </div>
                <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Load Your Team Bot
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center max-w-xs mb-4">
                  Free team access is available for your account. If you already
                  have a configured bot, this reconnects it instead of creating
                  a duplicate.
                </p>
                <Button
                  size="sm"
                  className="h-8 px-4 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={provisionTeamBot.isPending}
                  onClick={() =>
                    provisionTeamBot.mutate(undefined, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({
                          queryKey: ["chat-bot"],
                        });
                      },
                    })
                  }
                >
                  {provisionTeamBot.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {provisionTeamBot.isPending ? "Loading..." : "Load Team Bot"}
                </Button>
              </div>
            ) : isServiceError ? (
              /* External bot service is down — show service unavailable */
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mb-3">
                  <WifiOff className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Service Temporarily Unavailable
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center max-w-xs mb-4">
                  The bot service is experiencing issues. Your configuration is
                  safe — please try again in a few minutes.
                </p>
                <button
                  onClick={() => refetchAgent()}
                  disabled={agentLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {agentLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {agentLoading ? "Checking..." : "Try Again"}
                </button>
              </div>
            ) : (
              /* Addon active but agent provisioning failed — show retry */
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                </div>
                <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Bot Setup Incomplete
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center max-w-xs mb-4">
                  Your plan is active but the bot couldn&apos;t be provisioned.
                  Click below to retry.
                </p>
                <button
                  onClick={handleRetryProvision}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {retrying ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {retrying ? "Provisioning..." : "Retry Setup"}
                </button>
              </div>
            )
          ) : !(setupComplete || wizardDone) ? (
            /* Wizard — step-by-step configuration */
            <SetupWizard agent={agent} onComplete={handleWizardComplete} />
          ) : (
            /* Full config dashboard */
            <SetupTab />
          ))}

        {/* Setup Guide — always visible, fully static */}
        {activeTab === "guide" && <SetupGuideTab />}

        {/* All Bots — always visible to all users */}
        {activeTab === "all-bots" && (
          <AllBotsTab
            onNavigateToSubscription={
              !hasAccess ? () => setActiveTab("plans") : undefined
            }
          />
        )}

        {/* Dashboard tabs — only rendered when visible */}
        {activeTab === "conversations" && <ConversationsTab />}
        {activeTab === "appointments" && <AppointmentsTab />}
        {activeTab === "usage" && <UsageTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "monitoring" && <MonitoringTab />}
        {activeTab === "admin" && <AdminTab />}
      </div>
    </div>
  );
}
