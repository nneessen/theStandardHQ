// src/features/business-tools/BusinessToolsPage.tsx
// Main page with access gating and tab layout

import { useState } from "react";
import { Upload, List, FileText, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useImo } from "@/contexts/ImoContext";
import { THE_STANDARD_AGENCY_ID } from "@/hooks/subscription";
import { OverviewTab } from "./components/OverviewTab";
import { UploadTab } from "./components/UploadTab";
import { TransactionsTab } from "./components/TransactionsTab";
import { StatementsTab } from "./components/StatementsTab";
import { ExportButton } from "./components/ExportButton";
import type { BusinessToolsTab } from "./types";
import { SectionShell } from "@/components/v2";
import { Cap, T } from "@/components/board";

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
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[1820px] px-4 py-5 sm:px-8 lg:px-12 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* header */}
          <header
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Cap>TOOLKIT</Cap>
              <h1
                style={{
                  font: `800 26px ${T.disp}`,
                  color: T.ink,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  margin: 0,
                }}
              >
                Business Tools
              </h1>
            </div>
            {/* ExportButton on the right */}
            <ExportButton />
          </header>

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
            {activeTab === "overview" && (
              <OverviewTab onSwitchTab={setActiveTab} />
            )}
            {activeTab === "upload" && <UploadTab onSwitchTab={setActiveTab} />}
            {activeTab === "transactions" && <TransactionsTab />}
            {activeTab === "statements" && <StatementsTab />}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
