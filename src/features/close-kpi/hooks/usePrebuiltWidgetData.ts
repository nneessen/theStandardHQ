// src/features/close-kpi/hooks/usePrebuiltWidgetData.ts
// Fetches data for all pre-built widgets in parallel using useQueries.
// Reuses the shared fetchWidgetData dispatcher from useKpiWidgetData.

import { useQueries, useQuery } from "@tanstack/react-query";
import { closeKpiService } from "../services/closeKpiService";
import { fetchWidgetData } from "./useKpiWidgetData";
import {
  DASHBOARD_SECTIONS,
  type PrebuiltWidgetDef,
} from "../config/prebuilt-layout";
import type {
  CloseKpiWidget,
  DateRangePreset,
  WidgetResult,
  WidgetSize,
  VmRateSmartViewConfig,
  CrossReferenceConfig,
} from "../types/close-kpi.types";

// ─── Build synthetic widget objects for the shared fetcher ────────────

function buildSyntheticWidget(
  def: PrebuiltWidgetDef,
  dateRange: DateRangePreset,
  smartViewIds?: string[],
): CloseKpiWidget {
  let config = def.buildConfig(dateRange);

  // Auto-populate smart view IDs for VM rate and cross-reference
  if (def.type === "vm_rate_smart_view" && smartViewIds?.length) {
    config = {
      ...config,
      smartViewIds: smartViewIds.slice(0, 5),
    } as VmRateSmartViewConfig;
  }
  if (def.type === "cross_reference" && smartViewIds?.length) {
    config = { ...config, smartViewIds } as CrossReferenceConfig;
  }

  return {
    id: def.id,
    dashboard_id: "prebuilt",
    user_id: "prebuilt",
    widget_type: def.type,
    title: def.title,
    size: (def.size === "full" ? "large" : def.size) as WidgetSize,
    config,
    position_order: 0,
    created_at: "",
    updated_at: "",
  };
}

// ─── Types ────────────────────────────────────────────────────────────

const SMART_VIEW_WIDGET_TYPES = new Set([
  "vm_rate_smart_view",
  "cross_reference",
]);

interface PrebuiltWidgetState {
  data: WidgetResult | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

// ─── Main Hook ────────────────────────────────────────────────────────

export function usePrebuiltDashboardData(dateRange: DateRangePreset) {
  // First, fetch Close metadata to get smart view IDs for auto-population
  const { data: metadata } = useQuery({
    queryKey: ["close-metadata-prebuilt"],
    queryFn: () => closeKpiService.getMetadata(),
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const smartViewIds = metadata?.smartViews?.map((sv) => sv.id) ?? [];

  // Flatten all widget definitions across all sections
  const allWidgets = DASHBOARD_SECTIONS.flatMap((section) =>
    section.widgets.map((w) => ({
      sectionId: section.id,
      def: w,
    })),
  );

  // Create a query for each widget, reusing the shared fetchWidgetData dispatcher
  const queries = allWidgets.map(({ def }) => {
    const needsSmartViews = SMART_VIEW_WIDGET_TYPES.has(def.type);
    const syntheticWidget = buildSyntheticWidget(def, dateRange, smartViewIds);

    return {
      // Only include smartViewIds.length in key for widgets that use them (M1 fix)
      queryKey: [
        "prebuilt-widget",
        def.id,
        dateRange,
        needsSmartViews ? smartViewIds.length : 0,
      ],
      queryFn: async (): Promise<WidgetResult | null> => {
        // Delegate to the shared fetcher — handles all 14 widget types correctly
        return fetchWidgetData(syntheticWidget);
      },
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      // Only auto-refresh lead heat widgets (pre-computed, cheap) — not Close API widgets
      refetchInterval: def.type.startsWith("lead_heat_")
        ? 10 * 60_000
        : undefined,
      retry: 1,
      // Smart view widgets wait for metadata; lead heat + everything else fires immediately
      enabled: needsSmartViews ? smartViewIds.length > 0 : true,
    };
  });

  const results = useQueries({ queries });

  // Build a map: widgetId → { data, isLoading, error, refetch }
  const widgetDataMap = new Map<string, PrebuiltWidgetState>();
  allWidgets.forEach(({ def }, i) => {
    const result = results[i];
    widgetDataMap.set(def.id, {
      data: (result?.data as WidgetResult) ?? null,
      isLoading: result?.isLoading ?? true,
      error: result?.error as Error | null,
      refetch: () => result?.refetch(),
    });
  });

  return { widgetDataMap, isMetadataLoading: !metadata };
}
