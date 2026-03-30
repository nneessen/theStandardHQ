import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../services/closeKpiService", () => ({
  closeKpiService: {
    triggerRescore: vi.fn(),
    getConnectionStatus: vi.fn(),
    getLeadHeatScoreCount: vi.fn(),
    hasCompletedScoringRuns: vi.fn(),
    getLeadHeatDashboardStatus: vi.fn(),
    getMetadata: vi.fn(),
  },
}));

import { useAuth } from "@/contexts/AuthContext";
import { closeKpiService } from "../../services/closeKpiService";
import { closeKpiKeys, useLeadHeatRescore } from "../useCloseKpiDashboard";

describe("useLeadHeatRescore", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-123" },
    } as ReturnType<typeof useAuth>);
    vi.mocked(closeKpiService.triggerRescore).mockResolvedValue({
      ok: true,
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("invalidates only lead-heat query groups after rescoring", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useLeadHeatRescore(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(closeKpiService.triggerRescore).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: closeKpiKeys.leadHeatStatus("user-123"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: closeKpiKeys.leadHeatWidgets(),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: closeKpiKeys.widgetCacheGroup("lead-heat"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: closeKpiKeys.leadHeat(),
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: closeKpiKeys.prebuiltWidgets(),
    });
  });

  it("optimistically marks lead heat status as running while rescoring is in flight", async () => {
    let resolveRescore: ((value: { ok: boolean }) => void) | undefined;
    const rescorePromise = new Promise<{ ok: boolean }>((resolve) => {
      resolveRescore = resolve;
    });
    vi.mocked(closeKpiService.triggerRescore).mockReturnValue(rescorePromise);

    queryClient.setQueryData(closeKpiKeys.leadHeatStatus("user-123"), {
      state: "stale",
      hasCachedScores: true,
      lastScoredAt: "2026-03-28T12:00:00.000Z",
      lastRunStatus: "completed",
      lastRunStartedAt: "2026-03-28T12:00:00.000Z",
      lastRunCompletedAt: "2026-03-28T12:10:00.000Z",
      lastRunErrorMessage: null,
      staleAfterMs: 24 * 60 * 60_000,
    });

    const { result } = renderHook(() => useLeadHeatRescore(), {
      wrapper,
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData(closeKpiKeys.leadHeatStatus("user-123")),
      ).toMatchObject({
        state: "running",
        hasCachedScores: true,
        lastRunStatus: "running",
      });
    });

    await act(async () => {
      resolveRescore?.({ ok: true });
      await rescorePromise;
    });
  });
});
