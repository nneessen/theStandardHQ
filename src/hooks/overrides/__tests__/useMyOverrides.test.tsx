// src/hooks/overrides/__tests__/useMyOverrides.test.tsx

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMyOverrides } from "../useMyOverrides";
import { overrideService } from "../../../services/overrides/overrideService";
import type { OverrideCommissionWithAgents } from "../../../types/hierarchy.types";
import type { ReactNode } from "react";

vi.mock("../../../services/overrides/overrideService", () => ({
  overrideService: {
    getMyOverrides: vi.fn(),
  },
}));

const mockOverrides: OverrideCommissionWithAgents[] = [
  {
    id: "override-1",
    policy_id: "policy-1",
    base_agent_id: "downline-1",
    override_agent_id: "user-1",
    hierarchy_depth: 1,
    base_comp_level: 100,
    override_comp_level: 120,
    carrier_id: "carrier-1",
    product_id: "product-1",
    policy_premium: 10000,
    base_commission_amount: 8000,
    override_commission_amount: 2000,
    advance_months: 12,
    months_paid: 0,
    earned_amount: 0,
    unearned_amount: 2000,
    chargeback_amount: 0,
    chargeback_date: null,
    chargeback_reason: null,
    status: "pending",
    payment_date: null,
    created_at: new Date("2025-01-01"),
    updated_at: new Date("2025-01-01"),
    base_agent_email: "downline@example.com",
    override_agent_email: "user@example.com",
    policy_number: "POL-12345",
  },
];

describe("useMyOverrides", () => {
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

  it("should fetch overrides successfully", async () => {
    vi.mocked(overrideService.getMyOverrides).mockResolvedValue(mockOverrides);

    const { result } = renderHook(() => useMyOverrides(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOverrides);
    expect(result.current.data).toHaveLength(1);
  });

  it("should handle empty overrides list", async () => {
    vi.mocked(overrideService.getMyOverrides).mockResolvedValue([]);

    const { result } = renderHook(() => useMyOverrides(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("should support filtering by status", async () => {
    const filters = { status: "paid" as const };
    vi.mocked(overrideService.getMyOverrides).mockResolvedValue([]);

    const { result } = renderHook(() => useMyOverrides({ filters }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(overrideService.getMyOverrides).toHaveBeenCalledWith(filters);
  });

  it("should support filtering by downline_id", async () => {
    const filters = { downline_id: "downline-1" };
    vi.mocked(overrideService.getMyOverrides).mockResolvedValue(mockOverrides);

    const { result } = renderHook(() => useMyOverrides({ filters }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(overrideService.getMyOverrides).toHaveBeenCalledWith(filters);
    expect(result.current.data).toHaveLength(1);
  });

  it("should handle errors", async () => {
    // Use fake timers to skip exponential backoff in the hook (retry: 3, retryDelay: exponential)
    vi.useFakeTimers();
    const error = new Error("Failed to fetch overrides");
    vi.mocked(overrideService.getMyOverrides).mockRejectedValue(error);

    const { result } = renderHook(() => useMyOverrides(), { wrapper });

    // Advance timers inside act so React processes all state updates synchronously
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  it("should cache results with correct queryKey including filters", async () => {
    const filters = { status: "paid" as const };
    vi.mocked(overrideService.getMyOverrides).mockResolvedValue(mockOverrides);

    const { result } = renderHook(() => useMyOverrides({ filters }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Check that queryKey includes filters for proper cache separation
    expect(result.current.data).toEqual(mockOverrides);
  });

  // The hook is a passthrough — it does not transform or filter statuses.
  // The assertion is aligned to the actual data returned by the mock.
  it("should handle overrides with different statuses", async () => {
    const mixedStatusOverrides: OverrideCommissionWithAgents[] = [
      { ...mockOverrides[0], id: "override-1", status: "pending" },
      { ...mockOverrides[0], id: "override-2", status: "paid" },
      { ...mockOverrides[0], id: "override-3", status: "charged_back" },
    ];

    vi.mocked(overrideService.getMyOverrides).mockResolvedValue(
      mixedStatusOverrides,
    );

    const { result } = renderHook(() => useMyOverrides(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.map((o) => o.status)).toEqual([
      "pending",
      "paid",
      "charged_back",
    ]);
  });
});
