import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUsePrebuiltDashboardData,
  mockUseLeadHeatDashboardStatus,
  mockUseLeadHeatRescore,
} = vi.hoisted(() => ({
  mockUsePrebuiltDashboardData: vi.fn(),
  mockUseLeadHeatDashboardStatus: vi.fn(),
  mockUseLeadHeatRescore: vi.fn(),
}));

vi.mock("../../hooks/usePrebuiltWidgetData", () => ({
  usePrebuiltDashboardData: (...args: unknown[]) =>
    mockUsePrebuiltDashboardData(...args),
}));

vi.mock("../../hooks/useCloseKpiDashboard", () => ({
  useLeadHeatDashboardStatus: (...args: unknown[]) =>
    mockUseLeadHeatDashboardStatus(...args),
  useLeadHeatRescore: (...args: unknown[]) => mockUseLeadHeatRescore(...args),
}));

vi.mock("../../config/prebuilt-layout", () => ({
  DASHBOARD_SECTIONS: [
    {
      id: "lead-heat",
      title: "Lead Heat",
      description: "Lead heat widgets",
      icon: null,
      tooltipKey: "lead-heat",
      gridClass: "grid",
      widgets: [
        {
          id: "heat_summary",
          type: "lead_heat_summary",
          title: "Heat Summary",
          tooltipKey: "heat-summary",
          size: "small",
          colSpan: 1,
        },
      ],
    },
  ],
}));

vi.mock("../DashboardSection", () => ({
  DashboardSection: ({ children }: { children: ReactNode }) => (
    <div data-testid="dashboard-section">{children}</div>
  ),
}));

vi.mock("../PrebuiltWidget", () => ({
  PrebuiltWidget: ({ children }: { children: ReactNode }) => (
    <div data-testid="prebuilt-widget">{children}</div>
  ),
}));

vi.mock("../widgets/StatCardWidget", () => ({
  StatCardWidget: () => <div />,
}));
vi.mock("../widgets/StatusDistributionWidget", () => ({
  StatusDistributionWidget: () => <div />,
}));
vi.mock("../widgets/CallAnalyticsWidget", () => ({
  CallAnalyticsWidget: () => <div />,
}));
vi.mock("../widgets/OpportunitySummaryWidget", () => ({
  OpportunitySummaryWidget: () => <div />,
}));
vi.mock("../widgets/VmRateSmartViewWidget", () => ({
  VmRateSmartViewWidget: () => <div />,
}));
vi.mock("../widgets/BestCallTimesWidget", () => ({
  BestCallTimesWidget: () => <div />,
}));
vi.mock("../widgets/CrossReferenceWidget", () => ({
  CrossReferenceWidget: () => <div />,
}));
vi.mock("../widgets/SpeedToLeadWidget", () => ({
  SpeedToLeadWidget: () => <div />,
}));
vi.mock("../widgets/ContactCadenceWidget", () => ({
  ContactCadenceWidget: () => <div />,
}));
vi.mock("../widgets/DialAttemptsWidget", () => ({
  DialAttemptsWidget: () => <div />,
}));
vi.mock("../widgets/LeadHeatSummaryWidget", () => ({
  LeadHeatSummaryWidget: () => <div data-testid="lead-heat-summary-widget" />,
}));
vi.mock("../widgets/LeadHeatListWidget", () => ({
  LeadHeatListWidget: () => <div />,
}));
vi.mock("../widgets/LeadHeatAiInsightsWidget", () => ({
  LeadHeatAiInsightsWidget: () => <div />,
}));

import { PrebuiltDashboard } from "../PrebuiltDashboard";

function buildHeatSummary(totalScored: number) {
  return {
    distribution: [],
    totalScored,
    avgScore: totalScored > 0 ? 72 : 0,
    avgScorePrevious: null,
    trend: "right" as const,
    lastScoredAt: totalScored > 0 ? "2026-03-29T12:00:00.000Z" : null,
    isPersonalized: false,
    sampleSize: 0,
  };
}

function buildWidgetDataMap(totalScored: number) {
  return new Map([
    [
      "heat_summary",
      {
        data: buildHeatSummary(totalScored),
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      },
    ],
  ]);
}

describe("PrebuiltDashboard", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ ok: true });

    mockUsePrebuiltDashboardData.mockReturnValue({
      widgetDataMap: buildWidgetDataMap(12),
      isCloseApiLoading: false,
    });
    mockUseLeadHeatDashboardStatus.mockReturnValue({
      data: {
        state: "fresh",
        hasCachedScores: true,
        lastScoredAt: "2026-03-29T12:00:00.000Z",
        lastRunStatus: "completed",
        lastRunStartedAt: "2026-03-29T11:30:00.000Z",
        lastRunCompletedAt: "2026-03-29T12:00:00.000Z",
        lastRunErrorMessage: null,
        staleAfterMs: 24 * 60 * 60_000,
      },
    });
    mockUseLeadHeatRescore.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
  });

  it("does not auto-trigger rescoring when lead heat has never been scored", async () => {
    mockUsePrebuiltDashboardData.mockReturnValue({
      widgetDataMap: buildWidgetDataMap(0),
      isCloseApiLoading: false,
    });
    mockUseLeadHeatDashboardStatus.mockReturnValue({
      data: {
        state: "never_scored",
        hasCachedScores: false,
        lastScoredAt: null,
        lastRunStatus: null,
        lastRunStartedAt: null,
        lastRunCompletedAt: null,
        lastRunErrorMessage: null,
        staleAfterMs: 24 * 60 * 60_000,
      },
    });

    render(<PrebuiltDashboard dateRange="last_30_days" />);

    await waitFor(() => {
      expect(mockUseLeadHeatDashboardStatus).toHaveBeenCalled();
    });

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("auto-triggers one background rescore when cached lead heat is stale", async () => {
    mockUseLeadHeatDashboardStatus.mockReturnValue({
      data: {
        state: "stale",
        hasCachedScores: true,
        lastScoredAt: "2026-03-26T12:00:00.000Z",
        lastRunStatus: "completed",
        lastRunStartedAt: "2026-03-26T11:30:00.000Z",
        lastRunCompletedAt: "2026-03-26T12:00:00.000Z",
        lastRunErrorMessage: null,
        staleAfterMs: 24 * 60 * 60_000,
      },
    });

    const { rerender } = render(<PrebuiltDashboard dateRange="last_30_days" />);

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    rerender(<PrebuiltDashboard dateRange="last_30_days" />);

    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("does not auto-trigger rescoring while a scoring run is already active", async () => {
    mockUseLeadHeatDashboardStatus.mockReturnValue({
      data: {
        state: "running",
        hasCachedScores: true,
        lastScoredAt: "2026-03-29T12:00:00.000Z",
        lastRunStatus: "running",
        lastRunStartedAt: "2026-03-30T12:00:00.000Z",
        lastRunCompletedAt: null,
        lastRunErrorMessage: null,
        staleAfterMs: 24 * 60 * 60_000,
      },
    });

    render(<PrebuiltDashboard dateRange="last_30_days" />);

    await waitFor(() => {
      expect(mockUseLeadHeatDashboardStatus).toHaveBeenCalled();
    });

    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
