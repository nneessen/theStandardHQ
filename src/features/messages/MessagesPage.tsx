// src/features/messages/MessagesPage.tsx
// Communications hub. A shared header (brand + stats + quota + channel tabs)
// sits above a tab-owned workspace. The default "All inboxes" tab is the
// unified feed (Option C); the per-channel tabs reuse their own workspaces.

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NEW_SUBSCRIPTIONS_ENABLED } from "@/lib/subscription/subscription-availability";
import {
  BarChart3,
  FileText,
  Inbox,
  Instagram,
  Mail,
  Settings,
} from "lucide-react";
import { useFeatureAccess } from "@/hooks/subscription";
import { useUserRoles } from "@/hooks/permissions";
import { useImo } from "@/contexts/ImoContext";
import type { RoleName } from "@/types/permissions.types";
import { ComposeDialog } from "./components/compose/ComposeDialog";
import { useFolderCounts } from "./hooks/useFolderCounts";
import { useSendPace } from "./hooks/useSendPace";
import { useMessagingAnalytics } from "./hooks/useMessagingAnalytics";
import { InstagramTemplatesSettings } from "./components/instagram/templates";
import { MessagesSettingsContainer } from "./components/settings";
import { MessagingAnalyticsDashboard } from "./components/analytics";
import {
  InboxHeader,
  type HeaderTab,
  UnifiedInboxView,
} from "./components/unified";

type TabType =
  | "all"
  | "email"
  | "instagram"
  | "templates"
  | "analytics"
  | "settings";

export function MessagesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const queryClient = useQueryClient();

  // Role-based access
  const { data: userRoles } = useUserRoles();
  const { isSuperAdmin } = useImo();
  const hasRole = (role: RoleName) => userRoles?.includes(role) || false;
  const isStaffOnlyUser =
    !isSuperAdmin &&
    (hasRole("trainer" as RoleName) ||
      hasRole("contracting_manager" as RoleName)) &&
    !hasRole("agent" as RoleName) &&
    !hasRole("admin" as RoleName);

  // Subscription feature access
  const { hasAccess: hasEmailAccess } = useFeatureAccess("email");
  const { hasAccess: hasInstagramAccess } = useFeatureAccess(
    "instagram_messaging",
  );
  const { hasAccess: hasTemplatesAccess } = useFeatureAccess(
    "instagram_templates",
  );
  const hasBuiltInEmailAccess = hasEmailAccess || isStaffOnlyUser;

  // Header data
  const { counts, totalUnread } = useFolderCounts();
  const pace = useSendPace();
  const { data: analytics } = useMessagingAnalytics("7d");
  const openRate = analytics?.email.openRate ?? 0;

  // Handle Instagram OAuth redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const instagramStatus = urlParams.get("instagram");
    const account = urlParams.get("account");
    const reason = urlParams.get("reason");

    if (instagramStatus === "success") {
      toast.success(`Instagram connected: @${account || "Unknown"}`);
      queryClient.invalidateQueries({ queryKey: ["instagram"] });
      setActiveTab("instagram");
      cleanInstagramParams(urlParams);
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
      cleanInstagramParams(urlParams);
    }
  }, [queryClient]);

  const tabs = useMemo(() => {
    const all: {
      id: TabType;
      label: string;
      icon: typeof Mail;
      hasAccess: boolean;
      badge?: number;
    }[] = [
      {
        id: "all",
        label: "All inboxes",
        icon: Inbox,
        hasAccess: hasBuiltInEmailAccess || hasInstagramAccess,
        badge: counts.all,
      },
      {
        id: "email",
        label: "Email",
        icon: Mail,
        hasAccess: hasBuiltInEmailAccess,
        badge: totalUnread,
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
      {
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        hasAccess: true,
      },
      {
        id: "settings",
        label: "Settings",
        icon: Settings,
        hasAccess: true,
      },
    ];
    return all.filter((tab) => {
      if (!tab.hasAccess) return false;
      if (
        isStaffOnlyUser &&
        (tab.id === "templates" || tab.id === "analytics")
      ) {
        return false;
      }
      return true;
    });
  }, [
    hasBuiltInEmailAccess,
    hasInstagramAccess,
    hasTemplatesAccess,
    isStaffOnlyUser,
    totalUnread,
    counts.all,
  ]);

  // Auto-redirect if active tab disappears (e.g. subscription downgrade).
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const showSearch =
    activeTab === "all" || activeTab === "email" || activeTab === "instagram";
  const showCompose = activeTab === "all" || activeTab === "email";

  const headerTabs: HeaderTab[] = tabs.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badge: t.badge,
  }));

  return (
    <>
      <div className="h-[calc(100vh-3rem)] flex flex-col gap-3 min-h-0">
        <InboxHeader
          tabs={headerTabs}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabType)}
          stats={{ unread: totalUnread, threads: counts.all, openRate }}
          pace={pace}
          search={searchQuery}
          onSearch={setSearchQuery}
          showSearch={showSearch}
          showCompose={showCompose}
          onCompose={() => setIsComposeOpen(true)}
        />

        {/* Active workspace owns its own internal layout. */}
        <main className="flex-1 min-h-0 overflow-hidden rounded-v2-md bg-v2-canvas">
          {(activeTab === "all" ||
            activeTab === "email" ||
            activeTab === "instagram") && (
            <UnifiedInboxView
              searchQuery={searchQuery}
              channel={activeTab as "all" | "email" | "instagram"}
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
              <MessagesSettingsContainer showInstagram={!isStaffOnlyUser} />
            </div>
          )}

          {tabs.length === 0 && <NoChannelsState />}
        </main>
      </div>

      <ComposeDialog open={isComposeOpen} onOpenChange={setIsComposeOpen} />
    </>
  );
}

function NoChannelsState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm px-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-v2-canvas border border-v2-ring mb-3">
          <Inbox className="h-6 w-6 text-v2-ink-subtle" />
        </div>
        <p className="text-[12px] font-medium text-v2-ink mb-1">
          No messaging channels available
        </p>
        <p className="text-[11px] text-v2-ink-muted">
          {NEW_SUBSCRIPTIONS_ENABLED
            ? "Your current plan doesn't include messaging features. Upgrade to access Email, Instagram, and Templates."
            : "Your current plan doesn't include messaging features. Email, Instagram, and Templates are not included in your current plan."}
        </p>
      </div>
    </div>
  );
}

function cleanInstagramParams(urlParams: URLSearchParams) {
  urlParams.delete("instagram");
  urlParams.delete("account");
  urlParams.delete("reason");
  urlParams.delete("details");
  const newUrl =
    urlParams.toString().length > 0
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
  window.history.replaceState({}, "", newUrl);
}
