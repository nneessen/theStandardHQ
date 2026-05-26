// src/services/overrides/__tests__/overrideService.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { overrideService } from "../overrideService";
import { supabase } from "../../base/supabase";
import type {
  OverrideCommissionWithAgents,
  OverrideSummary,
} from "../../../types/hierarchy.types";

// Mock Supabase
vi.mock("../../base/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe("OverrideService", () => {
  const mockUser = { id: "user-1", email: "user@example.com" };
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockGte = vi.fn();
  const mockLte = vi.fn();
  const mockUpdate = vi.fn();
  const mockOrder = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockIn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockReturnThis();
    mockGte.mockReturnThis();
    mockLte.mockReturnThis();
    mockUpdate.mockReturnThis();
    mockOrder.mockReturnThis();
    mockMaybeSingle.mockReturnThis();
    mockIn.mockReturnThis();

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      in: mockIn,
      gte: mockGte,
      lte: mockLte,
      update: mockUpdate,
      order: mockOrder,
    } as any);
  });

  describe("getMyOverrides", () => {
    it("should fetch overrides for current user", async () => {
      // Raw DB rows as returned by the joined select; the service maps the
      // nested relations into *_email / *_name fields.
      const mockRows: any[] = [
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
          base_agent: { email: "downline@example.com" },
          override_agent: { email: "user@example.com" },
          policy: {
            policy_number: "POL-12345",
            status: "active",
            lifecycle_status: "active",
          },
          carrier: { name: "Acme Life" },
          product: { name: "Whole Life" },
        },
      ];

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      mockOrder.mockResolvedValueOnce({ data: mockRows, error: null });

      const result = await overrideService.getMyOverrides();

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].base_agent_email).toBe("downline@example.com");
      expect(result[0].override_agent_email).toBe("user@example.com");
      expect(result[0].policy_number).toBe("POL-12345");
      expect(result[0].carrier_name).toBe("Acme Life");
      expect(result[0].product_name).toBe("Whole Life");
    });

    it("should filter by status", async () => {
      const filters = { status: "paid" as const };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      mockOrder.mockResolvedValueOnce({ data: [], error: null });

      await overrideService.getMyOverrides(filters);

      expect(mockEq).toHaveBeenCalledWith("status", "paid");
    });

    it("should filter by downline_id", async () => {
      const filters = { downline_id: "downline-1" };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      mockOrder.mockResolvedValueOnce({ data: [], error: null });

      await overrideService.getMyOverrides(filters);

      expect(mockEq).toHaveBeenCalledWith("base_agent_id", "downline-1");
    });

    it("should handle empty results", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      mockOrder.mockResolvedValueOnce({ data: [], error: null });

      const result = await overrideService.getMyOverrides();

      expect(result).toEqual([]);
    });

    it("should handle authentication errors", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      } as any);

      await expect(overrideService.getMyOverrides()).rejects.toThrow(
        "Not authenticated",
      );
    });
  });

  describe("getMyOverrideSummary", () => {
    it("should fetch override summary for current user", async () => {
      const mockSummary: OverrideSummary = {
        override_agent_id: "user-1",
        total_overrides: 10,
        total_override_amount: 20000,
        pending_amount: 5000,
        earned_amount: 10000,
        paid_amount: 5000,
        charged_back_amount: 0,
        total_earned: 10000,
        total_unearned: 10000,
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      mockMaybeSingle.mockResolvedValueOnce({ data: mockSummary, error: null });

      const result = await overrideService.getMyOverrideSummary();

      expect(result).toEqual(mockSummary);
      expect(result?.total_override_amount).toBe(20000);
    });

    it("should handle missing summary data", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await overrideService.getMyOverrideSummary();

      // Service returns a zeroed summary (not null) when the view has no row.
      expect(result?.override_agent_id).toBe("user-1");
      expect(result?.total_overrides).toBe(0);
      expect(result?.total_override_amount).toBe(0);
    });
  });

  describe("updateOverrideStatus", () => {
    it("should update override status successfully", async () => {
      const overrideId = "override-1";
      const newStatus = "paid";

      const updatedOverride = {
        id: overrideId,
        status: newStatus,
        payment_date: new Date(),
      };

      mockSingle.mockResolvedValueOnce({ data: updatedOverride, error: null });

      const result = await overrideService.updateOverrideStatus(
        overrideId,
        newStatus,
      );

      expect(result.status).toBe("paid");
      expect(mockUpdate).toHaveBeenCalledWith({ status: newStatus });
    });

    it("should handle update errors", async () => {
      const overrideId = "override-1";
      const newStatus = "paid";
      const error = { message: "Update failed" };

      mockSingle.mockResolvedValueOnce({ data: null, error });

      await expect(
        overrideService.updateOverrideStatus(overrideId, newStatus),
      ).rejects.toThrow();
    });
  });

  describe("getOverridesForPolicy", () => {
    it("should fetch all overrides for a specific policy", async () => {
      const policyId = "policy-1";
      const mockOverrides: OverrideCommissionWithAgents[] = [
        {
          id: "override-1",
          policy_id: policyId,
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

      mockOrder.mockResolvedValueOnce({ data: mockOverrides, error: null });

      const result = await overrideService.getOverridesForPolicy(policyId);

      expect(result).toHaveLength(1);
      expect(result[0].policy_id).toBe(policyId);
      expect(mockEq).toHaveBeenCalledWith("policy_id", policyId);
    });

    it("should return empty array when policy has no overrides", async () => {
      const policyId = "policy-no-overrides";

      mockOrder.mockResolvedValueOnce({ data: [], error: null });

      const result = await overrideService.getOverridesForPolicy(policyId);

      expect(result).toEqual([]);
    });
  });

  describe("getOverridesByDownline", () => {
    // Regression for gap D: earned_override must sum the earned_amount column,
    // not bucket on a non-existent "earned" status (which always summed to $0).
    it("sums earned_override from earned_amount regardless of status", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      // Two overrides for the same downline: one paid, one pending. earned_amount
      // is populated independently of status; the old code summed $0 here.
      mockEq.mockResolvedValueOnce({
        data: [
          {
            base_agent_id: "downline-1",
            hierarchy_depth: 1,
            override_commission_amount: 2000,
            earned_amount: 500,
            status: "paid",
            base_agent: { email: "downline@example.com" },
          },
          {
            base_agent_id: "downline-1",
            hierarchy_depth: 1,
            override_commission_amount: 1000,
            earned_amount: 250,
            status: "pending",
            base_agent: { email: "downline@example.com" },
          },
        ],
        error: null,
      });

      const result = await overrideService.getOverridesByDownline();

      expect(result).toHaveLength(1);
      expect(result[0].downline_id).toBe("downline-1");
      expect(result[0].total_policies).toBe(2);
      expect(result[0].total_override_generated).toBeCloseTo(3000, 2);
      expect(result[0].earned_override).toBeCloseTo(750, 2);
      expect(result[0].paid_override).toBeCloseTo(2000, 2);
      expect(result[0].pending_override).toBeCloseTo(1000, 2);
    });

    it("treats null earned_amount as zero", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      mockEq.mockResolvedValueOnce({
        data: [
          {
            base_agent_id: "downline-2",
            hierarchy_depth: 2,
            override_commission_amount: 1500,
            earned_amount: null,
            status: "pending",
            base_agent: { email: "downline2@example.com" },
          },
        ],
        error: null,
      });

      const result = await overrideService.getOverridesByDownline();

      expect(result[0].earned_override).toBe(0);
      expect(result[0].total_override_generated).toBeCloseTo(1500, 2);
    });
  });
});
