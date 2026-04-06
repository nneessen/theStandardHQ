// src/features/close-kpi/CloseKpiPage.tsx
// Close KPI dashboard with pre-built overview + custom user dashboard.
// 3 tabs: Dashboard (with Overview / My Dashboard sub-views) + Setup + Connection.

import React, { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CloseLogo } from "@/features/chat-bot";
import { DashboardHeader } from "./components/DashboardHeader";
import { PrebuiltDashboard } from "./components/PrebuiltDashboard";
import { CustomDashboard } from "./components/CustomDashboard";
import { SetupGuide } from "./components/SetupGuide";
import { CloseSettings } from "./components/CloseSettings";
import { TeamTab } from "./components/team/TeamTab";
import {
  closeKpiKeys,
  useCloseConnectionStatus,
  useLeadHeatCompletedRuns,
  useLeadHeatRescore,
  useLeadHeatScoreCount,
} from "./hooks/useCloseKpiDashboard";
import { useCanViewTeamTab } from "./hooks/useTeamPipelineSnapshot";
import type { DateRangePreset } from "./types/close-kpi.types";

type TabId = "dashboard" | "team" | "setup" | "settings";
type DashboardMode = "prebuilt" | "custom";

const ACCENT = "#4EC375";

export const CloseKpiPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Tab state — default to setup, update when connection status resolves
  const [activeTab, setActiveTab] = useState<TabId>("setup");
  const [hasResolvedInitialTab, setHasResolvedInitialTab] = useState(false);
  const isSetupTabActive = hasResolvedInitialTab && activeTab === "setup";

  // Dashboard mode: prebuilt overview vs custom
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("prebuilt");

  // Check close connection
  const { data: closeConfig } = useCloseConnectionStatus();

  // Team tab visibility (super-admin OR has downlines)
  const { data: canViewTeam = false } = useCanViewTeamTab();

  // Check if any scores exist (for setup guide status)
  const { data: scoreCount } = useLeadHeatScoreCount(isSetupTabActive);

  // Check if any scoring runs completed
  const { data: hasCompletedRuns } = useLeadHeatCompletedRuns(isSetupTabActive);
  const leadHeatRescore = useLeadHeatRescore();

  const isCloseConnected = !!closeConfig;
  const hasScores = (scoreCount ?? 0) > 0;

  useEffect(() => {
    if (!hasResolvedInitialTab && closeConfig !== undefined) {
      setHasResolvedInitialTab(true);
      setActiveTab(closeConfig ? "dashboard" : "setup");
    }
  }, [closeConfig, hasResolvedInitialTab]);

  // Defensive: if visibility flips off (e.g. session change), bounce off team tab.
  // The RPC is the real gate; this just prevents an empty render.
  useEffect(() => {
    if (activeTab === "team" && !canViewTeam) {
      setActiveTab("dashboard");
    }
  }, [activeTab, canViewTeam]);

  // Dashboard state
  const [dateRange, setDateRange] = useState<DateRangePreset>("last_30_days");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: closeKpiKeys.prebuiltWidgets(),
        }),
        queryClient.invalidateQueries({
          queryKey: closeKpiKeys.closeMetadata(),
        }),
        queryClient.invalidateQueries({
          queryKey: closeKpiKeys.leadHeat(),
        }),
      ]);
      setLastUpdated(new Date().toISOString());
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  const handleRescore = useCallback(async () => {
    setIsRescoring(true);
    try {
      await leadHeatRescore.mutateAsync();
      setLastUpdated(new Date().toISOString());
    } catch {
      // handled by widget error states
    } finally {
      setIsRescoring(false);
    }
  }, [leadHeatRescore]);

  // ─── Tabs ─────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    ...(canViewTeam
      ? [{ id: "team" as const, label: "Team", icon: Users }]
      : []),
    { id: "setup", label: "Setup", icon: Settings },
    { id: "settings", label: "Connection", icon: Wrench },
  ];

  // ─── Dashboard Mode Segments ──────────────────────────────────
  const dashboardModes: { id: DashboardMode; label: string }[] = [
    { id: "prebuilt", label: "AI + Metrics" },
    { id: "custom", label: "Custom KPIs" },
  ];

  // ─── Status badge ─────────────────────────────────────────────
  const statusBadge = isCloseConnected ? (
    <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
      Connected
    </Badge>
  ) : (
    <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
      Not Connected
    </Badge>
  );

  return (
    <div className="flex flex-col p-2 sm:p-3 space-y-2 bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl bg-foreground flex-shrink-0">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="close-grid"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#close-grid)" />
          </svg>
        </div>
        <div
          className="absolute top-1/3 -left-16 w-64 h-64 rounded-full blur-3xl"
          style={{ backgroundColor: `${ACCENT}18` }}
        />
        <div
          className="absolute bottom-0 -right-16 w-48 h-48 rounded-full blur-3xl"
          style={{ backgroundColor: "rgba(20,99,255,0.08)" }}
        />
        <div className="relative px-3 sm:px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${ACCENT}30` }}
            >
              <CloseLogo className="h-3.5 w-auto text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white dark:text-black tracking-tight">
                Close KPIs
              </h1>
              <p className="text-[10px] text-white/50 dark:text-black/40 hidden sm:block">
                AI-powered CRM analytics dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">{statusBadge}</div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0.5 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-md p-0.5 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded transition-all whitespace-nowrap flex-1 sm:flex-initial",
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
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "dashboard" && (
          <>
            {/* Not connected warning */}
            {!isCloseConnected && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]" />
                <p className="text-[11px] text-muted-foreground">
                  Close CRM not connected.{" "}
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="font-medium underline hover:no-underline"
                  >
                    Connect in Settings
                  </button>{" "}
                  to see your data.
                </p>
              </div>
            )}

            {/* Dashboard header with mode segmented control */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              {/* Left: Segmented control for dashboard mode */}
              <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-md p-0.5">
                {dashboardModes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setDashboardMode(mode.id)}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-medium rounded transition-all whitespace-nowrap",
                      dashboardMode === mode.id
                        ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dashboard Content */}
            {dashboardMode === "prebuilt" && (
              <>
                <DashboardHeader
                  dateRange={dateRange}
                  onDateRangeChange={setDateRange}
                  onRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                  onRescore={handleRescore}
                  isRescoring={isRescoring || leadHeatRescore.isPending}
                  lastUpdated={lastUpdated}
                />
                <PrebuiltDashboard dateRange={dateRange} />
              </>
            )}

            {dashboardMode === "custom" && <CustomDashboard />}
          </>
        )}

        {activeTab === "team" && <TeamTab />}

        {activeTab === "setup" && (
          <SetupGuide
            isCloseConnected={isCloseConnected}
            hasScores={hasScores}
            hasScoringRuns={hasCompletedRuns ?? false}
            onNavigateToDashboard={() => setActiveTab("dashboard")}
            onNavigateToSettings={() => setActiveTab("settings")}
          />
        )}

        {activeTab === "settings" && <CloseSettings />}
      </div>
    </div>
  );
};
