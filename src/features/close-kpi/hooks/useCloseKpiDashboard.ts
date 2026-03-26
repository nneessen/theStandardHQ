// src/features/close-kpi/hooks/useCloseKpiDashboard.ts
// TanStack Query hooks for dashboard + widget CRUD (Supabase direct)

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import type {
  DashboardWithWidgets,
  GlobalDashboardConfig,
  WidgetType,
  WidgetSize,
  WidgetConfig,
} from "../types/close-kpi.types";
import { WIDGET_REGISTRY } from "../config/widget-registry";

// ─── Query Keys ────────────────────────────────────────────────────

export const closeKpiKeys = {
  all: ["close-kpi"] as const,
  dashboard: (userId: string) =>
    [...closeKpiKeys.all, "dashboard", userId] as const,
  widgets: (dashboardId: string) =>
    [...closeKpiKeys.all, "widgets", dashboardId] as const,
  templates: () => [...closeKpiKeys.all, "templates"] as const,
  cache: (widgetId: string) =>
    [...closeKpiKeys.all, "cache", widgetId] as const,
  closeMetadata: () => [...closeKpiKeys.all, "close-metadata"] as const,
  leadStatuses: () => [...closeKpiKeys.all, "lead-statuses"] as const,
  leadSources: () => [...closeKpiKeys.all, "lead-sources"] as const,
  smartViews: () => [...closeKpiKeys.all, "smart-views"] as const,
};

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
  });
}

// ─── Close Metadata (single call for all metadata) ────────────────

import type { CloseMetadataResponse } from "../services/closeKpiService";

export function useCloseMetadata(enabled = true) {
  return useQuery<CloseMetadataResponse>({
    queryKey: closeKpiKeys.closeMetadata(),
    queryFn: async () => {
      const { closeKpiService } = await import("../services/closeKpiService");
      return closeKpiService.getMetadata();
    },
    staleTime: 10 * 60 * 1000, // Metadata changes rarely
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
  for (let i = 0; i < STARTER_WIDGETS.length; i++) {
    const s = STARTER_WIDGETS[i];
    await createWidget({
      dashboardId,
      userId,
      widgetType: s.widgetType,
      title: s.title,
      size: s.size,
      config: s.config,
      positionOrder: i,
    });
  }
}
