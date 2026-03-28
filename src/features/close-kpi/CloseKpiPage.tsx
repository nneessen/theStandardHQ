// src/features/close-kpi/CloseKpiPage.tsx
// Main page with tabbed layout for Close CRM KPI analytics

import React, { useCallback, useState } from "react";
import { useFeatureAccess } from "@/hooks/subscription";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { closeKpiService } from "./services/closeKpiService";
import {
  AlertTriangle,
  BarChart3,
  CreditCard,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { CloseLogo } from "@/features/chat-bot";
import { DashboardHeader } from "./components/DashboardHeader";
import { WidgetGrid } from "./components/WidgetGrid";
import { KpiEmptyState } from "./components/KpiEmptyState";
import { CloseKpiLanding } from "./components/CloseKpiLanding";
import { CloseKpiOverviewTab } from "./components/CloseKpiOverviewTab";
import { WidgetSkeleton } from "./components/skeletons/WidgetSkeleton";
import {
  useKpiDashboard,
  useAddWidget,
  useDeleteWidget,
  useReorderWidgets,
  closeKpiKeys,
} from "./hooks/useCloseKpiDashboard";
import { WIDGET_REGISTRY, METRIC_CATALOG } from "./config/widget-registry";
import type { WidgetType } from "./types/close-kpi.types";

type TabId = "overview" | "plans" | "dashboard";

const ACCENT = "#4EC375";

export const CloseKpiPage: React.FC = () => {
  const { hasAccess, isLoading: isFeatureLoading } =
    useFeatureAccess("close_kpi");
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Check close_config via service — not dependent on chat-bot-api edge function
  const { data: closeConfig } = useQuery({
    queryKey: ["close-config-status", user?.id],
    queryFn: () => closeKpiService.getConnectionStatus(user!.id!),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const {
    data: dashData,
    isLoading: isDashLoading,
    error: dashError,
  } = useKpiDashboard();
  const addWidget = useAddWidget();
  const deleteWidgetMut = useDeleteWidget();
  const reorderMut = useReorderWidgets();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const isCloseConnected = !!closeConfig;
  const widgets = dashData?.widgets ?? [];

  const handleAddWidget = useCallback(
    (widgetType: WidgetType) => {
      if (!dashData?.dashboard) {
        toast.error("Dashboard not available — please refresh the page");
        return;
      }
      const registry = WIDGET_REGISTRY[widgetType];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = registry.defaultConfig as any;
      const metricKey = config.metric as string | undefined;
      const metricDef = metricKey
        ? METRIC_CATALOG.find((m) => m.key === metricKey)
        : undefined;
      const title = metricDef?.label ?? registry.description.split(" — ")[0];
      addWidget.mutate(
        {
          dashboardId: dashData.dashboard.id,
          widgetType,
          title,
          size: registry.defaultSize,
          config: registry.defaultConfig,
        },
        {
          onSuccess: () => toast.success(`Added ${title}`),
          onError: (err) => toast.error(err.message),
        },
      );
    },
    [dashData, addWidget],
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      deleteWidgetMut.mutate(widgetId, {
        onError: (err) => toast.error(err.message),
      });
    },
    [deleteWidgetMut],
  );

  const handleReorder = useCallback(
    (w: { id: string; position_order: number }[]) => {
      reorderMut.mutate(w);
    },
    [reorderMut],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: closeKpiKeys.all });
      setLastUpdated(new Date().toISOString());
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // ─── Build tabs ─────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Sparkles },
    { id: "plans", label: "Plans", icon: CreditCard },
  ];
  if (hasAccess) {
    tabs.push({ id: "dashboard", label: "Dashboard", icon: BarChart3 });
  }

  // ─── Status badge ──────────────────────────────────────────
  const statusBadge = isCloseConnected ? (
    <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
      Connected
    </Badge>
  ) : (
    <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
      Not Connected
    </Badge>
  );

  // ─── Loading state ────────────────────────────────────────────
  if (isFeatureLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5 bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5 bg-zinc-50 dark:bg-zinc-950">
      {/* ══════ Hero Header ══════ */}
      <div className="relative overflow-hidden rounded-xl bg-foreground">
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
        <div className="relative px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${ACCENT}30` }}
            >
              <CloseLogo className="h-4 w-auto text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white dark:text-black tracking-tight">
                Close KPIs
              </h1>
              <p className="text-[10px] text-white/50 dark:text-black/40">
                CRM performance dashboard powered by Close
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">{statusBadge}</div>
        </div>
      </div>

      {/* ══════ Tab Bar ══════ */}
      <div className="flex items-center gap-0.5 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-md p-0.5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded transition-all whitespace-nowrap flex-shrink-0",
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

      {/* ══════ Tab Content ══════ */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview tab */}
        {activeTab === "overview" && (
          <CloseKpiOverviewTab
            hasAccess={hasAccess}
            isCloseConnected={isCloseConnected}
            widgetCount={widgets.length}
            onNavigateToTab={(tabId) => setActiveTab(tabId as TabId)}
          />
        )}

        {/* Plans tab */}
        {activeTab === "plans" && <CloseKpiLanding />}

        {/* Dashboard tab */}
        {activeTab === "dashboard" && (
          <DashboardTab
            isDashLoading={isDashLoading}
            dashError={dashError}
            widgets={widgets}
            dashData={dashData}
            isCloseConnected={isCloseConnected}
            isRefreshing={isRefreshing}
            lastUpdated={lastUpdated}
            onAddWidget={handleAddWidget}
            onRemoveWidget={handleRemoveWidget}
            onReorder={handleReorder}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    </div>
  );
};

// ─── Dashboard Tab (extracted from former page root) ────────────

interface DashboardTabProps {
  isDashLoading: boolean;
  dashError: Error | null;
  widgets: ReturnType<typeof useKpiDashboard>["data"] extends
    | infer D
    | undefined
    ? D extends { widgets: infer W }
      ? W
      : never[]
    : never[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dashData: any;
  isCloseConnected: boolean;
  isRefreshing: boolean;
  lastUpdated: string | null;
  onAddWidget: (widgetType: WidgetType) => void;
  onRemoveWidget: (widgetId: string) => void;
  onReorder: (widgets: { id: string; position_order: number }[]) => void;
  onRefresh: () => void;
}

function DashboardTab({
  isDashLoading,
  dashError,
  widgets,
  dashData,
  isCloseConnected,
  isRefreshing,
  lastUpdated,
  onAddWidget,
  onRemoveWidget,
  onReorder,
  onRefresh,
}: DashboardTabProps) {
  if (isDashLoading) {
    return (
      <div className="py-4">
        <div className="mb-3 h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          <WidgetSkeleton size="small" />
          <WidgetSkeleton size="small" />
          <WidgetSkeleton size="medium" />
        </div>
      </div>
    );
  }

  if (dashError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="mb-2 h-5 w-5 text-destructive" />
        <h2 className="mb-1 text-sm font-semibold text-foreground">
          Dashboard unavailable
        </h2>
        <p className="max-w-md text-[11px] text-muted-foreground">
          {dashError.message}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Close not connected banner */}
      {!isCloseConnected && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--warning))]" />
          <p className="text-[11px] text-muted-foreground">
            Close CRM not connected — widgets will show placeholder data.{" "}
            <Link
              to="/chat-bot"
              className="font-medium underline hover:no-underline"
            >
              Connect in Chat Bot settings
            </Link>
          </p>
        </div>
      )}

      <DashboardHeader
        onAddWidget={onAddWidget}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
      />

      {widgets.length === 0 ? (
        <KpiEmptyState onAddWidget={onAddWidget} />
      ) : (
        <WidgetGrid
          widgets={widgets}
          globalConfig={dashData?.dashboard.global_config}
          onRemoveWidget={onRemoveWidget}
          onReorder={onReorder}
        />
      )}
    </div>
  );
}
