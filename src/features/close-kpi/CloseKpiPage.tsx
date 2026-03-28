// src/features/close-kpi/CloseKpiPage.tsx

import React, { useCallback, useState } from "react";
import { useFeatureAccess } from "@/hooks/subscription";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { closeKpiService } from "./services/closeKpiService";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DashboardHeader } from "./components/DashboardHeader";
import { WidgetGrid } from "./components/WidgetGrid";
import { KpiEmptyState } from "./components/KpiEmptyState";
import { CloseKpiLanding } from "./components/CloseKpiLanding";
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

export const CloseKpiPage: React.FC = () => {
  const { hasAccess, isLoading: isFeatureLoading } =
    useFeatureAccess("close_kpi");
  const { user } = useAuth();

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

  const handleAddWidget = useCallback(
    (widgetType: WidgetType) => {
      if (!dashData?.dashboard) {
        toast.error("Dashboard not available — please refresh the page");
        return;
      }
      const registry = WIDGET_REGISTRY[widgetType];
      // Generate a meaningful title instead of generic type label
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
    (widgets: { id: string; position_order: number }[]) => {
      reorderMut.mutate(widgets);
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

  // ─── Feature gate ──────────────────────────────────────────────
  if (isFeatureLoading) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-4">
        <div className="mb-3 h-6 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!hasAccess) {
    return <CloseKpiLanding />;
  }

  // ─── Loading state ────────────────────────────────────────────
  if (isDashLoading) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-4">
        <div className="mb-3 h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          <WidgetSkeleton size="small" />
          <WidgetSkeleton size="small" />
          <WidgetSkeleton size="medium" />
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────────────
  if (dashError) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="mb-2 h-5 w-5 text-destructive" />
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Dashboard unavailable
          </h2>
          <p className="max-w-md text-[11px] text-muted-foreground">
            {dashError.message}
          </p>
        </div>
      </div>
    );
  }

  // ─── Main dashboard ──────────────────────────────────────────
  const widgets = dashData?.widgets ?? [];

  return (
    <div className="mx-auto max-w-7xl px-3 py-4">
      {/* Close not connected banner — non-blocking */}
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
        onAddWidget={handleAddWidget}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
      />

      {widgets.length === 0 ? (
        <KpiEmptyState onAddWidget={handleAddWidget} />
      ) : (
        <WidgetGrid
          widgets={widgets}
          globalConfig={dashData?.dashboard.global_config}
          onRemoveWidget={handleRemoveWidget}
          onReorder={handleReorder}
        />
      )}
    </div>
  );
};
