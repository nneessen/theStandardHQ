// src/hooks/hierarchy/__tests__/useMyDownlines.test.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMyDownlines } from "../useMyDownlines";
import { hierarchyService } from "../../../services/hierarchy/hierarchyService";
import type { UserProfile } from "../../../types/hierarchy.types";
import type { ReactNode } from "react";

vi.mock("../../../services/hierarchy/hierarchyService", () => ({
  hierarchyService: {
    getMyDownlines: vi.fn(),
  },
}));

const mockDownlines = [
  {
    id: "downline-1",
    email: "downline1@example.com",
    upline_id: "user-1",
    hierarchy_path: "user-1.downline-1",
    hierarchy_depth: 1,
    approval_status: "approved",
    is_admin: false,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "downline-2",
    email: "downline2@example.com",
    upline_id: "user-1",
    hierarchy_path: "user-1.downline-2",
    hierarchy_depth: 1,
    approval_status: "approved",
    is_admin: false,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
] as unknown as UserProfile[];

describe("useMyDownlines", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          retryDelay: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("should fetch downlines successfully", async () => {
    vi.mocked(hierarchyService.getMyDownlines).mockResolvedValue(mockDownlines);

    const { result } = renderHook(() => useMyDownlines(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDownlines);
    expect(result.current.data).toHaveLength(2);
  });

  it("should handle empty downlines list", async () => {
    vi.mocked(hierarchyService.getMyDownlines).mockResolvedValue([]);

    const { result } = renderHook(() => useMyDownlines(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("should handle errors", async () => {
    // Use fake timers to skip exponential backoff in the hook (retry: 3, retryDelay: exponential)
    vi.useFakeTimers();
    const error = new Error("Failed to fetch downlines");
    vi.mocked(hierarchyService.getMyDownlines).mockRejectedValue(error);

    const { result } = renderHook(() => useMyDownlines(), { wrapper });

    // Advance timers inside act so React processes all state updates synchronously
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  it("should support custom staleTime", async () => {
    vi.mocked(hierarchyService.getMyDownlines).mockResolvedValue(mockDownlines);

    const { result } = renderHook(
      () => useMyDownlines({ staleTime: 10 * 60 * 1000 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDownlines);
  });

  it("should handle downlines at different hierarchy depths", async () => {
    const mixedDepthDownlines: UserProfile[] = [
      {
        ...mockDownlines[0],
        hierarchy_depth: 1,
      },
      {
        ...mockDownlines[1],
        id: "downline-2-1",
        hierarchy_depth: 2,
        upline_id: "downline-1",
        hierarchy_path: "user-1.downline-1.downline-2-1",
      },
    ];

    vi.mocked(hierarchyService.getMyDownlines).mockResolvedValue(
      mixedDepthDownlines,
    );

    const { result } = renderHook(() => useMyDownlines(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].hierarchy_depth).toBe(1);
    expect(result.current.data?.[1].hierarchy_depth).toBe(2);
  });
});
