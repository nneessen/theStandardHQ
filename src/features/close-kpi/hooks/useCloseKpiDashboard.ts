// src/features/close-kpi/hooks/useCloseKpiDashboard.ts
// TanStack Query hooks for dashboard + widget CRUD (Supabase direct)

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDashboard,
  createDashboard,
  updateDashboardConfig,
  getWidgets,
  createWidget,
  updateWidget,
  deleteWidget,
  reorderWidgets,
  getTemplates,
} from "../services/kpiDashboardService";
import {
  closeKpiService,
  type CloseMetadataResponse,
} from "../services/closeKpiService";
import type {
  DashboardWithWidgets,
  LeadHeatDashboardStatus,
  GlobalDashboardConfig,
  WidgetType,
  WidgetSize,
  WidgetConfig,
} from "../types/close-kpi.types";
import { WIDGET_REGISTRY } from "../config/widget-registry";

// ─── Query Keys ────────────────────────────────────────────────────

type CloseKpiWidgetQueryGroup = "lead-heat" | "close-api";

export const CLOSE_KPI_PREBUILT_ROLLUP_VERSION = "v2";

export function getCloseKpiWidgetQueryGroup(
  widgetType?: string | null,
): CloseKpiWidgetQueryGroup {
  return widgetType?.startsWith("lead_heat_") ? "lead-heat" : "close-api";
}

export const closeKpiKeys = {
  all: ["close-kpi"] as const,
  connectionStatus: (userId: string) =>
    [...closeKpiKeys.all, "connection-status", userId] as const,
  dashboard: (userId: string) =>
    [...closeKpiKeys.all, "dashboard", userId] as const,
  widgets: (dashboardId: string) =>
    [...closeKpiKeys.all, "widgets", dashboardId] as const,
  templates: () => [...closeKpiKeys.all, "templates"] as const,
  widgetCacheRoot: () => [...closeKpiKeys.all, "widget-cache"] as const,
  widgetCacheGroup: (group: CloseKpiWidgetQueryGroup) =>
    [...closeKpiKeys.widgetCacheRoot(), group] as const,
  widgetCache: (
    group: CloseKpiWidgetQueryGroup,
    widgetId: string,
    cacheKey: string,
  ) => [...closeKpiKeys.widgetCacheGroup(group), widgetId, cacheKey] as const,
  prebuiltWidgets: () => [...closeKpiKeys.all, "prebuilt-widget"] as const,
  prebuiltWidget: (
    group: CloseKpiWidgetQueryGroup,
    widgetType: string,
    widgetId: string,
    paramsKey: string,
  ) =>
    [
      ...closeKpiKeys.prebuiltWidgets(),
      group,
      widgetType,
      widgetId,
      paramsKey,
    ] as const,
  prebuiltRollup: (version: string, paramsKey: string) =>
    [...closeKpiKeys.prebuiltWidgets(), "rollup", version, paramsKey] as const,
  closeMetadata: () => [...closeKpiKeys.all, "close-metadata"] as const,
  leadHeat: () => [...closeKpiKeys.all, "lead-heat"] as const,
  leadHeatScoreCount: (userId: string) =>
    [...closeKpiKeys.leadHeat(), "score-count", userId] as const,
  leadHeatRunsStatus: (userId: string) =>
    [...closeKpiKeys.leadHeat(), "runs-status", userId] as const,
  leadHeatStatus: (userId: string) =>
    [...closeKpiKeys.leadHeat(), "status", userId] as const,
  leadHeatWidgets: () =>
    [...closeKpiKeys.prebuiltWidgets(), "lead-heat"] as const,
  leadStatuses: () => [...closeKpiKeys.all, "lead-statuses"] as const,
  leadSources: () => [...closeKpiKeys.all, "lead-sources"] as const,
  smartViews: () => [...closeKpiKeys.all, "smart-views"] as const,
};

// ─── Shared Status Queries ────────────────────────────────────────

export function useCloseConnectionStatus(enabled = true) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: closeKpiKeys.connectionStatus(userId),
    queryFn: () => closeKpiService.getConnectionStatus(userId),
    enabled: enabled && !!userId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useLeadHeatScoreCount(enabled = true) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: closeKpiKeys.leadHeatScoreCount(userId),
    queryFn: () => closeKpiService.getLeadHeatScoreCount(userId),
    enabled: enabled && !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useLeadHeatCompletedRuns(enabled = true) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: closeKpiKeys.leadHeatRunsStatus(userId),
    queryFn: () => closeKpiService.hasCompletedScoringRuns(userId),
    enabled: enabled && !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useLeadHeatDashboardStatus(enabled = true) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery({
    queryKey: closeKpiKeys.leadHeatStatus(userId),
    queryFn: () => closeKpiService.getLeadHeatDashboardStatus(userId),
    enabled: enabled && !!userId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.data?.state === "running" ? 5_000 : false,
  });
}

export function useLeadHeatRescore() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";

  return useMutation({
    mutationFn: () => closeKpiService.triggerRescore(),
    onMutate: async () => {
      if (!userId) return { previousStatus: undefined as undefined };

      const statusKey = closeKpiKeys.leadHeatStatus(userId);
      await queryClient.cancelQueries({ queryKey: statusKey });

      const previousStatus =
        queryClient.getQueryData<LeadHeatDashboardStatus>(statusKey);

      queryClient.setQueryData<LeadHeatDashboardStatus>(
        statusKey,
        (current) => ({
          state: "running",
          hasCachedScores: current?.hasCachedScores ?? false,
          lastScoredAt: current?.lastScoredAt ?? null,
          lastRunStatus: "running",
          lastRunStartedAt: new Date().toISOString(),
          lastRunCompletedAt: current?.lastRunCompletedAt ?? null,
          lastRunErrorMessage: null,
          isTruncated: current?.isTruncated ?? false,
          staleAfterMs: current?.staleAfterMs ?? 24 * 60 * 60_000,
        }),
      );

      return { previousStatus, statusKey };
    },
    onError: (error, _variables, context) => {
      const msg =
        error instanceof Error ? error.message : "Lead scoring failed";
      toast.error(msg);

      if (!context?.statusKey) return;

      if (context.previousStatus) {
        queryClient.setQueryData(context.statusKey, context.previousStatus);
        return;
      }

      queryClient.removeQueries({
        queryKey: context.statusKey,
        exact: true,
      });
    },
    onSuccess: async () => {
      if (!userId) return;

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: closeKpiKeys.leadHeatStatus(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: closeKpiKeys.leadHeatWidgets(),
        }),
        queryClient.invalidateQueries({
          queryKey: closeKpiKeys.widgetCacheGroup("lead-heat"),
        }),
        queryClient.invalidateQueries({
          queryKey: closeKpiKeys.leadHeat(),
        }),
      ]);
    },
  });
}

// ─── Dashboard Query ───────────────────────────────────────────────

export function useKpiDashboard() {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  return useQuery<DashboardWithWidgets | null>({
    queryKey: closeKpiKeys.dashboard(userId),
    queryFn: async () => {
      let dashboard = await getDashboard(userId);
      let isNew = false;
      if (!dashboard) {
        dashboard = await createDashboard(userId);
        isNew = true;
      }
      let widgets = await getWidgets(dashboard.id);

      // Seed 3 example widgets on first visit
      if (isNew && widgets.length === 0) {
        await seedStarterWidgets(dashboard.id, userId);
        widgets = await getWidgets(dashboard.id);
      }

      return { dashboard, widgets };
    },
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
}

// ─── Widget Mutations ──────────────────────────────────────────────

export function useAddWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      dashboardId: string;
      widgetType: WidgetType;
      title?: string;
      size?: WidgetSize;
      config?: WidgetConfig;
    }) => {
      const uid = user?.id;
      if (!uid) throw new Error("Not authenticated");
      const registry = WIDGET_REGISTRY[params.widgetType];
      const existing = await getWidgets(params.dashboardId);

      return createWidget({
        dashboardId: params.dashboardId,
        userId: uid,
        widgetType: params.widgetType,
        title: params.title ?? registry.label,
        size: params.size ?? registry.defaultSize,
        config: params.config ?? registry.defaultConfig,
        positionOrder: existing.length,
      });
    },
    onSuccess: () => {
      if (!user) return;
      queryClient.invalidateQueries({
        queryKey: closeKpiKeys.dashboard(user?.id ?? ""),
      });
    },
  });
}

export function useUpdateWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      widgetId: string;
      updates: Partial<{
        title: string;
        size: WidgetSize;
        config: WidgetConfig;
        position_order: number;
      }>;
    }) => {
      await updateWidget(params.widgetId, params.updates);
    },
    onSuccess: () => {
      if (!user) return;
      queryClient.invalidateQueries({
        queryKey: closeKpiKeys.dashboard(user?.id ?? ""),
      });
    },
  });
}

export function useDeleteWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (widgetId: string) => {
      await deleteWidget(widgetId);
    },
    onSuccess: () => {
      if (!user) return;
      queryClient.invalidateQueries({
        queryKey: closeKpiKeys.dashboard(user?.id ?? ""),
      });
    },
  });
}

export function useReorderWidgets() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (widgets: { id: string; position_order: number }[]) => {
      await reorderWidgets(widgets);
    },
    onSuccess: () => {
      if (!user) return;
      queryClient.invalidateQueries({
        queryKey: closeKpiKeys.dashboard(user?.id ?? ""),
      });
    },
  });
}

export function useUpdateDashboardConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      dashboardId: string;
      globalConfig: GlobalDashboardConfig;
    }) => {
      await updateDashboardConfig(params.dashboardId, params.globalConfig);
    },
    onSuccess: () => {
      if (!user) return;
      queryClient.invalidateQueries({
        queryKey: closeKpiKeys.dashboard(user?.id ?? ""),
      });
    },
  });
}

// ─── Templates Query ───────────────────────────────────────────────

export function useKpiTemplates() {
  return useQuery({
    queryKey: closeKpiKeys.templates(),
    queryFn: getTemplates,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });
}

// ─── Close Metadata (single call for all metadata) ────────────────

export function useCloseMetadata(enabled = true) {
  return useQuery<CloseMetadataResponse>({
    queryKey: closeKpiKeys.closeMetadata(),
    queryFn: () => closeKpiService.getMetadata(),
    staleTime: 10 * 60 * 1000, // Metadata changes rarely
    gcTime: 30 * 60 * 1000,
    enabled,
  });
}

export function useCloseLeadStatuses(enabled = true) {
  const { data } = useCloseMetadata(enabled);
  return { data: data?.statuses ?? [], isLoading: !data && enabled };
}

export function useCloseLeadSources(enabled = true) {
  const { data } = useCloseMetadata(enabled);
  // Map custom fields to find lead sources
  const sources = (data?.customFields ?? [])
    .filter((f) => f.name.toLowerCase().includes("source"))
    .flatMap((f) => (f.choices ?? []).map((c) => ({ id: c, label: c })));
  return { data: sources, isLoading: !data && enabled };
}

export function useCloseSmartViews(enabled = true) {
  const { data } = useCloseMetadata(enabled);
  return { data: data?.smartViews ?? [], isLoading: !data && enabled };
}

// ─── Starter Widgets ───────────────────────────────────────────────
// Seeded on first visit so the dashboard isn't empty

const STARTER_WIDGETS: {
  widgetType: WidgetType;
  title: string;
  size: WidgetSize;
  config: WidgetConfig;
}[] = [
  {
    widgetType: "stat_card",
    title: "New Leads This Week",
    size: "small",
    config: {
      metric: "leads_created",
      dateRange: "this_week",
      comparison: "previous_period",
    },
  },
  {
    widgetType: "status_distribution",
    title: "Lead Pipeline by Status",
    size: "medium",
    config: {
      groupBy: "status",
      dateRange: "this_month",
      comparison: "none",
      sortOrder: "count_desc",
    },
  },
  {
    widgetType: "call_analytics",
    title: "Call Connect Rate",
    size: "small",
    config: {
      metric: "call_connect_rate",
      direction: "outgoing",
      dateRange: "this_week",
      comparison: "previous_period",
    },
  },
];

async function seedStarterWidgets(dashboardId: string, userId: string) {
  await Promise.all(
    STARTER_WIDGETS.map((s, i) =>
      createWidget({
        dashboardId,
        userId,
        widgetType: s.widgetType,
        title: s.title,
        size: s.size,
        config: s.config,
        positionOrder: i,
      }),
    ),
  );
}
