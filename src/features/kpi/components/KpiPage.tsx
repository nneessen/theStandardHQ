// src/features/kpi/components/KpiPage.tsx
// Inbound-call KPI workspace (Phase 1). Three tabs: Dashboard, Recordings,
// Word Tracks. Mirrors the close-kpi page shell (SectionShell + hero + tab bar).

import React, { useState } from "react";
import { BarChart3, Mic, MessageSquareQuote, PhoneCall } from "lucide-react";
import { SectionShell } from "@/components/v2";
import { cn } from "@/lib/utils";
import { KpiDashboardTab } from "./KpiDashboardTab";
import { RecordingsTab } from "./RecordingsTab";
import { WordTracksTab } from "./WordTracksTab";

type TabId = "dashboard" | "recordings" | "word-tracks";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "recordings", label: "Recordings", icon: Mic },
  { id: "word-tracks", label: "Word Tracks", icon: MessageSquareQuote },
];

export const KpiPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <SectionShell className="dashboard-canvas">
      <div className="mx-auto w-full max-w-[2400px] px-4 py-5 lg:py-6">
        <div className="flex flex-col space-y-2">
          {/* Hero header */}
          <div className="relative overflow-hidden rounded-lg bg-v2-card-dark flex-shrink-0">
            <div className="relative flex items-center justify-between px-3 py-2.5 sm:px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <PhoneCall className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <h1 className="font-display text-lg font-extrabold uppercase tracking-tight text-foreground">
                    Call KPIs
                  </h1>
                  <p className="hidden text-[10px] text-foreground/60 sm:block">
                    Inbound call performance, recordings, and word tracks
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex flex-shrink-0 items-center gap-0.5 rounded-md bg-v2-canvas p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded px-2.5 py-1.5 text-[10px] font-medium transition-all sm:flex-initial",
                  activeTab === tab.id
                    ? "bg-v2-card text-v2-ink shadow-sm"
                    : "text-v2-ink-muted hover:text-v2-ink dark:hover:text-v2-ink-subtle",
                )}
              >
                <tab.icon className="h-3 w-3" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "dashboard" && <KpiDashboardTab />}
            {activeTab === "recordings" && <RecordingsTab />}
            {activeTab === "word-tracks" && <WordTracksTab />}
          </div>
        </div>
      </div>
    </SectionShell>
  );
};
