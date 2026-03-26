// src/features/close-kpi/services/kpiDashboardService.ts
// Supabase CRUD for dashboard configs, widgets, and cache

import { supabase } from "@/services/base/supabase";
import type {
  CloseKpiDashboard,
  CloseKpiWidget,
  CloseKpiWidgetTemplate,
  WidgetConfig,
  WidgetType,
  WidgetSize,
  GlobalDashboardConfig,
} from "../types/close-kpi.types";

// ─── Dashboard CRUD ────────────────────────────────────────────────

export async function getDashboard(
  userId: string,
): Promise<CloseKpiDashboard | null> {
  const { data, error } = await supabase
    .from("close_kpi_dashboards")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createDashboard(
  userId: string,
  name = "My Dashboard",
): Promise<CloseKpiDashboard> {
  const { data, error } = await supabase
    .from("close_kpi_dashboards")
    .insert({ user_id: userId, name })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDashboardConfig(
  dashboardId: string,
  globalConfig: GlobalDashboardConfig,
): Promise<void> {
  const { error } = await supabase
    .from("close_kpi_dashboards")
    .update({ global_config: globalConfig })
    .eq("id", dashboardId);
  if (error) throw new Error(error.message);
}

// ─── Widget CRUD ───────────────────────────────────────────────────

export async function getWidgets(
  dashboardId: string,
): Promise<CloseKpiWidget[]> {
  const { data, error } = await supabase
    .from("close_kpi_widgets")
    .select("*")
    .eq("dashboard_id", dashboardId)
    .order("position_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createWidget(params: {
  dashboardId: string;
  userId: string;
  widgetType: WidgetType;
  title: string;
  size: WidgetSize;
  config: WidgetConfig;
  positionOrder: number;
}): Promise<CloseKpiWidget> {
  const { data, error } = await supabase
    .from("close_kpi_widgets")
    .insert({
      dashboard_id: params.dashboardId,
      user_id: params.userId,
      widget_type: params.widgetType,
      title: params.title,
      size: params.size,
      config: params.config,
      position_order: params.positionOrder,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateWidget(
  widgetId: string,
  updates: Partial<{
    title: string;
    size: WidgetSize;
    config: WidgetConfig;
    position_order: number;
  }>,
): Promise<void> {
  const { error } = await supabase
    .from("close_kpi_widgets")
    .update(updates)
    .eq("id", widgetId);
  if (error) throw new Error(error.message);
}

export async function deleteWidget(widgetId: string): Promise<void> {
  const { error } = await supabase
    .from("close_kpi_widgets")
    .delete()
    .eq("id", widgetId);
  if (error) throw new Error(error.message);
}

export async function reorderWidgets(
  widgets: { id: string; position_order: number }[],
): Promise<void> {
  // Batch update using individual calls (Supabase doesn't support bulk upsert
  // with partial updates on non-PK conflict columns well)
  const promises = widgets.map((w) =>
    supabase
      .from("close_kpi_widgets")
      .update({ position_order: w.position_order })
      .eq("id", w.id),
  );
  const results = await Promise.all(promises);
  const firstError = results.find((r) => r.error);
  if (firstError?.error) throw new Error(firstError.error.message);
}

// ─── Templates ─────────────────────────────────────────────────────

export async function getTemplates(): Promise<CloseKpiWidgetTemplate[]> {
  const { data, error } = await supabase
    .from("close_kpi_widget_templates")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
