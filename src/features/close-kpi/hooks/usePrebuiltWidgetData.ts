// src/features/close-kpi/hooks/usePrebuiltWidgetData.ts
// Fetches the pre-built dashboard through one batched Close rollup query.
// Lead heat widgets stay on their existing precomputed Supabase path.

import { useQueries, useQuery } from "@tanstack/react-query";
import { generateCacheKey } from "../lib/cache-key";
import { getDateRangeBounds } from "../lib/kpi-calculations";
import { fetchWidgetData } from "./useKpiWidgetData";
import { closeKpiService } from "../services/closeKpiService";
import {
  CLOSE_KPI_PREBUILT_ROLLUP_VERSION,
  closeKpiKeys,
} from "./useCloseKpiDashboard";
import {
  DASHBOARD_SECTIONS,
  type PrebuiltWidgetDef,
} from "../config/prebuilt-layout";
import type {
  CloseKpiWidget,
  DateRangePreset,
  PrebuiltCloseApiWidgetId,
  WidgetResult,
  WidgetSize,
} from "../types/close-kpi.types";

function buildSyntheticWidget(
  def: PrebuiltWidgetDef,
  dateRange: DateRangePreset,
): CloseKpiWidget {
  return {
    id: def.id,
    dashboard_id: "prebuilt",
    user_id: "prebuilt",
    widget_type: def.type,
    title: def.title,
    size: (def.size === "full" ? "large" : def.size) as WidgetSize,
    config: def.buildConfig(dateRange),
    position_order: 0,
    created_at: "",
    updated_at: "",
  };
}

const LEAD_HEAT_WIDGET_TYPES = new Set([
  "lead_heat_summary",
  "lead_heat_list",
  "lead_heat_ai_insights",
]);

const CLOSE_API_WIDGET_IDS = new Set<PrebuiltCloseApiWidgetId>([
  "total_leads",
  "new_leads",
  "speed_to_lead",
  "status_dist",
  "lifecycle",
  "call_analytics",
  "best_call_times",
  "vm_rate",
  "contact_cadence",
  "dial_attempts",
  "opp_funnel",
  "cross_ref",
]);

interface PrebuiltWidgetState {
  data: WidgetResult | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePrebuiltDashboardData(dateRange: DateRangePreset) {
  const { from, to } = getDateRangeBounds(dateRange);
  const rollupCacheKey = generateCacheKey("prebuilt_dashboard_rollup", {
    dateRange,
    from,
    to,
    version: CLOSE_KPI_PREBUILT_ROLLUP_VERSION,
  });

  const rollupQuery = useQuery({
    queryKey: closeKpiKeys.prebuiltRollup(
      CLOSE_KPI_PREBUILT_ROLLUP_VERSION,
      rollupCacheKey,
    ),
    queryFn: () =>
      closeKpiService.getPrebuiltDashboardRollup({
        dateRange,
        from,
        to,
      }),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const allWidgets = DASHBOARD_SECTIONS.flatMap((section) =>
    section.widgets.map((w) => ({
      sectionId: section.id,
      def: w,
    })),
  );

  const leadHeatWidgets = allWidgets.filter(({ def }) =>
    LEAD_HEAT_WIDGET_TYPES.has(def.type),
  );

  const leadHeatResults = useQueries({
    queries: leadHeatWidgets.map(({ def }) => {
      const syntheticWidget = buildSyntheticWidget(def, dateRange);
      const cacheKey = generateCacheKey(def.type, syntheticWidget.config);

      return {
        queryKey: closeKpiKeys.prebuiltWidget(
          "lead-heat",
          def.type,
          def.id,
          cacheKey,
        ),
        queryFn: async (): Promise<WidgetResult | null> =>
          fetchWidgetData(syntheticWidget),
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchInterval: 10 * 60_000,
        retry: 1,
      };
    }),
  });

  const leadHeatStateMap = new Map<string, PrebuiltWidgetState>();
  leadHeatWidgets.forEach(({ def }, index) => {
    const result = leadHeatResults[index];
    leadHeatStateMap.set(def.id, {
      data: (result?.data as WidgetResult) ?? null,
      isLoading: result?.isLoading ?? true,
      error: (result?.error as Error | null) ?? null,
      refetch: () => {
        void result?.refetch();
      },
    });
  });

  const widgetDataMap = new Map<string, PrebuiltWidgetState>();
  allWidgets.forEach(({ def }) => {
    if (CLOSE_API_WIDGET_IDS.has(def.id as PrebuiltCloseApiWidgetId)) {
      widgetDataMap.set(def.id, {
        data:
          (rollupQuery.data?.widgets[
            def.id as PrebuiltCloseApiWidgetId
          ] as WidgetResult | null) ?? null,
        isLoading: rollupQuery.isLoading,
        error: (rollupQuery.error as Error | null) ?? null,
        refetch: () => {
          void rollupQuery.refetch();
        },
      });
      return;
    }

    const leadHeatState = leadHeatStateMap.get(def.id);
    widgetDataMap.set(
      def.id,
      leadHeatState ?? {
        data: null,
        isLoading: true,
        error: null,
        refetch: () => undefined,
      },
    );
  });

  return {
    widgetDataMap,
    isCloseApiLoading: rollupQuery.isLoading,
  };
}
