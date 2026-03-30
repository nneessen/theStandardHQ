// src/features/close-kpi/hooks/usePrebuiltWidgetData.ts
// Fetches data for all pre-built widgets in parallel using useQueries.
// Reuses the existing per-widget fetcher functions from useKpiWidgetData.

import { useQueries, useQuery } from "@tanstack/react-query";
import { closeKpiService } from "../services/closeKpiService";
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

// ─── Build synthetic widget objects for the existing fetcher ──────────

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

// ─── Main Hook ────────────────────────────────────────────────────────

interface PrebuiltWidgetState {
  data: WidgetResult | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

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

  // Create a query for each widget using the existing fetcher pattern
  const queries = allWidgets.map(({ def }) => {
    const syntheticWidget = buildSyntheticWidget(def, dateRange, smartViewIds);
    return {
      queryKey: ["prebuilt-widget", def.id, dateRange, smartViewIds.length],
      queryFn: async (): Promise<WidgetResult | null> => {
        // Use the same dispatch logic as existing useKpiWidgetData
        // by invoking the hook's internal fetcher via a re-export
        return fetchPrebuiltWidgetData(syntheticWidget);
      },
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchInterval: 10 * 60_000,
      retry: 1,
      enabled: def.type.startsWith("lead_heat_")
        ? true
        : smartViewIds.length > 0 ||
          !["vm_rate_smart_view", "cross_reference"].includes(def.type),
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

// ─── Fetcher (reuses the same service methods as useKpiWidgetData) ────

async function fetchPrebuiltWidgetData(
  widget: CloseKpiWidget,
): Promise<WidgetResult | null> {
  // This is a lightweight wrapper that delegates to the service layer
  // using the same pattern as fetchWidgetData in useKpiWidgetData.ts
  const { supabase } = await import("@/services/base/supabase");
  const { getDateRangeBounds, calculateChangePercent, getComparisonBounds } =
    await import("../lib/kpi-calculations");

  const config = widget.config;
  const type = widget.widget_type;

  // Lead Heat widgets read from Supabase (pre-computed)
  if (type === "lead_heat_summary") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return closeKpiService.getLeadHeatSummary(session.user.id);
  }
  if (type === "lead_heat_list") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return closeKpiService.getLeadHeatList({
      userId: session.user.id,
      filterLevel: (config as { filterLevel?: string }).filterLevel ?? "all",
      sortBy: (config as { sortBy?: string }).sortBy ?? "score_desc",
      page: 1,
      pageSize: (config as { pageSize?: number }).pageSize ?? 25,
    });
  }
  if (type === "lead_heat_ai_insights") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return closeKpiService.getLeadHeatAiInsights(session.user.id);
  }

  // Close API widgets — use the existing service methods
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    (config as { customFrom?: string }).customFrom,
    (config as { customTo?: string }).customTo,
  );

  switch (type) {
    case "stat_card": {
      const metric = (config as { metric: string }).metric;
      let value = 0;
      let label = "Total";

      if (metric === "lead_count" || metric === "leads_created") {
        const res = await closeKpiService.searchLeads({ from, to, limit: 1 });
        value = res.totalResults;
        label = metric === "leads_created" ? "New Leads" : "Total Leads";
      }

      let previousValue: number | undefined;
      let changePercent: number | undefined;
      if (
        (config as { comparison?: string }).comparison === "previous_period"
      ) {
        const comp = getComparisonBounds(from, to);
        try {
          const prev = await closeKpiService.searchLeads({
            from: comp.from,
            to: comp.to,
            limit: 1,
          });
          previousValue = prev.totalResults;
          changePercent =
            calculateChangePercent(value, previousValue) ?? undefined;
        } catch {
          // Comparison is non-critical
        }
      }

      return { value, previousValue, changePercent, label };
    }

    case "status_distribution": {
      const res = await closeKpiService.getLeadCounts({ from, to });
      const items = [...res.byStatus].sort((a, b) => b.count - a.count);
      return { items, total: items.reduce((s, i) => s + i.count, 0) };
    }

    case "call_analytics": {
      const res = await closeKpiService.getActivities({
        from,
        to,
        types: ["call"],
      });
      const call = res.call;
      if (!call)
        return {
          total: 0,
          answered: 0,
          voicemail: 0,
          missed: 0,
          inbound: 0,
          outbound: 0,
          connectRate: 0,
          totalDurationMin: 0,
          avgDurationMin: 0,
        };
      return {
        total: call.total,
        answered: call.answered,
        voicemail: call.voicemail,
        missed: call.missed,
        inbound: call.inbound,
        outbound: call.outbound,
        connectRate: call.connectRate,
        totalDurationMin: call.totalDurationMin,
        avgDurationMin: call.avgDurationMin,
        isTruncated: call.isTruncated,
        byDisposition: Object.entries(call.byDisposition).map(([d, c]) => ({
          disposition: d,
          count: c,
        })),
        byDirection: [
          { direction: "inbound", count: call.inbound },
          { direction: "outbound", count: call.outbound },
        ],
      };
    }

    case "opportunity_summary": {
      const res = await closeKpiService.getOpportunities({ from, to });
      return {
        totalValue: res.totalValue,
        dealCount: res.total,
        activeCount: res.activeCount,
        wonCount: res.wonCount,
        wonValue: res.wonValue,
        lostCount: res.lostCount,
        winRate: res.winRate,
        avgDealSize: res.avgDealSize,
        stalledCount: 0,
        avgTimeToClose: res.avgTimeToCloseDays,
        salesVelocity:
          res.avgTimeToCloseDays > 0
            ? Math.round(
                ((res.wonCount * res.avgDealSize * (res.winRate / 100)) /
                  res.avgTimeToCloseDays) *
                  100,
              ) / 100
            : 0,
        byStatus: res.byStatus,
      };
    }

    case "lifecycle_tracker": {
      const lcConfig = config as {
        fromStatus: string;
        toStatus?: string | null;
      };
      const res = await closeKpiService.getLeadStatusChanges({
        from,
        to,
        fromStatus: lcConfig.fromStatus,
        toStatus: lcConfig.toStatus ?? undefined,
      });
      return { transitions: res.transitions };
    }

    case "vm_rate_smart_view": {
      const vmConfig = config as {
        smartViewIds: string[];
        firstCallOnly: boolean;
      };
      if (!vmConfig.smartViewIds?.length) {
        return {
          rows: [],
          overall: { totalFirstCalls: 0, vmCount: 0, vmRate: 0 },
        };
      }
      return closeKpiService.getVmRateBySmartView({
        from,
        to,
        smartViewIds: vmConfig.smartViewIds,
        firstCallOnly: vmConfig.firstCallOnly,
      });
    }

    case "best_call_times":
      return closeKpiService.getBestCallTimes({ from, to });

    case "cross_reference": {
      const crConfig = config as {
        smartViewIds: string[];
        statusIds?: string[];
      };
      if (!crConfig.smartViewIds?.length) {
        return { rows: [], statusLabels: [], totals: {}, grandTotal: 0 };
      }
      return closeKpiService.getCrossReference({
        smartViewIds: crConfig.smartViewIds,
        statusIds: crConfig.statusIds?.length ? crConfig.statusIds : undefined,
      });
    }

    case "speed_to_lead":
      return closeKpiService.getSpeedToLead({ from, to });

    case "contact_cadence":
      return closeKpiService.getContactCadence({ from, to });

    case "dial_attempts":
      return closeKpiService.getDialAttempts({ from, to });

    default:
      return null;
  }
}
