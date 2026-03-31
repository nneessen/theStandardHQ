import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUseImo,
  mockUseCloseConnectionStatus,
  mockUseLeadHeatScoreCount,
  mockUseLeadHeatCompletedRuns,
  mockUseLeadHeatRescore,
} = vi.hoisted(() => ({
  mockUseImo: vi.fn(),
  mockUseCloseConnectionStatus: vi.fn(),
  mockUseLeadHeatScoreCount: vi.fn(),
  mockUseLeadHeatCompletedRuns: vi.fn(),
  mockUseLeadHeatRescore: vi.fn(),
}));

vi.mock("@/contexts/ImoContext", () => ({
  useImo: (...args: unknown[]) => mockUseImo(...args),
}));

vi.mock("@/hooks/subscription", () => ({
  THE_STANDARD_AGENCY_ID: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
}));

vi.mock("../hooks/useCloseKpiDashboard", () => ({
  closeKpiKeys: {
    prebuiltWidgets: () => ["close-kpi", "prebuilt-widget"],
    closeMetadata: () => ["close-kpi", "close-metadata"],
    leadHeat: () => ["close-kpi", "lead-heat"],
  },
  useCloseConnectionStatus: (...args: unknown[]) =>
    mockUseCloseConnectionStatus(...args),
  useLeadHeatScoreCount: (...args: unknown[]) =>
    mockUseLeadHeatScoreCount(...args),
  useLeadHeatCompletedRuns: (...args: unknown[]) =>
    mockUseLeadHeatCompletedRuns(...args),
  useLeadHeatRescore: (...args: unknown[]) => mockUseLeadHeatRescore(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
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
    mockUseImo.mockReturnValue({
      agency: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
      isSuperAdmin: false,
    });
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
