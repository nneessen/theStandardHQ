import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../useKpiWidgetData", () => ({
  fetchWidgetData: vi.fn(),
}));

vi.mock("../../services/closeKpiService", () => ({
  closeKpiService: {
    getPrebuiltDashboardRollup: vi.fn(),
    triggerRescore: vi.fn(),
    getConnectionStatus: vi.fn(),
    getLeadHeatScoreCount: vi.fn(),
    hasCompletedScoringRuns: vi.fn(),
    getMetadata: vi.fn(),
  },
}));

import { closeKpiService } from "../../services/closeKpiService";
import { generateCacheKey } from "../../lib/cache-key";
import { getDateRangeBounds } from "../../lib/kpi-calculations";
import {
  CLOSE_KPI_PREBUILT_ROLLUP_VERSION,
  closeKpiKeys,
} from "../useCloseKpiDashboard";
import { fetchWidgetData } from "../useKpiWidgetData";
import { usePrebuiltDashboardData } from "../usePrebuiltWidgetData";

const MOCK_LEAD_HEAT_RESULT = {
  distribution: [],
  totalScored: 0,
  avgScore: 0,
  avgScorePrevious: null,
  trend: "right" as const,
  lastScoredAt: null,
  isPersonalized: false,
  sampleSize: 0,
};

const ROLLUP_RESPONSE = {
  version: CLOSE_KPI_PREBUILT_ROLLUP_VERSION,
  cacheHit: false,
  fetchedAt: "2026-03-30T12:00:00.000Z",
  expiresAt: "2026-03-30T12:15:00.000Z",
  widgets: {
    total_leads: {
      value: 12,
      previousValue: 10,
      changePercent: 20,
      label: "Leads",
      unit: "number",
    },
    new_leads: {
      value: 12,
      previousValue: 10,
      changePercent: 20,
      label: "Leads",
      unit: "number",
    },
    speed_to_lead: {
      avgMinutes: 5,
      medianMinutes: 4,
      distribution: [],
      totalLeads: 12,
      leadsWithActivity: 9,
      pctContacted: 75,
    },
    status_dist: {
      items: [],
      total: 12,
    },
    lifecycle: {
      transitions: [],
    },
    call_analytics: {
      total: 20,
      answered: 8,
      voicemail: 5,
      missed: 7,
      inbound: 3,
      outbound: 17,
      connectRate: 40,
      totalDurationMin: 80,
      avgDurationMin: 4,
      byDisposition: [],
      byDirection: [],
      isTruncated: false,
    },
    best_call_times: {
      hourly: [],
      daily: [],
      bestHour: null,
      bestDay: null,
      totalCalls: 17,
      isTruncated: false,
    },
    follow_up_gaps: {
      items: [],
      totalLeads: 0,
      totalNeedingAttention: 0,
      totalUntouched: 0,
      totalGap: 0,
      gapThresholdDays: 7,
    },
    contact_cadence: {
      avgGapHours: 6,
      medianGapHours: 4,
      totalLeads: 12,
      leadsContacted: 9,
      leadsMultiTouch: 5,
      totalTouches: 18,
      avgTouchesPerLead: 1.5,
      touchDistribution: [],
    },
    dial_attempts: {
      avgAttempts: 2,
      medianAttempts: 2,
      totalLeadsDialed: 9,
      leadsConnected: 5,
      neverConnected: 4,
      connectPct: 55.6,
      attemptRates: [],
    },
    opp_funnel: {
      totalValue: 10000,
      dealCount: 4,
      activeCount: 4,
      wonCount: 0,
      wonValue: 0,
      lostCount: 0,
      winRate: 0,
      avgDealSize: 2500,
      salesVelocity: 0,
      avgTimeToClose: 0,
      stalledCount: 0,
      byStatus: [],
    },
    cross_ref: {
      rows: [],
      statusLabels: [],
      totals: {},
      grandTotal: 0,
    },
  },
};

describe("usePrebuiltDashboardData", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.clearAllMocks();
    vi.mocked(fetchWidgetData).mockResolvedValue(MOCK_LEAD_HEAT_RESULT);
    vi.mocked(closeKpiService.getPrebuiltDashboardRollup).mockResolvedValue(
      ROLLUP_RESPONSE,
    );
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("uses one rollup query for Close-backed widgets and keeps lead-heat widgets local", async () => {
    const { result } = renderHook(
      () => usePrebuiltDashboardData("last_30_days"),
      {
        wrapper,
      },
    );

    await waitFor(() => {
      expect(closeKpiService.getPrebuiltDashboardRollup).toHaveBeenCalledTimes(
        1,
      );
    });

    await waitFor(() => {
      expect(result.current.widgetDataMap.get("total_leads")?.data).toEqual(
        ROLLUP_RESPONSE.widgets.total_leads,
      );
    });

    expect(closeKpiService.getPrebuiltDashboardRollup).toHaveBeenCalledWith({
      dateRange: "last_30_days",
      ...getDateRangeBounds("last_30_days"),
    });
    expect(fetchWidgetData).toHaveBeenCalledTimes(3);
    expect(result.current.widgetDataMap.get("heat_summary")?.data).toEqual(
      MOCK_LEAD_HEAT_RESULT,
    );
  });

  it("stores the batched Close payload under the canonical prebuilt rollup key", async () => {
    renderHook(() => usePrebuiltDashboardData("last_30_days"), {
      wrapper,
    });

    const { from, to } = getDateRangeBounds("last_30_days");
    const expectedRollupKey = closeKpiKeys.prebuiltRollup(
      CLOSE_KPI_PREBUILT_ROLLUP_VERSION,
      generateCacheKey("prebuilt_dashboard_rollup", {
        dateRange: "last_30_days",
        from,
        to,
        version: CLOSE_KPI_PREBUILT_ROLLUP_VERSION,
      }),
    );

    await waitFor(() => {
      expect(
        queryClient.getQueryCache().find({ queryKey: expectedRollupKey }),
      ).toBeDefined();
    });

    const legacyWidgetKey = closeKpiKeys.prebuiltWidget(
      "close-api",
      "stat_card",
      "total_leads",
      generateCacheKey("stat_card", {
        dateRange: "last_30_days",
        metric: "lead_count",
        comparison: "previous_period",
      }),
    );

    expect(
      queryClient.getQueryCache().find({ queryKey: legacyWidgetKey }),
    ).toBeUndefined();
  });
});
