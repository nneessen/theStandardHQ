// src/hooks/hierarchy/__tests__/useHierarchyTree.test.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useHierarchyTree } from "../useHierarchyTree";
import { hierarchyService } from "../../../services/hierarchy/hierarchyService";
import type { HierarchyNode } from "../../../types/hierarchy.types";
import type { ReactNode } from "react";

// Mock the hierarchy service
vi.mock("../../../services/hierarchy/hierarchyService", () => ({
  hierarchyService: {
    getMyHierarchyTree: vi.fn(),
  },
}));

const mockHierarchyTree = [
  {
    id: "user-1",
    email: "user@example.com",
    upline_id: null,
    hierarchy_path: "user-1",
    hierarchy_depth: 0,
    approval_status: "approved",
    is_admin: false,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    children: [
      {
        id: "user-2",
        email: "downline@example.com",
        upline_id: "user-1",
        hierarchy_path: "user-1.user-2",
        hierarchy_depth: 1,
        approval_status: "approved",
        is_admin: false,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
        children: [],
        downline_count: 0,
        direct_downline_count: 0,
      },
    ],
    downline_count: 1,
    direct_downline_count: 1,
  },
] as unknown as HierarchyNode[];

describe("useHierarchyTree", () => {
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

  it("should fetch hierarchy tree successfully", async () => {
    vi.mocked(hierarchyService.getMyHierarchyTree).mockResolvedValue(
      mockHierarchyTree,
    );

    const { result } = renderHook(() => useHierarchyTree(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockHierarchyTree);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].children).toHaveLength(1);
  });

  it("should handle empty hierarchy tree", async () => {
    vi.mocked(hierarchyService.getMyHierarchyTree).mockResolvedValue([]);

    const { result } = renderHook(() => useHierarchyTree(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("should handle errors", async () => {
    // Use fake timers to skip exponential backoff in the hook (retry: 3, retryDelay: exponential)
    vi.useFakeTimers();
    const error = new Error("Failed to fetch hierarchy");
    vi.mocked(hierarchyService.getMyHierarchyTree).mockRejectedValue(error);

    const { result } = renderHook(() => useHierarchyTree(), { wrapper });

    // Advance timers inside act so React processes all state updates synchronously
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  it("should cache results for 5 minutes", async () => {
    vi.mocked(hierarchyService.getMyHierarchyTree).mockResolvedValue(
      mockHierarchyTree,
    );

    const { result, rerender } = renderHook(() => useHierarchyTree(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstCallCount = vi.mocked(hierarchyService.getMyHierarchyTree).mock
      .calls.length;

    // Rerender - should use cache
    rerender();

    expect(
      vi.mocked(hierarchyService.getMyHierarchyTree).mock.calls.length,
    ).toBe(firstCallCount);
  });

  it("should support disabling the query", () => {
    const { result } = renderHook(() => useHierarchyTree({ enabled: false }), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe("idle");
    expect(hierarchyService.getMyHierarchyTree).not.toHaveBeenCalled();
  });

  it("should handle nested hierarchy with multiple levels", async () => {
    const deepHierarchy = [
      {
        id: "root",
        email: "root@example.com",
        upline_id: null,
        hierarchy_path: "root",
        hierarchy_depth: 0,
        approval_status: "approved",
        is_admin: true,
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
        children: [
          {
            id: "level-1",
            email: "level1@example.com",
            upline_id: "root",
            hierarchy_path: "root.level-1",
            hierarchy_depth: 1,
            approval_status: "approved",
            is_admin: false,
            created_at: "2025-01-01T00:00:00.000Z",
            updated_at: "2025-01-01T00:00:00.000Z",
            children: [
              {
                id: "level-2",
                email: "level2@example.com",
                upline_id: "level-1",
                hierarchy_path: "root.level-1.level-2",
                hierarchy_depth: 2,
                approval_status: "approved",
                is_admin: false,
                created_at: "2025-01-01T00:00:00.000Z",
                updated_at: "2025-01-01T00:00:00.000Z",
                children: [],
                downline_count: 0,
                direct_downline_count: 0,
              },
            ],
            downline_count: 1,
            direct_downline_count: 1,
          },
        ],
        downline_count: 2,
        direct_downline_count: 1,
      },
    ] as unknown as HierarchyNode[];

    vi.mocked(hierarchyService.getMyHierarchyTree).mockResolvedValue(
      deepHierarchy,
    );

    const { result } = renderHook(() => useHierarchyTree(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0].downline_count).toBe(2);
    expect(result.current.data?.[0].children[0].downline_count).toBe(1);
  });
});
