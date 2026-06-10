// src/features/policies/hooks/__tests__/usePolicyCommission.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  usePolicyCommission,
  useUserContractLevel,
} from "../usePolicyCommission";

// The hook fetches per-product rates through compGuideService (IMO-scoped),
// NOT a raw supabase batch query, so mock that service. Default result is an
// empty list; individual tests override `batchQueryResult`.
let batchQueryResult = {
  data: [] as Array<{
    product_id: string;
    commission_percentage: number;
    effective_date: string;
  }>,
  error: null as unknown,
};
vi.mock("../../../../services/settings/comp-guide", () => ({
  compGuideService: {
    getCurrentRatesForProducts: vi.fn(() => Promise.resolve(batchQueryResult)),
  },
}));

// supabase is only used here by useUserContractLevel (user_profiles lookup).
const mockSingle = vi.fn();
const mockEqId = vi.fn(() => ({ single: mockSingle }));
const mockSelectProfile = vi.fn(() => ({ eq: mockEqId }));

vi.mock("../../../../services/base/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        return { select: mockSelectProfile };
      }
      return { select: vi.fn() };
    }),
  },
}));

// Mock useCompGuide hook
const mockUseCompGuide = vi.fn();
vi.mock("../../../../hooks/comps", () => ({
  useCompGuide: (...args: unknown[]) => mockUseCompGuide(...args),
}));

// Mock date utility
vi.mock("../../../../lib/date", () => ({
  formatDateForDB: vi.fn(() => "2024-01-15"),
}));

describe("usePolicyCommission", () => {
  const mockProducts = [
    {
      id: "prod-1",
      product_type: "term_life",
      commission_percentage: 0.75,
      metadata: {
        termCommissionModifiers: {
          10: -0.1, // -10%
          15: 0,
          20: 0.05, // +5%
          25: 0.1, // +10%
          30: 0.15, // +15%
        },
      },
    },
    {
      id: "prod-2",
      product_type: "whole_life",
      commission_percentage: 0.85,
      metadata: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCompGuide.mockReturnValue({ data: null, isLoading: false });
    // Default: batch query returns empty array
    batchQueryResult = { data: [], error: null };
  });

  it("returns initial state correctly", () => {
    const { result } = renderHook(() =>
      usePolicyCommission({
        productId: "",
        userContractLevel: 100,
        products: [],
        isEditMode: false,
        initialProductId: null,
      }),
    );

    expect(result.current.commissionPercentage).toBe(0);
    expect(result.current.termModifiers).toBeNull();
    expect(result.current.productCommissionRates).toEqual({});
  });

  it("sets term modifiers for term_life products", async () => {
    const { result } = renderHook(() =>
      usePolicyCommission({
        productId: "prod-1",
        userContractLevel: 100,
        products: mockProducts,
        isEditMode: false,
        initialProductId: null,
      }),
    );

    await waitFor(() => {
      expect(result.current.termModifiers).not.toBeNull();
    });

    expect(result.current.termModifiers).toEqual({
      10: -0.1,
      15: 0,
      20: 0.05,
      25: 0.1,
      30: 0.15,
    });
  });

  it("clears term modifiers for non-term products", async () => {
    const { result, rerender } = renderHook(
      ({ productId }) =>
        usePolicyCommission({
          productId,
          userContractLevel: 100,
          products: mockProducts,
          isEditMode: false,
          initialProductId: null,
        }),
      { initialProps: { productId: "prod-1" } },
    );

    await waitFor(() => {
      expect(result.current.termModifiers).not.toBeNull();
    });

    // Switch to whole_life product
    rerender({ productId: "prod-2" });

    await waitFor(() => {
      expect(result.current.termModifiers).toBeNull();
    });
  });

  it("uses comp_guide commission rate when available", async () => {
    mockUseCompGuide.mockReturnValue({
      data: { commission_percentage: 0.9 },
      isLoading: false,
    });

    const { result } = renderHook(() =>
      usePolicyCommission({
        productId: "prod-1",
        userContractLevel: 100,
        products: mockProducts,
        isEditMode: false,
        initialProductId: null,
      }),
    );

    await waitFor(() => {
      expect(result.current.commissionPercentage).toBe(90);
    });
  });

  it("stays blank (0) when comp_guide unavailable instead of using the product's stored percentage", async () => {
    // Manual commission entry: with no comp_guide entry we deliberately do NOT
    // fall back to the product's stored percentage (carried over from FFG and
    // not the agent's own comp). The field stays blank for manual entry.
    mockUseCompGuide.mockReturnValue({ data: null, isLoading: false });

    const { result } = renderHook(() =>
      usePolicyCommission({
        productId: "prod-2",
        userContractLevel: 100,
        products: mockProducts,
        isEditMode: false,
        initialProductId: null,
      }),
    );

    // Flush pending async effects (the batch rate fetch) inside act, then
    // assert the per-policy field never left 0.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.commissionPercentage).toBe(0);
  });

  it("applies term modifier to base commission rate", async () => {
    mockUseCompGuide.mockReturnValue({
      data: { commission_percentage: 0.8 }, // 80%
      isLoading: false,
    });

    const { result } = renderHook(() =>
      usePolicyCommission({
        productId: "prod-1",
        userContractLevel: 100,
        products: mockProducts,
        termLength: 20, // +5% modifier
        isEditMode: false,
        initialProductId: null,
      }),
    );

    await waitFor(() => {
      // 80% * 1.05 = 84%
      expect(result.current.commissionPercentage).toBeCloseTo(84, 1);
    });
  });

  it("skips commission update in edit mode when product unchanged", async () => {
    mockUseCompGuide.mockReturnValue({
      data: { commission_percentage: 0.9 },
      isLoading: false,
    });

    const { result } = renderHook(() =>
      usePolicyCommission({
        productId: "prod-1",
        userContractLevel: 100,
        products: mockProducts,
        isEditMode: true,
        initialProductId: "prod-1", // Same as current
      }),
    );

    // Commission should stay at initial value (0) since product didn't change
    await waitFor(() => {
      expect(result.current.commissionPercentage).toBe(0);
    });
  });

  it("updates commission in edit mode when product changes", async () => {
    mockUseCompGuide.mockReturnValue({
      data: { commission_percentage: 0.9 },
      isLoading: false,
    });

    const { result } = renderHook(() =>
      usePolicyCommission({
        productId: "prod-2",
        userContractLevel: 100,
        products: mockProducts,
        isEditMode: true,
        initialProductId: "prod-1", // Different from current
      }),
    );

    await waitFor(() => {
      expect(result.current.commissionPercentage).toBe(90);
    });
  });

  it("fetches product commission rates for dropdown display", async () => {
    // Mock batch query returning rates for multiple products
    batchQueryResult = {
      data: [
        {
          product_id: "prod-1",
          commission_percentage: 0.82,
          effective_date: "2024-01-01",
        },
        {
          product_id: "prod-2",
          commission_percentage: 0.88,
          effective_date: "2024-01-01",
        },
      ],
      error: null,
    };

    const { result } = renderHook(() =>
      usePolicyCommission({
        productId: "",
        userContractLevel: 100,
        products: mockProducts,
        isEditMode: false,
        initialProductId: null,
      }),
    );

    await waitFor(() => {
      expect(Object.keys(result.current.productCommissionRates).length).toBe(2);
    });

    // Verify rates are correctly mapped
    expect(result.current.productCommissionRates["prod-1"]).toBe(0.82);
    expect(result.current.productCommissionRates["prod-2"]).toBe(0.88);
  });
});

describe("useUserContractLevel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback when userId is undefined", () => {
    const { result } = renderHook(() => useUserContractLevel(undefined, 100));

    expect(result.current).toBe(100);
  });

  it("returns custom fallback when specified", () => {
    const { result } = renderHook(() => useUserContractLevel(undefined, 75));

    expect(result.current).toBe(75);
  });

  it("fetches contract level from database", async () => {
    mockSingle.mockResolvedValue({
      data: { contract_level: 85 },
      error: null,
    });

    const { result } = renderHook(() => useUserContractLevel("user-123", 100));

    await waitFor(() => {
      expect(result.current).toBe(85);
    });
  });

  it("returns fallback on database error", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const { result } = renderHook(() => useUserContractLevel("user-123", 100));

    // Should remain at fallback
    expect(result.current).toBe(100);
  });
});
