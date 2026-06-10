// src/services/commissions/__tests__/CommissionCalculationService.recalcManual.test.ts
//
// Covers the EDIT/recalculate path for MANUAL commission entry (comp_guide
// auto-calc paused — e.g. Epic Life). recalculateCommissionByPolicyId must:
//   1. Fall back to the policy's stored manual rate when comp_guide returns null
//      (carrier/product change → fullRecalculate=true).
//   2. Fall back to the manual rate when comp_guide THROWS (no contract level)
//      instead of letting the throw bubble into useUpdatePolicy's swallowed catch.
//   3. Short-circuit a 0 (blank) manual rate to a $0 advance on a simple premium
//      change (fullRecalculate=false) instead of throwing (rate <= 0).
//   4. Recompute from the stored rate on a simple premium change.

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockCarrierGetById,
  mockGetCommissionRate,
  mockUserGetById,
  mockPolicyGetById,
  mockCommissionGetByPolicyId,
  mockCommissionUpdate,
} = vi.hoisted(() => ({
  mockCarrierGetById: vi.fn(),
  mockGetCommissionRate: vi.fn(),
  mockUserGetById: vi.fn(),
  mockPolicyGetById: vi.fn(),
  mockCommissionGetByPolicyId: vi.fn(),
  mockCommissionUpdate: vi.fn(),
}));

// Services resolved via `await import("../index")` inside the service.
vi.mock("../../index", () => ({
  carrierService: { getById: mockCarrierGetById },
  compGuideService: { getCommissionRate: mockGetCommissionRate },
  userService: { getById: mockUserGetById },
  productService: { getById: vi.fn() },
  policyService: { getById: mockPolicyGetById },
}));

// commissionCRUDService is a top-level import in the service.
vi.mock("../CommissionCRUDService", () => ({
  commissionCRUDService: {
    getByPolicyId: mockCommissionGetByPolicyId,
    update: mockCommissionUpdate,
  },
}));

import { commissionCalculationService } from "../CommissionCalculationService";

const POLICY_ID = "policy-1";

beforeEach(() => {
  vi.clearAllMocks();

  // One active commission on the policy.
  mockCommissionGetByPolicyId.mockResolvedValue([
    { id: "comm-1", status: "approved", amount: 100, advanceMonths: 9 },
  ]);

  // update() echoes the new values back so we can assert on `amount`.
  mockCommissionUpdate.mockImplementation((id: string, data: unknown) =>
    Promise.resolve({
      id,
      status: "approved",
      advanceMonths: 9,
      ...(data as object),
    }),
  );

  // Carrier with no advance cap (Epic Life's imported carriers).
  mockCarrierGetById.mockResolvedValue({
    success: true,
    data: { id: "c1", name: "Test Carrier", advance_cap: null },
  });
});

function policy(overrides: Record<string, unknown> = {}) {
  return {
    id: POLICY_ID,
    carrierId: "c1",
    productId: "p1",
    product: "whole_life",
    commissionPercentage: 0.85, // stored as a decimal
    userId: "u1",
    termLength: null,
    ...overrides,
  };
}

describe("recalculateCommissionByPolicyId — manual commission (no comp guide)", () => {
  it("fullRecalculate: falls back to the stored manual rate when comp_guide returns null", async () => {
    mockPolicyGetById.mockResolvedValue(policy({ commissionPercentage: 0.85 }));
    // User HAS a contract level → auto path reaches comp_guide, which has no entry.
    mockUserGetById.mockResolvedValue({ contract_level: 100 });
    mockGetCommissionRate.mockResolvedValue({ data: null, error: null });

    const result =
      await commissionCalculationService.recalculateCommissionByPolicyId(
        POLICY_ID,
        3000,
        250,
        true, // carrier/product changed
      );

    // 250 × 9 × 0.85 = 1912.50 (from the stored manual rate, not comp_guide)
    expect(result?.amount).toBeCloseTo(1912.5, 2);
    expect(mockCommissionUpdate).toHaveBeenCalledWith(
      "comm-1",
      expect.objectContaining({ amount: expect.closeTo(1912.5, 2) }),
    );
  });

  it("fullRecalculate: falls back to the stored manual rate when comp_guide THROWS (no contract level)", async () => {
    mockPolicyGetById.mockResolvedValue(policy({ commissionPercentage: 0.9 }));
    // No contract level → auto path throws "Contract comp level not found".
    mockUserGetById.mockResolvedValue({ contract_level: null });

    const result =
      await commissionCalculationService.recalculateCommissionByPolicyId(
        POLICY_ID,
        3000,
        200,
        true,
      );

    // 200 × 9 × 0.9 = 1620 — the throw is caught and the manual rate is used.
    expect(result?.amount).toBeCloseTo(1620, 2);
    expect(mockGetCommissionRate).not.toHaveBeenCalled();
  });

  it("simple premium change: a 0 (blank) manual rate yields a $0 advance, no throw", async () => {
    mockPolicyGetById.mockResolvedValue(policy({ commissionPercentage: 0 }));

    const result =
      await commissionCalculationService.recalculateCommissionByPolicyId(
        POLICY_ID,
        4800,
        400,
        false, // premium-only change
      );

    expect(result?.amount).toBe(0);
    // comp_guide is never consulted on the simple-premium path
    expect(mockGetCommissionRate).not.toHaveBeenCalled();
  });

  it("simple premium change: recomputes the advance from the stored manual rate", async () => {
    mockPolicyGetById.mockResolvedValue(policy({ commissionPercentage: 0.5 }));

    const result =
      await commissionCalculationService.recalculateCommissionByPolicyId(
        POLICY_ID,
        3000,
        250,
        false,
      );

    // 250 × 9 × 0.5 = 1125
    expect(result?.amount).toBeCloseTo(1125, 2);
  });
});
