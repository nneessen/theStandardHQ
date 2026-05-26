// src/services/commissions/__tests__/commissionRateService.test.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { commissionRateService } from "../commissionRateService";
import { supabase } from "../../base/supabase";
import { parseLocalDate } from "../../../lib/date";
import type { CommissionDataQuality } from "../../../types/product.types";

// Mock Supabase client
vi.mock("../../base/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

// Mock logger
vi.mock("../../../lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe("commissionRateService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserCommissionProfile", () => {
    const userId = "test-user-id";
    const lookbackMonths = 12;

    const mockDbResponse = {
      contract_level: 120,
      simple_avg_rate: 0.98,
      weighted_avg_rate: 0.985,
      product_breakdown: [
        {
          productId: "product-1",
          productName: "Term Life",
          carrierName: "Carrier A",
          commissionRate: 1.0,
          premiumWeight: 0.6,
          totalPremium: 60000,
          policyCount: 10,
          effectiveDate: "2025-01-01",
        },
      ],
      data_quality: "HIGH",
      calculated_at: "2025-11-02T00:00:00Z",
    };

    it("should fetch and transform commission profile successfully", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [mockDbResponse],
        error: null,
      } as any);

      const result = await commissionRateService.getUserCommissionProfile(
        userId,
        lookbackMonths,
      );

      expect(supabase.rpc).toHaveBeenCalledWith("getuser_commission_profile", {
        puser_id: userId,
        p_lookback_months: lookbackMonths,
      });

      expect(result).toEqual({
        userId,
        contractLevel: 120,
        simpleAverageRate: 0.98,
        weightedAverageRate: 0.985,
        recommendedRate: 0.985,
        productBreakdown: [
          {
            productId: "product-1",
            productName: "Term Life",
            carrierName: "Carrier A",
            commissionRate: 1.0,
            premiumWeight: 0.6,
            totalPremium: 60000,
            policyCount: 10,
            effectiveDate: parseLocalDate("2025-01-01"),
          },
        ],
        dataQuality: "HIGH" as CommissionDataQuality,
        calculatedAt: new Date("2025-11-02T00:00:00Z"),
        lookbackMonths: 12,
      });
    });

    it("should use simple average when data quality is insufficient", async () => {
      const insufficientDataResponse = {
        ...mockDbResponse,
        data_quality: "INSUFFICIENT",
        weighted_avg_rate: 0.98,
        simple_avg_rate: 0.95,
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [insufficientDataResponse],
        error: null,
      } as any);

      const result = await commissionRateService.getUserCommissionProfile(
        userId,
        lookbackMonths,
      );

      // Should use simple average as recommended rate
      expect(result.recommendedRate).toBe(0.95);
      expect(result.dataQuality).toBe("INSUFFICIENT");
    });

    it("should throw error when database function is not found", async () => {
      const error = {
        message:
          "Could not find the function public.getuser_commission_profile",
        code: "42883",
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error,
      } as any);

      await expect(
        commissionRateService.getUserCommissionProfile(userId, lookbackMonths),
      ).rejects.toThrow(
        "Failed to calculate commission profile: Could not find the function public.getuser_commission_profile",
      );
    });

    it("should handle empty response data", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      } as any);

      await expect(
        commissionRateService.getUserCommissionProfile(userId, lookbackMonths),
      ).rejects.toThrow("No commission rate data available for user");
    });

    it("should handle empty array response", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [],
        error: null,
      } as any);

      await expect(
        commissionRateService.getUserCommissionProfile(userId, lookbackMonths),
      ).rejects.toThrow("No commission rate data available for user");
    });

    it("should use default lookback months when not provided", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [mockDbResponse],
        error: null,
      } as any);

      await commissionRateService.getUserCommissionProfile(userId);

      expect(supabase.rpc).toHaveBeenCalledWith("getuser_commission_profile", {
        puser_id: userId,
        p_lookback_months: 12,
      });
    });

    it("should handle custom lookback periods", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [mockDbResponse],
        error: null,
      } as any);

      await commissionRateService.getUserCommissionProfile(userId, 6);

      expect(supabase.rpc).toHaveBeenCalledWith("getuser_commission_profile", {
        puser_id: userId,
        p_lookback_months: 6,
      });
    });

    it("should handle LOW data quality", async () => {
      const lowQualityResponse = {
        ...mockDbResponse,
        data_quality: "LOW",
        weighted_avg_rate: 0.98,
        simple_avg_rate: 0.95,
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [lowQualityResponse],
        error: null,
      } as any);

      const result = await commissionRateService.getUserCommissionProfile(
        userId,
        lookbackMonths,
      );

      // Should use weighted average for LOW quality
      // LOW quality uses the simple average (only HIGH/MEDIUM use weighted).
      expect(result.recommendedRate).toBe(0.95);
      expect(result.dataQuality).toBe("LOW");
    });

    it("should handle MEDIUM data quality", async () => {
      const mediumQualityResponse = {
        ...mockDbResponse,
        data_quality: "MEDIUM",
        weighted_avg_rate: 0.985,
        simple_avg_rate: 0.95,
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [mediumQualityResponse],
        error: null,
      } as any);

      const result = await commissionRateService.getUserCommissionProfile(
        userId,
        lookbackMonths,
      );

      // Should use weighted average for MEDIUM quality
      expect(result.recommendedRate).toBe(0.985);
      expect(result.dataQuality).toBe("MEDIUM");
    });

    it("should handle HIGH data quality", async () => {
      const highQualityResponse = {
        ...mockDbResponse,
        data_quality: "HIGH",
        weighted_avg_rate: 0.985,
        simple_avg_rate: 0.95,
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [highQualityResponse],
        error: null,
      } as any);

      const result = await commissionRateService.getUserCommissionProfile(
        userId,
        lookbackMonths,
      );

      // Should use weighted average for HIGH quality
      expect(result.recommendedRate).toBe(0.985);
      expect(result.dataQuality).toBe("HIGH");
    });

    it("should handle empty product breakdown", async () => {
      const emptyBreakdownResponse = {
        ...mockDbResponse,
        product_breakdown: [],
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [emptyBreakdownResponse],
        error: null,
      } as any);

      const result = await commissionRateService.getUserCommissionProfile(
        userId,
        lookbackMonths,
      );

      expect(result.productBreakdown).toEqual([]);
    });

    it("should handle null product breakdown", async () => {
      const nullBreakdownResponse = {
        ...mockDbResponse,
        product_breakdown: null,
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [nullBreakdownResponse],
        error: null,
      } as any);

      const result = await commissionRateService.getUserCommissionProfile(
        userId,
        lookbackMonths,
      );

      expect(result.productBreakdown).toEqual([]);
    });

    it("should transform product breakdown dates correctly", async () => {
      const multiProductResponse = {
        ...mockDbResponse,
        product_breakdown: [
          {
            productId: "product-1",
            productName: "Term Life",
            carrierName: "Carrier A",
            commissionRate: 1.0,
            premiumWeight: 0.5,
            totalPremium: 50000,
            policyCount: 10,
            effectiveDate: "2025-01-15",
          },
          {
            productId: "product-2",
            productName: "Whole Life",
            carrierName: "Carrier B",
            commissionRate: 0.95,
            premiumWeight: 0.5,
            totalPremium: 50000,
            policyCount: 10,
            effectiveDate: "2025-02-20",
          },
        ],
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [multiProductResponse],
        error: null,
      } as any);

      const result = await commissionRateService.getUserCommissionProfile(
        userId,
        lookbackMonths,
      );

      expect(result.productBreakdown).toHaveLength(2);
      // Service parses date-only strings via parseLocalDate (local midnight),
      // the project-wide convention — not UTC midnight.
      expect(result.productBreakdown[0].effectiveDate).toEqual(
        parseLocalDate("2025-01-15"),
      );
      expect(result.productBreakdown[1].effectiveDate).toEqual(
        parseLocalDate("2025-02-20"),
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network request failed");

      vi.mocked(supabase.rpc).mockRejectedValue(networkError);

      await expect(
        commissionRateService.getUserCommissionProfile(userId, lookbackMonths),
      ).rejects.toThrow("Network request failed");
    });

    it("should handle rate values at boundaries", async () => {
      const boundaryRatesResponse = {
        ...mockDbResponse,
        simple_avg_rate: 0,
        weighted_avg_rate: 2.0,
        data_quality: "HIGH",
      };

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [boundaryRatesResponse],
        error: null,
      } as any);

      const result = await commissionRateService.getUserCommissionProfile(
        userId,
        lookbackMonths,
      );

      expect(result.simpleAverageRate).toBe(0);
      expect(result.weightedAverageRate).toBe(2.0);
      expect(result.recommendedRate).toBe(2.0);
    });
  });
});
