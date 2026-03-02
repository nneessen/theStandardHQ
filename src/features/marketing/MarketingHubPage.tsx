import { useState } from "react";
import { Navigate } from "@tanstack/react-router";
import { Send, LayoutTemplate, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUserProfile } from "@/hooks/admin";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { CampaignListTab } from "./components/campaigns/CampaignListTab";
import { TemplateGalleryTab } from "./components/templates/TemplateGalleryTab";
import { AudienceListTab } from "./components/audiences/AudienceListTab";
import { AnalyticsTab } from "./components/analytics/AnalyticsTab";

const TABS = [
  { id: "campaigns", label: "Campaigns", icon: Send },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function MarketingHubPage() {
  const { data: profile, isLoading } = useCurrentUserProfile();
  const [activeTab, setActiveTab] = useState<TabId>("campaigns");

  // Super-admin gate — defense-in-depth on top of RLS
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
        <h1 className="text-xl font-semibold">Marketing Hub</h1>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0.5 px-4 pt-2 border-b border-border bg-background">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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
        {activeTab === "campaigns" && <CampaignListTab />}
        {activeTab === "templates" && <TemplateGalleryTab />}
        {activeTab === "audiences" && <AudienceListTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
      </div>
    </div>
  );
}
