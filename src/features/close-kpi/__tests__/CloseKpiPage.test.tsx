import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUseCloseConnectionStatus,
  mockUseLeadHeatScoreCount,
  mockUseLeadHeatCompletedRuns,
  mockUseLeadHeatRescore,
} = vi.hoisted(() => ({
  mockUseCloseConnectionStatus: vi.fn(),
  mockUseLeadHeatScoreCount: vi.fn(),
  mockUseLeadHeatCompletedRuns: vi.fn(),
  mockUseLeadHeatRescore: vi.fn(),
}));

vi.mock("../hooks/useCloseKpiDashboard", () => ({
  closeKpiKeys: {
    all: ["close-kpi"],
    prebuiltWidgets: () => ["close-kpi", "prebuilt-widget"],
    closeMetadata: () => ["close-kpi", "close-metadata"],
    leadHeat: () => ["close-kpi", "lead-heat"],
    leadHeatScoreCount: (userId: string) => [
      "close-kpi",
      "lead-heat",
      "score-count",
      userId,
    ],
    leadHeatRunsStatus: (userId: string) => [
      "close-kpi",
      "lead-heat",
      "runs-status",
      userId,
    ],
    leadHeatStatus: (userId: string) => [
      "close-kpi",
      "lead-heat",
      "status",
      userId,
    ],
    leadHeatWidgets: () => ["close-kpi", "lead-heat", "widgets"],
    teamSnapshot: (userId: string, scope: unknown) => [
      "close-kpi",
      "team-snapshot",
      userId,
      scope,
    ],
    teamVisibility: (userId: string) => [
      "close-kpi",
      "team-visibility",
      userId,
    ],
    templates: () => ["close-kpi", "templates"],
    widgetCacheRoot: () => ["close-kpi", "widget-cache"],
    widgetCacheGroup: (group: string) => ["close-kpi", "widget-cache", group],
    connectionStatus: (userId: string) => [
      "close-kpi",
      "connection-status",
      userId,
    ],
    dashboard: (userId: string) => ["close-kpi", "dashboard", userId],
  },
  useCloseConnectionStatus: (...args: unknown[]) =>
    mockUseCloseConnectionStatus(...args),
  useLeadHeatScoreCount: (...args: unknown[]) =>
    mockUseLeadHeatScoreCount(...args),
  useLeadHeatCompletedRuns: (...args: unknown[]) =>
    mockUseLeadHeatCompletedRuns(...args),
  useLeadHeatRescore: (...args: unknown[]) => mockUseLeadHeatRescore(...args),
}));

vi.mock("../hooks/useTeamPipelineSnapshot", () => ({
  useCanViewTeamTab: () => ({
    data: false,
    isLoading: false,
  }),
  useTeamPipelineSnapshot: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-test-123", email: "test@example.com" },
    supabaseUser: { id: "user-test-123", email: "test@example.com" },
  }),
}));

vi.mock("@/features/chat-bot", () => ({
  CloseLogo: () => <div data-testid="close-logo" />,
}));

vi.mock("../components/DashboardHeader", () => ({
  DashboardHeader: () => <div data-testid="dashboard-header" />,
}));

vi.mock("../components/PrebuiltDashboard", () => ({
  PrebuiltDashboard: () => <div data-testid="prebuilt-dashboard" />,
}));

vi.mock("../components/SetupGuide", () => ({
  SetupGuide: () => <div data-testid="setup-guide" />,
}));

vi.mock("../components/CloseSettings", () => ({
  CloseSettings: () => <div data-testid="close-settings" />,
}));

import { CloseKpiPage } from "../CloseKpiPage";

describe("CloseKpiPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();
    mockUseLeadHeatScoreCount.mockReturnValue({ data: 0 });
    mockUseLeadHeatCompletedRuns.mockReturnValue({ data: false });
    mockUseLeadHeatRescore.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("keeps setup-only queries disabled when the resolved destination is the dashboard", async () => {
    mockUseCloseConnectionStatus.mockReturnValue({
      data: { id: "close-config" },
    });

    render(<CloseKpiPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("prebuilt-dashboard")).toBeInTheDocument();
    });

    expect(mockUseLeadHeatScoreCount).toHaveBeenCalled();
    expect(mockUseLeadHeatCompletedRuns).toHaveBeenCalled();
    expect(
      mockUseLeadHeatScoreCount.mock.calls.every(
        ([enabled]) => enabled === false,
      ),
    ).toBe(true);
    expect(
      mockUseLeadHeatCompletedRuns.mock.calls.every(
        ([enabled]) => enabled === false,
      ),
    ).toBe(true);
  });

  it("enables setup-only queries after setup is the resolved destination", async () => {
    mockUseCloseConnectionStatus.mockReturnValue({
      data: null,
    });

    render(<CloseKpiPage />, { wrapper });

    await waitFor(() => {
      expect(mockUseLeadHeatScoreCount).toHaveBeenLastCalledWith(true);
    });

    expect(mockUseLeadHeatCompletedRuns).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId("setup-guide")).toBeInTheDocument();
  });
});
