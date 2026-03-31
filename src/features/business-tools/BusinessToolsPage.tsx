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
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5 bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Business Tools
          </h1>
        </div>
        <ExportButton />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-md p-0.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all",
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
        {activeTab === "overview" && <OverviewTab onSwitchTab={setActiveTab} />}
        {activeTab === "upload" && <UploadTab onSwitchTab={setActiveTab} />}
        {activeTab === "transactions" && <TransactionsTab />}
        {activeTab === "statements" && <StatementsTab />}
      </div>
    </div>
  );
}
