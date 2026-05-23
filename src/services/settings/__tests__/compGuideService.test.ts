/**
 * Tests for compGuideService new methods
 * Tests the enhanced service methods for product and bulk operations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { compGuideService } from "../comp-guide";
import { supabase } from "../../base/supabase";

// Mock Supabase
vi.mock("../../base/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe("CompGuideService - New Methods", () => {
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockInsert = vi.fn();
  const mockSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock chain
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockOrder.mockReturnThis();
    mockInsert.mockReturnThis();
    mockSingle.mockResolvedValue({
      data: { imo_id: "imo-test", agency_id: "agency-test" },
      error: null,
    });
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user-test" } },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        } as any;
      }

      return {
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        insert: mockInsert,
        single: mockSingle,
      } as any;
    });
  });

  describe("getEntriesByProduct", () => {
    it("should fetch comp rates for a specific product", async () => {
      const productId = "product-123";
      const mockRates = [
        {
          id: "1",
          product_id: productId,
          contract_level: 80,
          commission_percentage: 0.7,
        },
        {
          id: "2",
          product_id: productId,
          contract_level: 85,
          commission_percentage: 0.75,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockRates, error: null });

      const result = await compGuideService.getEntriesByProduct(productId);

      expect(supabase.from).toHaveBeenCalledWith("comp_guide");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("imo_id", "imo-test");
      expect(mockEq).toHaveBeenCalledWith("product_id", productId);
      expect(mockOrder).toHaveBeenCalledWith("contract_level", {
        ascending: true,
      });
      expect(result.data).toEqual(mockRates);
      expect(result.error).toBeNull();
    });

    it("should handle errors when fetching by product", async () => {
      const productId = "product-123";
      const mockError = { message: "Database error" };

      mockOrder.mockResolvedValue({ data: null, error: mockError });

      const result = await compGuideService.getEntriesByProduct(productId);

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain(mockError.message);
    });

    it("should return empty array when product has no rates", async () => {
      const productId = "product-no-rates";

      mockOrder.mockResolvedValue({ data: [], error: null });

      const result = await compGuideService.getEntriesByProduct(productId);

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });
  });

  describe("createBulkEntries", () => {
    it("should create multiple comp guide entries", async () => {
      const newEntries = [
        {
          product_id: "p1",
          carrier_id: "c1",
          contract_level: 80,
          commission_percentage: 0.7,
          effective_date: "2025-01-01",
        },
        {
          product_id: "p1",
          carrier_id: "c1",
          contract_level: 85,
          commission_percentage: 0.75,
          effective_date: "2025-01-01",
        },
      ];

      const createdEntries = newEntries.map((entry, i) => ({
        id: `id-${i}`,
        ...entry,
      }));

      mockSelect.mockResolvedValue({ data: createdEntries, error: null });

      const result = await compGuideService.createBulkEntries(
        newEntries as any,
      );

      expect(supabase.from).toHaveBeenCalledWith("comp_guide");
      expect(mockInsert).toHaveBeenCalledWith(
        newEntries.map((entry) => ({ ...entry, imo_id: "imo-test" })),
      );
      expect(mockSelect).toHaveBeenCalled();
      expect(result.data).toEqual(createdEntries);
      expect(result.error).toBeNull();
    });

    it("should handle all 14 contract levels for a product", async () => {
      const productId = "p1";
      const carrierId = "c1";
      const contractLevels = [
        80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145,
      ];

      const newEntries = contractLevels.map((level) => ({
        product_id: productId,
        carrier_id: carrierId,
        contract_level: level,
        commission_percentage: 0.7 + (level - 80) * 0.005,
        effective_date: "2025-01-01",
      }));

      const createdEntries = newEntries.map((entry, i) => ({
        id: `id-${i}`,
        ...entry,
      }));

      mockSelect.mockResolvedValue({ data: createdEntries, error: null });

      const result = await compGuideService.createBulkEntries(
        newEntries as any,
      );

      expect(result.data).toHaveLength(14);
      expect(result.error).toBeNull();

      // Verify all contract levels are present
      const levels = result.data?.map(
        (entry: { contract_level: number }) => entry.contract_level,
      );
      expect(levels).toEqual(contractLevels);
    });

    it("should handle bulk create errors", async () => {
      const newEntries = [
        {
          product_id: "p1",
          carrier_id: "c1",
          contract_level: 80,
          commission_percentage: 0.7,
          effective_date: "2025-01-01",
        },
      ];

      const mockError = { message: "Constraint violation", code: "23505" };

      mockSelect.mockResolvedValue({ data: null, error: mockError });

      const result = await compGuideService.createBulkEntries(
        newEntries as any,
      );

      expect(result.data).toBeNull();
      expect(result.error?.message).toContain("Duplicate entry");
    });

    it("should create empty array when passed empty array", async () => {
      mockSelect.mockResolvedValue({ data: [], error: null });

      const result = await compGuideService.createBulkEntries([]);

      expect(mockInsert).toHaveBeenCalledWith([]);
      expect(result.data).toEqual([]);
    });
  });

  describe("getEntriesByCarrier (existing method, verify ordering)", () => {
    it("should order by contract_level ascending", async () => {
      const carrierId = "carrier-123";
      const mockRates = [
        {
          id: "1",
          carrier_id: carrierId,
          contract_level: 80,
          commission_percentage: 0.7,
        },
        {
          id: "2",
          carrier_id: carrierId,
          contract_level: 85,
          commission_percentage: 0.75,
        },
        {
          id: "3",
          carrier_id: carrierId,
          contract_level: 90,
          commission_percentage: 0.8,
        },
      ];

      mockOrder.mockResolvedValue({ data: mockRates, error: null });

      const result = await compGuideService.getEntriesByCarrier(carrierId);

      expect(supabase.from).toHaveBeenCalledWith("comp_guide");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEq).toHaveBeenCalledWith("imo_id", "imo-test");
      expect(mockEq).toHaveBeenCalledWith("carrier_id", carrierId);
      expect(mockOrder).toHaveBeenCalledWith("contract_level", {
        ascending: true,
      });

      // Verify ordering
      expect(result.data).toEqual(mockRates);
      expect(result.data?.[0].contract_level).toBe(80);
      expect(result.data?.[1].contract_level).toBe(85);
      expect(result.data?.[2].contract_level).toBe(90);
    });
  });

  describe("Integration scenarios", () => {
    it("should support creating rates for a new product in correct sequence", async () => {
      const productId = "new-product";
      const carrierId = "carrier-1";

      // 1. Create product (assume this happens elsewhere)

      // 2. Create bulk comp guide entries
      const contractLevels = [
        80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145,
      ];
      const baseRate = 0.6;

      const entries = contractLevels.map((level, i) => ({
        product_id: productId,
        carrier_id: carrierId,
        contract_level: level,
        commission_percentage: baseRate + i * 0.05,
        effective_date: "2025-01-01",
      }));

      const createdEntries = entries.map((entry, i) => ({
        id: `rate-${i}`,
        ...entry,
      }));

      // Mock bulk create
      mockSelect.mockResolvedValueOnce({ data: createdEntries, error: null });

      const result = await compGuideService.createBulkEntries(entries as any);

      expect(result.data).toHaveLength(14);
      expect(result.error).toBeNull();

      // 3. Verify we can fetch them back by product
      // Reset mocks for fetch operation
      mockSelect.mockReturnThis();
      mockEq.mockReturnThis();
      mockOrder.mockResolvedValueOnce({ data: createdEntries, error: null });

      const fetchResult = await compGuideService.getEntriesByProduct(productId);

      expect(fetchResult.data).toHaveLength(14);
      expect(fetchResult.data?.[0].contract_level).toBe(80);
      expect(fetchResult.data?.[13].contract_level).toBe(145);
    });
  });
});
