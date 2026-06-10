// src/services/commissions/__tests__/CommissionCalculationService.manualRate.test.ts
//
// Covers the MANUAL commission-entry path: when an agent enters their own comp
// rate, calculateCommissionWithCompGuide must use it verbatim (no comp_guide /
// contract-level lookup) and a blank (0) rate must yield a $0 advance rather
// than throwing. This guards the blocker found in review: calculateAdvance
// rejects a non-positive rate, so a 0% manual rate has to short-circuit.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCarrierGetById, mockGetCommissionRate, mockUserGetById } =
  vi.hoisted(() => ({
    mockCarrierGetById: vi.fn(),
    mockGetCommissionRate: vi.fn(),
    mockUserGetById: vi.fn(),
  }));

// NOTE: the service resolves `await import("../index")` to src/services/index
// (relative to CommissionCalculationService.ts). From this test that path is
// ../../index — it must match or the real services barrel loads instead.
vi.mock("../../index", () => ({
  carrierService: { getById: mockCarrierGetById },
  compGuideService: { getCommissionRate: mockGetCommissionRate },
  userService: { getById: mockUserGetById },
  productService: { getById: vi.fn() },
}));

import { commissionCalculationService } from "../CommissionCalculationService";

beforeEach(() => {
  vi.clearAllMocks();
  // Carrier with no advance cap (Epic Life's imported carriers).
  mockCarrierGetById.mockResolvedValue({
    success: true,
    data: { id: "c1", name: "Test Carrier", advance_cap: null },
  });
});

describe("calculateCommissionWithCompGuide — manual rate", () => {
  it("computes the advance from a manual decimal rate (advance = monthly × months × rate)", async () => {
    const res =
      await commissionCalculationService.calculateCommissionWithCompGuide({
        carrierId: "c1",
        product: "whole_life",
        monthlyPremium: 250,
        advanceMonths: 9,
        manualRate: 0.85, // agent's own comp, as a decimal
      });

    expect(res).not.toBeNull();
    // 250 × 9 × 0.85 = 1912.50
    expect(res!.advanceAmount).toBeCloseTo(1912.5, 2);
    expect(res!.commissionRate).toBe(0.85);
    expect(res!.isAutoCalculated).toBe(false);
  });

  it("returns a $0 advance (no throw) when the manual rate is 0 — blank commission", async () => {
    const res =
      await commissionCalculationService.calculateCommissionWithCompGuide({
        carrierId: "c1",
        product: "whole_life",
        monthlyPremium: 250,
        advanceMonths: 9,
        manualRate: 0, // agent left commission blank
      });

    expect(res).not.toBeNull();
    expect(res!.advanceAmount).toBe(0);
    expect(res!.originalAdvance).toBeNull();
    expect(res!.overageAmount).toBeNull();
  });

  it("never consults comp_guide or contract level on the manual path", async () => {
    await commissionCalculationService.calculateCommissionWithCompGuide({
      carrierId: "c1",
      product: "whole_life",
      monthlyPremium: 250,
      userId: "user-1",
      manualRate: 0.5,
    });

    expect(mockGetCommissionRate).not.toHaveBeenCalled();
    expect(mockUserGetById).not.toHaveBeenCalled();
  });
});
