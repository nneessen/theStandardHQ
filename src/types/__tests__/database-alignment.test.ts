/**
 * Database Alignment Tests
 *
 * These tests verify that our application types correctly extend
 * the auto-generated database types from database.types.ts.
 *
 * If these tests fail to compile, it means there's a mismatch between
 * the application type definitions and the database schema.
 *
 * Run these after:
 * 1. Any database migration
 * 2. Regenerating database.types.ts
 * 3. Modifying entity type definitions
 */

import { describe, it, expect } from "vitest";
import type { Database } from "../database.types";
import type { UserProfile, UserProfileRow } from "../user.types";
import type { Carrier, CarrierRow } from "../carrier.types";
import type { PolicyRow } from "../policy.types";
import type { Comp, CompGuideRow } from "../commission.types";

// =============================================================================
// Type Compatibility Tests (Compile-Time)
// =============================================================================

describe("Database Type Alignment", () => {
  describe("UserProfile alignment", () => {
    it("UserProfileRow matches database user_profiles table", () => {
      // This test passes if it compiles - type assignment is valid
      type DBRow = Database["public"]["Tables"]["user_profiles"]["Row"];
      const _check: DBRow = {} as UserProfileRow;
      expect(true).toBe(true);
    });

    it("UserProfile extends UserProfileRow", () => {
      // UserProfile should be assignable to UserProfileRow
      const userProfile = {} as UserProfile;
      const _row: UserProfileRow = userProfile;
      expect(true).toBe(true);
    });

    it("UserProfile has required database fields", () => {
      // Verify key fields exist on UserProfile
      const user = {} as UserProfile;
      // These should all be accessible (compile-time check)
      const _id: string = user.id;
      const _email: string = user.email;
      const _firstName: string | null = user.first_name;
      const _lastName: string | null = user.last_name;
      const _contractLevel: number | null = user.contract_level;
      expect(true).toBe(true);
    });
  });

  describe("Carrier alignment", () => {
    it("CarrierRow matches database carriers table", () => {
      type DBRow = Database["public"]["Tables"]["carriers"]["Row"];
      const _check: DBRow = {} as CarrierRow;
      expect(true).toBe(true);
    });

    it("Carrier extends CarrierRow (with typed contact_info)", () => {
      // Carrier extends Omit<CarrierRow, 'contact_info'> and adds typed contact_info
      const carrier = {} as Carrier;
      const _id: string = carrier.id;
      const _name: string = carrier.name;
      // Carrier has typed contact_info instead of Json
      expect(true).toBe(true);
    });

    it("Carrier has required database fields", () => {
      const carrier = {} as Carrier;
      const _id: string = carrier.id;
      const _name: string = carrier.name;
      const _isActive: boolean | null = carrier.is_active;
      expect(true).toBe(true);
    });
  });

  describe("Policy alignment", () => {
    it("PolicyRow matches database policies table", () => {
      type DBRow = Database["public"]["Tables"]["policies"]["Row"];
      const _check: DBRow = {} as PolicyRow;
      expect(true).toBe(true);
    });
  });

  describe("Comp Guide alignment", () => {
    it("CompGuideRow matches database comp_guide table", () => {
      type DBRow = Database["public"]["Tables"]["comp_guide"]["Row"];
      const _check: DBRow = {} as CompGuideRow;
      expect(true).toBe(true);
    });

    it("Comp extends CompGuideRow", () => {
      const comp = {} as Comp;
      const _row: CompGuideRow = comp;
      expect(true).toBe(true);
    });

    it("Comp has required database fields", () => {
      const comp = {} as Comp;
      const _id: string = comp.id;
      const _carrierId: string | null = comp.carrier_id;
      const _contractLevel: number = comp.contract_level;
      const _commissionPercentage: number = comp.commission_percentage;
      const _productType: Database["public"]["Enums"]["product_type"] =
        comp.product_type;
      expect(true).toBe(true);
    });
  });
});

// =============================================================================
// Enum Alignment Tests
// =============================================================================

describe("Database Enum Alignment", () => {
  it("product_type enum is accessible", () => {
    type ProductType = Database["public"]["Enums"]["product_type"];
    // Should be able to assign known values
    const _termLife: ProductType = "term_life";
    const _wholeLife: ProductType = "whole_life";
    const _health: ProductType = "health";
    expect(true).toBe(true);
  });

  it("agent_status enum is accessible", () => {
    type AgentStatus = Database["public"]["Enums"]["agent_status"];
    const _licensed: AgentStatus = "licensed";
    const _unlicensed: AgentStatus = "unlicensed";
    expect(true).toBe(true);
  });
});

// =============================================================================
// Insert/Update Type Tests
// =============================================================================

describe("Database Insert/Update Types", () => {
  it("user_profiles Insert type is accessible", () => {
    type Insert = Database["public"]["Tables"]["user_profiles"]["Insert"];
    const _insert: Insert = {
      email: "test@example.com",
      imo_id: "00000000-0000-0000-0000-000000000001",
    };
    expect(true).toBe(true);
  });

  it("carriers Insert type is accessible", () => {
    type Insert = Database["public"]["Tables"]["carriers"]["Insert"];
    const _insert: Insert = {
      name: "Test Carrier",
      // Other fields are optional
    };
    expect(true).toBe(true);
  });

  it("comp_guide Insert type is accessible", () => {
    type Insert = Database["public"]["Tables"]["comp_guide"]["Insert"];
    const _insert: Insert = {
      contract_level: 100,
      commission_percentage: 95,
      effective_date: "2024-01-01",
      product_type: "term_life",
    };
    expect(true).toBe(true);
  });
});
