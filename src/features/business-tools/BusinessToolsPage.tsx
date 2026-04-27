// src/features/business-tools/BusinessToolsPage.tsx
// Main page with access gating and tab layout

import { useState } from "react";
import {
  Briefcase,
  Upload,
  List,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useImo } from "@/contexts/ImoContext";
import { THE_STANDARD_AGENCY_ID } from "@/hooks/subscription";
import { OverviewTab } from "./components/OverviewTab";
import { UploadTab } from "./components/UploadTab";
import { TransactionsTab } from "./components/TransactionsTab";
import { StatementsTab } from "./components/StatementsTab";
import { ExportButton } from "./components/ExportButton";
import type { BusinessToolsTab } from "./types";

const TABS: { id: BusinessToolsTab; label: string; icon: React.ElementType }[] =
  [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "transactions", label: "Transactions", icon: List },
    { id: "statements", label: "Statements", icon: FileText },
    { id: "upload", label: "Upload", icon: Upload },
  ];

export default function BusinessToolsPage() {
  const { agency, isSuperAdmin } = useImo();
  const hasAccess = isSuperAdmin || agency?.id === THE_STANDARD_AGENCY_ID;
  const [activeTab, setActiveTab] = useState<BusinessToolsTab>("overview");

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col p-3 space-y-2.5 bg-v2-canvas">
      {/* Header */}
      <div className="flex items-center justify-between bg-v2-card rounded-lg px-3 py-2 border border-v2-ring">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-v2-ink" />
          <h1 className="text-sm font-semibold text-v2-ink">Business Tools</h1>
        </div>
        <ExportButton />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 bg-v2-canvas rounded-md p-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all",
              activeTab === tab.id
                ? "bg-v2-card shadow-sm text-v2-ink"
                : "text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle",
            )}
          >
            <tab.icon className="h-3 w-3" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && <OverviewTab onSwitchTab={setActiveTab} />}
        {activeTab === "upload" && <UploadTab onSwitchTab={setActiveTab} />}
        {activeTab === "transactions" && <TransactionsTab />}
        {activeTab === "statements" && <StatementsTab />}
      </div>
    </div>
  );
}
