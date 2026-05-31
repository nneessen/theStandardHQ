import { useState, useCallback, useEffect } from "react";
import { Navigate } from "@tanstack/react-router";
import { Send, LayoutTemplate, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUserProfile } from "@/hooks/admin";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { CampaignListTab } from "./components/campaigns/CampaignListTab";
import { TemplateGalleryTab } from "./components/templates/TemplateGalleryTab";
import { AudienceListTab } from "./components/audiences/AudienceListTab";
import { AnalyticsTab } from "./components/analytics/AnalyticsTab";
import type { EmailBlock } from "@/types/email.types";

const TABS = [
  { id: "campaigns", label: "Campaigns", icon: Send },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface MarketingHubPageProps {
  initialTab?: TabId;
}

export function MarketingHubPage({
  initialTab = "campaigns",
}: MarketingHubPageProps) {
  const { data: profile, isLoading } = useCurrentUserProfile();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [pendingBlocks, setPendingBlocks] = useState<
    EmailBlock[] | undefined
  >();
  const [pendingSubject, setPendingSubject] = useState<string | undefined>();

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Cross-tab callback: template tab → campaign tab with pre-populated blocks
  const handleStartCampaignWithBlocks = useCallback(
    (blocks: EmailBlock[], subject?: string) => {
      setPendingBlocks(blocks);
      setPendingSubject(subject);
      setActiveTab("campaigns");
    },
    [],
  );

  // Super-admin gate
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LogoSpinner size="lg" />
      </div>
    );
  }

  if (!profile?.is_super_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight">
          Marketing Hub
        </h1>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0.5 px-4 pt-2 border-b border-border bg-background">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                // Clear pending blocks if navigating away from campaigns
                if (tab.id !== "campaigns") {
                  setPendingBlocks(undefined);
                  setPendingSubject(undefined);
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-t-md border border-b-0 transition-colors -mb-px",
                isActive
                  ? "bg-background text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "campaigns" && (
          <CampaignListTab
            initialBlocks={pendingBlocks}
            initialSubject={pendingSubject}
          />
        )}
        {activeTab === "templates" && (
          <TemplateGalleryTab
            onStartCampaignWithBlocks={handleStartCampaignWithBlocks}
          />
        )}
        {activeTab === "audiences" && <AudienceListTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}
