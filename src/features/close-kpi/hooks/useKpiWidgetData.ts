// src/features/close-kpi/hooks/useKpiWidgetData.ts
// Widget data fetching — calls Close API v1 via close-kpi-data edge function.
// Each widget type has a dedicated fetcher that returns real Close CRM data.

import { useQuery } from "@tanstack/react-query";
import { closeKpiKeys } from "./useCloseKpiDashboard";
import { generateCacheKey } from "../lib/cache-key";
import { closeKpiService } from "../services/closeKpiService";
import { supabase } from "@/services/base/supabase";
import {
  getDateRangeBounds,
  getComparisonBounds,
  calculateChangePercent,
} from "../lib/kpi-calculations";
import { METRIC_CATALOG } from "../config/widget-registry";
import type {
  CloseKpiWidget,
  WidgetResult,
  StatCardConfig,
  StatCardResult,
  StatusDistributionConfig,
  StatusDistributionResult,
  CallAnalyticsConfig,
  CallAnalyticsResult,
  OpportunitySummaryConfig,
  OpportunitySummaryResult,
  LifecycleTrackerConfig,
  LifecycleTrackerResult,
  VmRateSmartViewConfig,
  VmRateSmartViewResult,
  BestCallTimesResult,
  CrossReferenceConfig,
  CrossReferenceResult,
  SpeedToLeadResult,
  ContactCadenceResult,
  DialAttemptsResult,
  LeadHeatSummaryResult,
  LeadHeatListResult,
  LeadHeatAiInsightsResult,
  LeadHeatListConfig,
  GlobalDashboardConfig,
} from "../types/close-kpi.types";

// ─── Main Hook ─────────────────────────────────────────────────────

export function useKpiWidgetData(
  widget: CloseKpiWidget | null,
  globalConfig?: GlobalDashboardConfig,
) {
  const cacheKey = widget
    ? generateCacheKey(
        widget.widget_type,
        widget.config,
        globalConfig?.dateRange,
      )
    : "";

  return useQuery<WidgetResult | null>({
    // Include cacheKey so config changes trigger refetch (Bug 7 fix)
    queryKey: [...closeKpiKeys.cache(widget?.id ?? "none"), cacheKey],
    queryFn: async () => {
      if (!widget) return null;
      return fetchWidgetData(widget, globalConfig);
    },
    enabled: !!widget,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: 10 * 60_000,
    retry: 1,
    // Bug 4 fix: errors propagate to useQuery error state — no silent zeroes
  });
}

// ─── Widget Data Fetcher (dispatches by type) ──────────────────────

async function fetchWidgetData(
  widget: CloseKpiWidget,
  globalConfig?: GlobalDashboardConfig,
): Promise<WidgetResult> {
  // Use global date range ONLY when widget has no explicit date range set.
  // Never override a widget's chosen date range — the user set it deliberately.
  const widgetDateRange = widget.config.dateRange;
  const effectiveDateRange = widgetDateRange
    ? widgetDateRange
    : (globalConfig?.dateRange ?? "this_month");

  const config = { ...widget.config, dateRange: effectiveDateRange };

  switch (widget.widget_type) {
    case "stat_card":
      return fetchStatCard(config as StatCardConfig);
    case "status_distribution":
      return fetchStatusDistribution(config as StatusDistributionConfig);
    case "call_analytics":
      return fetchCallAnalytics(config as CallAnalyticsConfig);
    case "opportunity_summary":
      return fetchOpportunitySummary(config as OpportunitySummaryConfig);
    case "lifecycle_tracker":
      return fetchLifecycleTracker(config as LifecycleTrackerConfig);
    case "vm_rate_smart_view":
      return fetchVmRateSmartView(config as VmRateSmartViewConfig);
    case "best_call_times":
      return fetchBestCallTimes(config);
    case "cross_reference":
      return fetchCrossReference(config as CrossReferenceConfig);
    case "speed_to_lead":
      return fetchSpeedToLead(config);
    case "contact_cadence":
      return fetchContactCadence(config);
    case "dial_attempts":
      return fetchDialAttempts(config);
    case "lead_heat_summary":
      return fetchLeadHeatSummary();
    case "lead_heat_list":
      return fetchLeadHeatList(config as LeadHeatListConfig);
    case "lead_heat_ai_insights":
      return fetchLeadHeatAiInsights();
    default:
      throw new Error(`Unknown widget type: ${widget.widget_type}`);
  }
}

// ─── Stat Card Fetcher (Bugs 1, 10, 14 fix) ───────────────────────

async function fetchStatCard(config: StatCardConfig): Promise<StatCardResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );
  const metricDef = METRIC_CATALOG.find((m) => m.key === config.metric);

  let value = 0;
  let label = metricDef?.label ?? "Total";
  let unit = metricDef?.unit;

  const metric = config.metric;

  // Lead metrics → use real Close lead search
  if (metric === "lead_count" || metric === "leads_created") {
    const res = await closeKpiService.searchLeads({
      from,
      to,
      statusId: config.leadStatusId ?? undefined,
      smartViewId: config.smartViewId ?? undefined,
      limit: 1,
    });
    value = res.totalResults;
    label = config.leadStatusId ? `Leads (filtered)` : "Leads";
  }
  // Call metrics → use real Close call activities
  else if (metric.startsWith("calls_") || metric.startsWith("call_")) {
    const res = await closeKpiService.getActivities({
      from,
      to,
      types: ["call"],
    });
    if (res.call) {
      switch (metric) {
        case "calls_total":
          value = res.call.total;
          break;
        case "calls_inbound":
          value = res.call.inbound;
          break;
        case "calls_outbound":
          value = res.call.outbound;
          break;
        case "calls_answered":
          value = res.call.answered;
          break;
        case "calls_voicemail":
          value = res.call.voicemail;
          break;
        case "calls_missed":
          value = res.call.missed;
          break;
        case "call_duration_total":
          value = res.call.totalDurationMin;
          unit = "minutes";
          break;
        case "call_duration_avg":
          value = res.call.avgDurationMin;
          unit = "minutes";
          break;
        case "call_connect_rate":
          value = res.call.connectRate;
          unit = "percent";
          break;
        default:
          value = res.call.total;
      }
    }
  }
  // Email metrics — direction-aware
  else if (metric.startsWith("emails_")) {
    const res = await closeKpiService.getActivities({
      from,
      to,
      types: ["email"],
    });
    if (res.email) {
      switch (metric) {
        case "emails_sent":
          value = res.email.sent;
          break;
        case "emails_received":
          value = res.email.received;
          break;
        case "emails_total":
        default:
          value = res.email.total;
      }
    }
  }
  // SMS metrics — direction-aware
  else if (metric.startsWith("sms_")) {
    const res = await closeKpiService.getActivities({
      from,
      to,
      types: ["sms"],
    });
    if (res.sms) {
      switch (metric) {
        case "sms_sent":
          value = res.sms.sent;
          break;
        case "sms_received":
          value = res.sms.received;
          break;
        case "sms_total":
        default:
          value = res.sms.total;
      }
    }
  }
  // Opportunity metrics → real Close opportunity data
  else if (
    [
      "pipeline_value",
      "pipeline_count",
      "win_rate",
      "avg_deal_size",
      "sales_velocity",
      "avg_time_to_close",
      "deals_won",
      "deals_lost",
      "deals_won_value",
    ].includes(metric)
  ) {
    const statusType = ["deals_won", "deals_won_value"].includes(metric)
      ? "won"
      : metric === "deals_lost"
        ? "lost"
        : undefined;
    const res = await closeKpiService.getOpportunities({
      from,
      to,
      statusType,
    });
    switch (metric) {
      case "pipeline_value":
        value = res.totalValue;
        unit = "currency";
        break;
      case "pipeline_count":
        value = res.activeCount;
        break;
      case "win_rate":
        value = res.winRate;
        unit = "percent";
        break;
      case "avg_deal_size":
        value = res.avgDealSize;
        unit = "currency";
        break;
      case "avg_time_to_close":
        value = res.avgTimeToCloseDays;
        unit = "duration_days";
        break;
      case "deals_won":
        value = res.wonCount;
        break;
      case "deals_lost":
        value = res.lostCount;
        break;
      case "deals_won_value":
        value = res.wonValue;
        unit = "currency";
        break;
      case "sales_velocity": {
        // Sales velocity = (# opps × avg deal × win rate) / avg time to win
        const velocity =
          res.avgTimeToCloseDays > 0
            ? (res.wonCount * res.avgDealSize * (res.winRate / 100)) /
              res.avgTimeToCloseDays
            : 0;
        value = Math.round(velocity * 100) / 100;
        unit = "currency";
        break;
      }
      default:
        value = res.total;
    }
  }

  // Comparison period
  let previousValue: number | undefined;
  let changePercent: number | undefined;
  if (config.comparison === "previous_period") {
    const comp = getComparisonBounds(from, to);
    // Re-fetch same metric for previous period
    const prevConfig = {
      ...config,
      dateRange: "custom" as const,
      customFrom: comp.from,
      customTo: comp.to,
      comparison: "none" as const,
    };
    try {
      const prev = await fetchStatCard(prevConfig);
      previousValue = prev.value;
      changePercent = calculateChangePercent(value, previousValue) ?? undefined;
    } catch {
      // Comparison is non-critical
    }
  }

  return {
    value,
    previousValue,
    changePercent,
    label,
    unit,
  };
}

// ─── Status Distribution Fetcher (Bugs 2, 3, 5 fix) ───────────────

async function fetchStatusDistribution(
  config: StatusDistributionConfig,
): Promise<StatusDistributionResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );

  let items: { id: string; label: string; count: number }[] = [];

  // Currently only status grouping is fully implemented.
  // Source/custom field grouping requires the Close Advanced Filtering API.
  const res = await closeKpiService.getLeadCounts({
    from,
    to,
    smartViewId: config.smartViewId ?? undefined,
  });
  items = res.byStatus;

  // Sort
  if (config.sortOrder === "count_desc") {
    items.sort((a, b) => b.count - a.count);
  } else if (config.sortOrder === "count_asc") {
    items.sort((a, b) => a.count - b.count);
  } else {
    items.sort((a, b) => a.label.localeCompare(b.label));
  }

  // Filter hidden
  const visible = config.hiddenIds?.length
    ? items.filter((i) => !config.hiddenIds!.includes(i.id))
    : items;

  return {
    items: visible,
    total: visible.reduce((sum, i) => sum + i.count, 0),
  };
}

// ─── Call Analytics Fetcher (Bug 8 fix) ────────────────────────────

async function fetchCallAnalytics(
  config: CallAnalyticsConfig,
): Promise<CallAnalyticsResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );

  const res = await closeKpiService.getActivities({
    from,
    to,
    types: ["call"],
  });
  const call = res.call;

  if (!call) {
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
  }

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
    byDisposition: Object.entries(call.byDisposition).map(
      ([disposition, count]) => ({
        disposition,
        count,
      }),
    ),
    byDirection: [
      { direction: "inbound", count: call.inbound },
      { direction: "outbound", count: call.outbound },
    ],
  };
}

// ─── Opportunity Summary Fetcher ───────────────────────────────────

async function fetchOpportunitySummary(
  config: OpportunitySummaryConfig,
): Promise<OpportunitySummaryResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );

  const res = await closeKpiService.getOpportunities({
    from,
    to,
    statusType: config.statusType,
  });

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

// ─── Lifecycle Tracker Fetcher ─────────────────────────────────────

async function fetchLifecycleTracker(
  config: LifecycleTrackerConfig,
): Promise<LifecycleTrackerResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );

  const res = await closeKpiService.getLeadStatusChanges({
    from,
    to,
    fromStatus: config.fromStatus,
    toStatus: config.toStatus ?? undefined,
  });

  return { transitions: res.transitions };
}

// ─── VM Rate by Smart View Fetcher ──────────────────────────────────

async function fetchVmRateSmartView(
  config: VmRateSmartViewConfig,
): Promise<VmRateSmartViewResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );

  if (!config.smartViewIds || config.smartViewIds.length === 0) {
    return {
      rows: [],
      overall: { totalFirstCalls: 0, vmCount: 0, vmRate: 0 },
    };
  }

  return closeKpiService.getVmRateBySmartView({
    from,
    to,
    smartViewIds: config.smartViewIds,
    firstCallOnly: config.firstCallOnly,
  });
}

// ─── Best Call Times Fetcher ─────────────────────────────────────

async function fetchBestCallTimes(config: {
  dateRange: string;
  customFrom?: string;
  customTo?: string;
}): Promise<BestCallTimesResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );
  return closeKpiService.getBestCallTimes({ from, to });
}

// ─── Cross-Reference Fetcher ─────────────────────────────────────

async function fetchCrossReference(
  config: CrossReferenceConfig,
): Promise<CrossReferenceResult> {
  if (!config.smartViewIds || config.smartViewIds.length === 0) {
    return { rows: [], statusLabels: [], totals: {}, grandTotal: 0 };
  }
  return closeKpiService.getCrossReference({
    smartViewIds: config.smartViewIds,
    statusIds: config.statusIds?.length ? config.statusIds : undefined,
  });
}

// ─── Speed to Lead Fetcher ───────────────────────────────────────

async function fetchSpeedToLead(config: {
  dateRange: string;
  customFrom?: string;
  customTo?: string;
  smartViewId?: string | null;
}): Promise<SpeedToLeadResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );
  return closeKpiService.getSpeedToLead({
    from,
    to,
    smartViewId: config.smartViewId ?? undefined,
  });
}

// ─── Contact Cadence Fetcher ─────────────────────────────────────

async function fetchContactCadence(config: {
  dateRange: string;
  customFrom?: string;
  customTo?: string;
  smartViewId?: string | null;
}): Promise<ContactCadenceResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );
  return closeKpiService.getContactCadence({
    from,
    to,
    smartViewId: config.smartViewId ?? undefined,
  });
}

// ─── Dial Attempts Fetcher ───────────────────────────────────────

async function fetchDialAttempts(config: {
  dateRange: string;
  customFrom?: string;
  customTo?: string;
  smartViewId?: string | null;
}): Promise<DialAttemptsResult> {
  const { from, to } = getDateRangeBounds(
    config.dateRange,
    config.customFrom,
    config.customTo,
  );
  return closeKpiService.getDialAttempts({
    from,
    to,
    smartViewId: config.smartViewId ?? undefined,
  });
}

// ─── Lead Heat Index Fetchers (read from pre-computed Supabase tables) ──

async function getUserId(): Promise<string> {
  // Use getSession (cached, no network call) instead of getUser (network call per invocation)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");
  return session.user.id;
}

async function fetchLeadHeatSummary(): Promise<LeadHeatSummaryResult> {
  const userId = await getUserId();
  return closeKpiService.getLeadHeatSummary(userId);
}

async function fetchLeadHeatList(
  config: LeadHeatListConfig,
): Promise<LeadHeatListResult> {
  const userId = await getUserId();
  return closeKpiService.getLeadHeatList({
    userId,
    filterLevel: config.filterLevel ?? "all",
    sortBy: config.sortBy ?? "score_desc",
    page: 1,
    pageSize: config.pageSize ?? 25,
  });
}

async function fetchLeadHeatAiInsights(): Promise<LeadHeatAiInsightsResult> {
  const userId = await getUserId();
  return closeKpiService.getLeadHeatAiInsights(userId);
}
