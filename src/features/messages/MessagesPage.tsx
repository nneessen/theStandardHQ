// src/features/messages/MessagesPage.tsx
// Communications hub. Hero stat band + icon-rich tab nav + active workspace.
// Per-tab layout is owned by the corresponding workspace component so the
// page outline does not shape-shift between tabs.

import { useEffect, useMemo, useState } from "react";
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
  Send,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFeatureAccess } from "@/hooks/subscription";
import { useUserRoles } from "@/hooks/permissions";
import { useImo } from "@/contexts/ImoContext";
import type { RoleName } from "@/types/permissions.types";
import { cn } from "@/lib/utils";
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

  // Stats for hero band
  const { counts, totalUnread } = useFolderCounts();
  const { remainingDaily, percentUsed, quota } = useEmailQuota();

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
      description: string;
      icon: typeof Mail;
      hasAccess: boolean;
      badge?: number;
    }[] = [
      {
        id: "email",
        label: "Email",
        description: "Inbox, sent, threads, compose",
        icon: Mail,
        hasAccess: hasBuiltInEmailAccess,
        badge: totalUnread,
      },
      {
        id: "instagram",
        label: "Instagram",
        description: "DMs from your IG business account",
        icon: Instagram,
        hasAccess: hasInstagramAccess,
      },
      {
        id: "templates",
        label: "Templates",
        description: "Reusable message templates",
        icon: FileText,
        hasAccess: hasTemplatesAccess,
      },
      {
        id: "analytics",
        label: "Analytics",
        description: "Engagement and reply rates",
        icon: BarChart3,
        hasAccess: true,
      },
      {
        id: "settings",
        label: "Settings",
        description: "Channel integrations + preferences",
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
  ]);

  // Auto-redirect if active tab disappears (e.g. subscription downgrade).
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const activeTabMeta = tabs.find((t) => t.id === activeTab);
  const showSearch = activeTab === "email" || activeTab === "instagram";
  const showCompose = activeTab === "email";

  return (
    <>
      <div className="h-[calc(100vh-3rem)] flex flex-col gap-3 min-h-0">
        {/* Hero band: title + big stat tiles + primary actions.
            This replaces the dense one-line stats cluster the page used
            to lead with — same data, way more presence. */}
        <section className="relative bg-v2-card rounded-v2-md border border-v2-ring shadow-v2-soft overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Mail className="h-4 w-4 text-v2-ink" />
                <h1 className="text-[15px] font-semibold tracking-tight text-v2-ink">
                  Messages
                </h1>
              </div>
              <p className="text-[11px] text-v2-ink-muted">
                {activeTabMeta?.description ??
                  "All your conversations in one place"}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <HeroStat
                icon={<Inbox className="h-3 w-3" />}
                value={totalUnread}
                label="Unread"
                tone={totalUnread > 0 ? "accent" : "neutral"}
              />
              <Divider />
              <HeroStat value={counts.all} label="Total" />
              <Divider />
              <HeroStat
                icon={<Send className="h-3 w-3" />}
                value={
                  quota ? `${quota.dailyUsed}/${quota.dailyLimit}` : "0/50"
                }
                label="Sent today"
              />
              <Divider />
              <HeroStat
                icon={<Zap className="h-3 w-3" />}
                value={remainingDaily}
                label="Quota left"
                tone={
                  percentUsed > 90
                    ? "danger"
                    : percentUsed > 70
                      ? "warn"
                      : "neutral"
                }
              />
            </div>
          </div>

          {/* Tab nav lives inside the hero card so the visual unit is
              "this is the messages workspace" not "header + a strip of tabs". */}
          <nav className="flex items-stretch gap-0.5 px-2 border-t border-v2-ring overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-2 text-[12px] whitespace-nowrap transition-colors -mb-px",
                    isActive
                      ? "text-v2-ink font-semibold"
                      : "text-v2-ink-muted hover:text-v2-ink",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={cn(
                        "ml-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9.5px] font-semibold tabular-nums",
                        isActive
                          ? "bg-v2-ink text-v2-canvas"
                          : "bg-blue-500 text-white",
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-v2-ink rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </section>

        {/* Action bar (search + compose) lives between hero and content,
            tab-aware so it's only present when meaningful. */}
        {(showSearch || showCompose) && (
          <div className="flex items-center justify-end gap-1.5 flex-shrink-0">
            {showSearch && (
              <div className="relative w-72">
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
                  className="h-8 pl-7 pr-7 text-[12px] bg-v2-card border-v2-ring rounded-v2-pill focus-visible:ring-v2-accent"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery("")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )}

            {showCompose && (
              <button
                type="button"
                onClick={() => setIsComposeOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-v2-pill bg-v2-ink text-v2-canvas text-[12px] font-medium hover:bg-v2-ink/90 transition-colors"
              >
                <PenSquare className="h-3.5 w-3.5" />
                Compose
              </button>
            )}
          </div>
        )}

        {/* Active workspace owns its own internal layout. */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "email" && (
            <EmailWorkspace
              searchQuery={searchQuery}
              onCompose={() => setIsComposeOpen(true)}
            />
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

          {tabs.length === 0 && <NoChannelsState />}
        </main>
      </div>

      <ComposeDialog open={isComposeOpen} onOpenChange={setIsComposeOpen} />
    </>
  );
}

interface HeroStatProps {
  icon?: React.ReactNode;
  value: string | number;
  label: string;
  tone?: "neutral" | "accent" | "warn" | "danger";
}

function HeroStat({ icon, value, label, tone = "neutral" }: HeroStatProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[60px]">
      <div className="flex items-baseline gap-1.5">
        {icon && (
          <span
            className={cn(
              "inline-flex items-center justify-center w-5 h-5 rounded-full self-center",
              tone === "accent" && "bg-blue-500 text-white",
              tone === "warn" && "bg-amber-500 text-white",
              tone === "danger" && "bg-red-500 text-white",
              tone === "neutral" &&
                "bg-v2-canvas text-v2-ink-muted border border-v2-ring",
            )}
          >
            {icon}
          </span>
        )}
        <span
          className={cn(
            "text-[22px] font-semibold tracking-tight leading-none tabular-nums",
            tone === "danger"
              ? "text-red-600 dark:text-red-400"
              : "text-v2-ink",
          )}
        >
          {value}
        </span>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-v2-ink-muted font-medium">
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-8 bg-v2-ring self-center" />;
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
          Your current plan doesn't include messaging features. Upgrade to
          access Email, Instagram, and Templates.
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
