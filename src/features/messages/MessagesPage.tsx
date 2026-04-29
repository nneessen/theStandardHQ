// src/features/messages/MessagesPage.tsx
// Communications hub. Thin orchestrator: header + tabs + active workspace.
// Per-tab layout is owned by the corresponding workspace component so the
// page no longer "jumps" shape when switching tabs.

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  FileText,
  Inbox,
  Instagram,
  Mail,
  PenSquare,
  Search,
  Settings,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PillButton, PillNav } from "@/components/v2";
import { useFeatureAccess } from "@/hooks/subscription";
import { useUserRoles } from "@/hooks/permissions";
import { useImo } from "@/contexts/ImoContext";
import type { RoleName } from "@/types/permissions.types";
import { ComposeDialog } from "./components/compose/ComposeDialog";
import { useFolderCounts } from "./hooks/useFolderCounts";
import { useEmailQuota } from "./hooks/useSendEmail";
import { EmailWorkspace } from "./components/workspaces/EmailWorkspace";
import { InstagramWorkspace } from "./components/workspaces/InstagramWorkspace";
import { InstagramTemplatesSettings } from "./components/instagram/templates";
import { MessagesSettingsContainer } from "./components/settings";
import { MessagingAnalyticsDashboard } from "./components/analytics";

type TabType = "email" | "instagram" | "templates" | "analytics" | "settings";

export function MessagesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("email");
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

  // Email metadata (used in header chips when on email tab)
  const { counts, totalUnread } = useFolderCounts();
  const { remainingDaily, quota } = useEmailQuota();

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

  // Tab definitions, gated by feature access + role.
  const allTabs: {
    id: TabType;
    label: string;
    icon: typeof Mail;
    hasAccess: boolean;
    badge?: number;
  }[] = [
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
    { id: "settings", label: "Settings", icon: Settings, hasAccess: true },
  ];

  const tabs = allTabs.filter((tab) => {
    if (!tab.hasAccess) return false;
    if (isStaffOnlyUser && (tab.id === "templates" || tab.id === "analytics")) {
      return false;
    }
    return true;
  });

  // Auto-redirect if active tab disappears (e.g. subscription downgrade).
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  // Search and compose are only meaningful on email + instagram. Hide
  // them on the static tabs to reduce visual noise.
  const showSearch = activeTab === "email" || activeTab === "instagram";
  const showCompose = activeTab === "email";

  return (
    <>
      <div className="h-[calc(100vh-3rem)] flex flex-col gap-2">
        {/* Single-row top chrome: title + tabs + (search + compose) */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Mail className="h-4 w-4 text-v2-ink" />
              <h1 className="text-base font-semibold tracking-tight text-v2-ink">
                Messages
              </h1>
            </div>

            <PillNav
              size="sm"
              activeValue={activeTab}
              onChange={(v) => setActiveTab(v as TabType)}
              items={tabs.map((t) => ({
                label:
                  t.badge && t.badge > 0 ? `${t.label} (${t.badge})` : t.label,
                value: t.id,
              }))}
            />
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Tab-aware metadata chips, only when relevant */}
            {activeTab === "email" && (
              <span className="text-[11px] text-v2-ink-muted hidden md:inline-flex items-center gap-1.5">
                <span>
                  <span className="text-v2-ink font-semibold">
                    {counts.all}
                  </span>{" "}
                  total
                </span>
                <span className="text-v2-ink-subtle">·</span>
                <span>
                  <span className="text-v2-ink font-semibold">
                    {quota ? `${quota.dailyUsed}/${quota.dailyLimit}` : "0/50"}
                  </span>{" "}
                  sent
                  <span className="text-v2-ink-subtle">
                    {" "}
                    ({remainingDaily} left)
                  </span>
                </span>
              </span>
            )}

            {showSearch && (
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-v2-ink-subtle" />
                <Input
                  type="text"
                  placeholder={
                    activeTab === "email"
                      ? "Search threads…"
                      : "Search conversations…"
                  }
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
            )}

            {showCompose && (
              <PillButton
                onClick={() => setIsComposeOpen(true)}
                tone="black"
                size="sm"
                className="h-7 px-2.5 text-[11px]"
              >
                <PenSquare className="h-3 w-3" />
                Compose
              </PillButton>
            )}
          </div>
        </header>

        {/* Active workspace owns its own internal layout. Page does not
            shape-shift between tabs — only the workspace inside changes. */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "email" && (
            <EmailWorkspace searchQuery={searchQuery} />
          )}

          {activeTab === "instagram" && (
            <InstagramWorkspace isActive={activeTab === "instagram"} />
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

          {tabs.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm px-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-v2-canvas border border-v2-ring mb-3">
                  <Inbox className="h-6 w-6 text-v2-ink-subtle" />
                </div>
                <p className="text-[12px] font-medium text-v2-ink mb-1">
                  No messaging channels available
                </p>
                <p className="text-[11px] text-v2-ink-muted">
                  Your current plan doesn't include messaging features. Upgrade
                  to access Email, Instagram, and Templates.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      <ComposeDialog open={isComposeOpen} onOpenChange={setIsComposeOpen} />
    </>
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
