// src/features/messages/MessagesPage.tsx
// Communications Hub - Redesigned with zinc palette and compact design patterns

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PillNav, PillButton } from "@/components/v2";
import { MessagesLayout } from "./components/layout/MessagesLayout";
import { ThreadList } from "./components/inbox/ThreadList";
import { ThreadView } from "./components/thread/ThreadView";
import { ComposeDialog } from "./components/compose/ComposeDialog";
import { useEmailQuota } from "./hooks/useSendEmail";
import { useFolderCounts } from "./hooks/useFolderCounts";
import {
  Inbox,
  Send,
  FileText,
  BarChart3,
  Settings,
  Search,
  PenSquare,
  Star,
  Archive,
  Mail,
  MessageSquare,
  Instagram,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SlackTabContent, SlackSidebar } from "./components/slack";
import { InstagramTabContent, InstagramSidebar } from "./components/instagram";
import { InstagramTemplatesSettings } from "./components/instagram/templates";
import { MessagesSettingsContainer } from "./components/settings";
import { MessagingAnalyticsDashboard } from "./components/analytics";
import { useUserSlackPreferences, useSlackIntegrations } from "@/hooks/slack";
import { useUserRoles } from "@/hooks/permissions";
import { useImo } from "@/contexts/ImoContext";
import { useFeatureAccess } from "@/hooks/subscription";
import type { RoleName } from "@/types/permissions.types";
import {
  useActiveInstagramIntegration,
  useInstagramConversations,
} from "@/hooks/instagram";
import type { SlackChannel } from "@/types/slack.types";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { useResizableSidebar, useIsMobile } from "@/hooks/ui";

type TabType =
  | "email"
  | "slack"
  | "instagram"
  | "templates"
  | "analytics"
  | "settings";
type FolderType = "all" | "inbox" | "sent" | "starred" | "archived";

export function MessagesPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("email");
  const [activeFolder, setActiveFolder] = useState<FolderType>("all");
  const [selectedSlackChannel, setSelectedSlackChannel] =
    useState<SlackChannel | null>(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(null);
  const [hasAppliedDefaults, setHasAppliedDefaults] = useState(false);

  // Instagram state - store ID only, derive full object from query
  const [selectedInstagramConversationId, setSelectedInstagramConversationId] =
    useState<string | null>(null);

  // Mobile detection
  const isMobile = useIsMobile();

  // Role-based access control
  const { data: userRoles } = useUserRoles();
  const { isSuperAdmin } = useImo();

  const hasRole = (role: RoleName) => {
    return userRoles?.includes(role) || false;
  };

  // Staff-only: has trainer/contracting_manager but NOT agent/admin
  const isStaffOnlyUser =
    !isSuperAdmin &&
    (hasRole("trainer" as RoleName) ||
      hasRole("contracting_manager" as RoleName)) &&
    !hasRole("agent" as RoleName) &&
    !hasRole("admin" as RoleName);

  // Feature access checks for messaging tabs
  const { hasAccess: hasEmailAccess } = useFeatureAccess("email");
  const { hasAccess: hasSlackAccess } = useFeatureAccess("slack");
  const { hasAccess: hasInstagramAccess } = useFeatureAccess(
    "instagram_messaging",
  );
  const { hasAccess: hasTemplatesAccess } = useFeatureAccess(
    "instagram_templates",
  );

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Handle Instagram OAuth callback query params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const instagramStatus = urlParams.get("instagram");
    const account = urlParams.get("account");
    const reason = urlParams.get("reason");

    if (instagramStatus === "success") {
      toast.success(`Instagram connected: @${account || "Unknown"}`);
      // Invalidate Instagram queries to refresh state
      queryClient.invalidateQueries({ queryKey: ["instagram"] });
      // Switch to Instagram tab
      setActiveTab("instagram");
      // Clean URL
      urlParams.delete("instagram");
      urlParams.delete("account");
      const newUrl =
        urlParams.toString().length > 0
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    } else if (instagramStatus === "error") {
      const errorMessages: Record<string, string> = {
        config: "Server configuration error. Contact support.",
        missing_params: "OAuth failed - missing parameters.",
        invalid_state: "Session expired. Please try again.",
        expired: "OAuth session expired. Please try again.",
        token_exchange: "Failed to connect Instagram. Try again.",
        long_lived_token: "Failed to get long-term access. Try again.",
        profile_fetch: "Could not fetch Instagram profile.",
        save_failed: "Failed to save connection. Try again.",
        unexpected: "Unexpected error occurred.",
      };
      toast.error(
        errorMessages[reason || ""] ||
          `Instagram connection failed: ${reason || "Unknown error"}`,
      );
      // Clean URL
      urlParams.delete("instagram");
      urlParams.delete("reason");
      urlParams.delete("details");
      const newUrl =
        urlParams.toString().length > 0
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [queryClient]);

  // Get email quota
  const { remainingDaily, percentUsed, quota } = useEmailQuota();

  // Get user's Slack preferences and all integrations
  const { data: userSlackPrefs } = useUserSlackPreferences();
  const { data: integrations = [] } = useSlackIntegrations();
  const connectedIntegrations = integrations.filter((i) => i.isConnected);

  // Get active Instagram integration
  const { data: instagramIntegration } = useActiveInstagramIntegration();

  // Get Instagram conversations - used to derive selected conversation from ID
  // This ensures the conversation object updates when query cache is invalidated
  const { data: instagramConversations = [] } = useInstagramConversations(
    instagramIntegration?.id,
    {},
  );

  // Derive selected conversation from query data (not stale state)
  const selectedInstagramConversation = selectedInstagramConversationId
    ? (instagramConversations.find(
        (c) => c.id === selectedInstagramConversationId,
      ) ?? null)
    : null;

  // Initialize selected integration from user preferences or first available
  useEffect(() => {
    if (!hasAppliedDefaults && connectedIntegrations.length > 0) {
      // Set workspace from preferences or first available
      const preferredIntegrationId =
        userSlackPrefs?.default_view_integration_id;
      const targetIntegration = preferredIntegrationId
        ? connectedIntegrations.find((i) => i.id === preferredIntegrationId)
        : null;
      const integrationToUse = targetIntegration || connectedIntegrations[0];

      if (integrationToUse) {
        setSelectedIntegrationId(integrationToUse.id);
      }
      setHasAppliedDefaults(true);
    }
  }, [
    connectedIntegrations,
    hasAppliedDefaults,
    userSlackPrefs?.default_view_integration_id,
  ]);

  // Handle workspace change
  const handleWorkspaceChange = (integrationId: string) => {
    setSelectedIntegrationId(integrationId);
    setSelectedSlackChannel(null); // Clear channel when workspace changes
  };

  // Folder counts and unread
  const { counts, totalUnread } = useFolderCounts();

  // Resizable sidebar for Slack
  const slackSidebar = useResizableSidebar({
    storageKey: "messages-slack-sidebar-width",
    defaultWidth: 144,
    minWidth: 120,
    maxWidth: 400,
  });

  // Resizable sidebar for Instagram
  const instagramSidebar = useResizableSidebar({
    storageKey: "messages-instagram-sidebar-width",
    defaultWidth: 200,
    minWidth: 160,
    maxWidth: 400,
  });

  const handleThreadSelect = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleComposeNew = () => {
    setIsComposeOpen(true);
  };

  // Staff-only users are allowed to use built-in Email inside the Messages hub
  // even though they do not globally bypass subscription-gated messaging features.
  const hasBuiltInEmailAccess = hasEmailAccess || isStaffOnlyUser;

  // Tab configuration - filter based on role and subscription features
  const allTabs: {
    id: TabType;
    label: string;
    icon: typeof Inbox;
    hasAccess: boolean;
  }[] = [
    {
      id: "email",
      label: "Email",
      icon: Mail,
      hasAccess: hasBuiltInEmailAccess,
    },
    {
      id: "slack",
      label: "Slack",
      icon: MessageSquare,
      hasAccess: hasSlackAccess,
    },
    {
      id: "instagram",
      label: "Instagram",
      icon: Instagram,
      hasAccess: hasInstagramAccess,
    },
    {
      id: "templates",
      label: "Templates",
      icon: FileText,
      hasAccess: hasTemplatesAccess,
    },
    { id: "analytics", label: "Analytics", icon: BarChart3, hasAccess: true }, // Analytics controlled separately
    { id: "settings", label: "Settings", icon: Settings, hasAccess: true }, // Always show settings
  ];

  // Filter tabs based on:
  // 1. Subscription feature access
  // 2. Staff-only restrictions (no templates or analytics)
  const tabs = allTabs.filter((tab) => {
    // Check subscription feature access first
    if (!tab.hasAccess) return false;
    // Staff-only users cannot access templates or analytics
    if (isStaffOnlyUser && (tab.id === "templates" || tab.id === "analytics")) {
      return false;
    }
    return true;
  });

  // Redirect to first available tab if current tab is not accessible
  useEffect(() => {
    const currentTabAvailable = tabs.some((tab) => tab.id === activeTab);
    if (!currentTabAvailable && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Folder configuration
  const folders: {
    id: FolderType;
    label: string;
    icon: typeof Inbox;
    count?: number;
  }[] = [
    { id: "all", label: "All", icon: Mail, count: counts.all },
    { id: "inbox", label: "Inbox", icon: Inbox, count: counts.inbox },
    { id: "sent", label: "Sent", icon: Send, count: counts.sent },
    { id: "starred", label: "Starred", icon: Star, count: counts.starred },
    {
      id: "archived",
      label: "Archived",
      icon: Archive,
      count: counts.archived,
    },
  ];

  return (
    <>
      <div className="h-[calc(100vh-3rem)] flex flex-col gap-2">
        {/* Compact header — title + inline metric chips + search + compose, all in one row */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Mail className="h-4 w-4 text-v2-ink" />
              <h1 className="text-base font-semibold tracking-tight text-v2-ink">
                Messages
              </h1>
            </div>

            <div className="flex items-center gap-x-2 gap-y-0.5 text-[11px] text-v2-ink-muted flex-wrap leading-tight">
              <span className="inline-flex items-center gap-1">
                <Inbox className="h-3 w-3 text-blue-500" />
                <span className="text-v2-ink font-semibold">{totalUnread}</span>
                unread
              </span>
              <span className="text-v2-ink-subtle">·</span>
              <span>
                <span className="text-v2-ink font-semibold">{counts.all}</span>{" "}
                total
              </span>
              <span className="text-v2-ink-subtle">·</span>
              <span>
                <span className="text-v2-ink font-semibold">
                  {quota ? `${quota.dailyUsed}/${quota.dailyLimit}` : "0/50"}
                </span>{" "}
                quota
                <span className="text-v2-ink-subtle">
                  {" "}
                  ({remainingDaily} left)
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
              <Input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 pl-7 pr-7 text-[11px] bg-v2-card border-v2-ring rounded-v2-pill focus-visible:ring-v2-accent"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            <PillButton
              onClick={handleComposeNew}
              tone="black"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
            >
              <PenSquare className="h-3 w-3" />
              Compose
            </PillButton>
          </div>
        </header>

        {/* Tab nav — pill style, matches Leaderboard / Expenses pattern */}
        <PillNav
          size="sm"
          activeValue={activeTab}
          onChange={(v) => setActiveTab(v as typeof activeTab)}
          items={tabs.map((t) => ({ label: t.label, value: t.id }))}
          className="self-start"
        />

        {/* Content area */}
        <div className="flex-1 flex gap-2 overflow-hidden">
          {/* Left Sidebar - Context-aware based on active tab */}
          {activeTab === "slack" ? (
            /* Slack channels sidebar - resizable */
            <ResizablePanel
              width={slackSidebar.width}
              isResizing={slackSidebar.isResizing}
              onMouseDown={slackSidebar.handleMouseDown}
              className="flex flex-col overflow-hidden bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft"
            >
              <SlackSidebar
                selectedChannelId={selectedSlackChannel?.id || null}
                selectedIntegrationId={selectedIntegrationId}
                integrations={connectedIntegrations}
                onChannelSelect={setSelectedSlackChannel}
                onWorkspaceChange={handleWorkspaceChange}
              />
            </ResizablePanel>
          ) : activeTab === "instagram" && instagramIntegration ? (
            /* Instagram conversations sidebar - resizable, hidden on mobile when conversation selected */
            (!isMobile || !selectedInstagramConversation) && (
              <ResizablePanel
                width={isMobile ? 280 : instagramSidebar.width}
                isResizing={!isMobile && instagramSidebar.isResizing}
                onMouseDown={
                  isMobile ? () => {} : instagramSidebar.handleMouseDown
                }
                className="flex flex-col overflow-hidden bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft"
              >
                <InstagramSidebar
                  integration={instagramIntegration}
                  selectedConversationId={selectedInstagramConversationId}
                  onConversationSelect={(conversation) =>
                    setSelectedInstagramConversationId(conversation.id)
                  }
                />
              </ResizablePanel>
            )
          ) : activeTab === "instagram" &&
            !instagramIntegration /* No sidebar when Instagram not connected */ ? null : activeTab ===
            "email" ? (
            /* Email folders sidebar - only shown on email tab */
            <div className="w-36 flex-shrink-0 flex flex-col overflow-hidden bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
              <div className="p-2 flex-1 flex flex-col min-h-0 overflow-auto">
                <div className="text-[10px] font-medium text-v2-ink-muted uppercase tracking-wide px-2 mb-1.5">
                  Folders
                </div>
                <div className="space-y-0.5">
                  {folders.map((folder) => {
                    const Icon = folder.icon;
                    const isActive = activeFolder === folder.id;
                    return (
                      <button
                        key={folder.id}
                        onClick={() => setActiveFolder(folder.id)}
                        className={cn(
                          "w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] transition-colors",
                          isActive
                            ? "bg-v2-ring text-v2-ink font-medium"
                            : "text-v2-ink-muted dark:text-v2-ink-subtle hover:text-v2-ink hover:bg-v2-canvas",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="flex-1 text-left">{folder.label}</span>
                        {folder.count !== undefined && folder.count > 0 && (
                          <span className="text-[10px] font-medium text-v2-ink-muted">
                            {folder.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1" />

                <div className="border-t border-v2-ring pt-2 mt-2">
                  <div className="text-[10px] text-v2-ink-muted space-y-1 px-1">
                    <div className="flex justify-between">
                      <span>Daily quota</span>
                      <span className="font-medium text-v2-ink-muted">
                        {quota
                          ? `${quota.dailyUsed}/${quota.dailyLimit}`
                          : "0/50"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-v2-ring rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${percentUsed}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-v2-ink-subtle">
                      {remainingDaily} remaining
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : /* No sidebar for settings, templates, analytics tabs */
          null}

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {activeTab === "email" && (
              <MessagesLayout
                list={
                  <ThreadList
                    searchQuery={searchQuery}
                    selectedThreadId={selectedThreadId}
                    onThreadSelect={handleThreadSelect}
                    filter={activeFolder}
                  />
                }
                detail={
                  selectedThreadId ? (
                    <ThreadView
                      threadId={selectedThreadId}
                      onClose={() => setSelectedThreadId(null)}
                    />
                  ) : (
                    <EmptyThreadView />
                  )
                }
              />
            )}

            {activeTab === "slack" && (
              <SlackTabContent
                selectedChannel={selectedSlackChannel}
                selectedIntegrationId={selectedIntegrationId}
              />
            )}

            {activeTab === "instagram" && (
              <InstagramTabContent
                selectedConversation={selectedInstagramConversation}
                isActive={activeTab === "instagram"}
                onBack={
                  isMobile && selectedInstagramConversation
                    ? () => setSelectedInstagramConversationId(null)
                    : undefined
                }
              />
            )}

            {activeTab === "templates" && (
              <div className="h-full overflow-hidden">
                <InstagramTemplatesSettings />
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="h-full overflow-hidden">
                <MessagingAnalyticsDashboard />
              </div>
            )}

            {activeTab === "settings" && (
              <div className="h-full overflow-hidden">
                <MessagesSettingsContainer
                  showSlack={!isStaffOnlyUser}
                  showInstagram={!isStaffOnlyUser}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose Dialog */}
      <ComposeDialog open={isComposeOpen} onOpenChange={setIsComposeOpen} />
    </>
  );
}

// Empty state when no thread is selected
function EmptyThreadView() {
  return (
    <div className="h-full flex items-center justify-center bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft">
      <div className="text-center">
        <Inbox className="h-8 w-8 mx-auto mb-2 text-v2-ink-subtle" />
        <p className="text-[11px] text-v2-ink-muted">
          Select a conversation to view
        </p>
      </div>
    </div>
  );
}
