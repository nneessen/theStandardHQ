// src/services/hierarchy/__tests__/hierarchyService.test.ts
// Unit tests for HierarchyService and HierarchyRepository

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Supabase - using hoisted mock
vi.mock("../../base/supabase", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockAuth = {
    getUser: vi.fn(),
  };

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
      auth: mockAuth,
    },
    TABLES: {
      USER_PROFILES: "user_profiles",
      POLICIES: "policies",
      COMMISSIONS: "commissions",
      OVERRIDE_COMMISSIONS: "override_commissions",
      CLIENTS: "clients",
      CARRIERS: "carriers",
      PRODUCTS: "products",
    },
  };
});

vi.mock("../../base/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks are set up
import { HierarchyRepository } from "../HierarchyRepository";
import { HierarchyService } from "../hierarchyService";
import { supabase } from "../../base/supabase";

// ---------------------------------------------------------------------------
// Helper functions for mock setup
// ---------------------------------------------------------------------------

function createMockChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.not = vi.fn().mockReturnValue(chain);
  chain.like = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn();

  return chain;
}

// ---------------------------------------------------------------------------
// HierarchyRepository Tests
// ---------------------------------------------------------------------------

describe("HierarchyRepository", () => {
  let repository: HierarchyRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new HierarchyRepository();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("findById", () => {
    it("should find user profile by ID", async () => {
      const mockProfile = {
        id: "user-123",
        email: "test@example.com",
        hierarchy_path: "user-123",
        hierarchy_depth: 0,
        upline_id: null,
      };

      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: mockProfile, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await repository.findById("user-123");

      expect(result).toEqual(mockProfile);
      expect(supabase.from).toHaveBeenCalledWith("user_profiles");
    });

    it("should return null when profile not found", async () => {
      const chain = createMockChain();
      chain.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await repository.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findDownlinesByHierarchyPath", () => {
    it("should find all downlines by hierarchy path prefix", async () => {
      const mockDownlines = [
        { id: "d1", hierarchy_path: "root.d1", hierarchy_depth: 1 },
        { id: "d2", hierarchy_path: "root.d1.d2", hierarchy_depth: 2 },
      ];

      const chain = createMockChain();
      chain.order.mockResolvedValue({ data: mockDownlines, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await repository.findDownlinesByHierarchyPath("root");

      expect(result).toHaveLength(2);
      expect(chain.like).toHaveBeenCalledWith("hierarchy_path", "root.%");
    });

    it("should return empty array when no downlines found", async () => {
      const chain = createMockChain();
      chain.order.mockResolvedValue({ data: [], error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await repository.findDownlinesByHierarchyPath("root");

      expect(result).toEqual([]);
    });
  });

  describe("findByIds", () => {
    it("should find profiles by list of IDs", async () => {
      const mockProfiles = [
        { id: "user-1", email: "user1@test.com" },
        { id: "user-2", email: "user2@test.com" },
      ];

      const chain = createMockChain();
      chain.order.mockResolvedValue({ data: mockProfiles, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await repository.findByIds(["user-1", "user-2"]);

      expect(result).toHaveLength(2);
      expect(chain.in).toHaveBeenCalledWith("id", ["user-1", "user-2"]);
    });

    it("should return empty array for empty ID list", async () => {
      const result = await repository.findByIds([]);

      expect(result).toEqual([]);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe("updateUpline", () => {
    it("should update agent upline", async () => {
      const updatedProfile = {
        id: "agent-1",
        upline_id: "new-upline",
        hierarchy_path: "new-upline.agent-1",
      };

      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: updatedProfile, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await repository.updateUpline("agent-1", "new-upline");

      expect(result.upline_id).toBe("new-upline");
      expect(chain.update).toHaveBeenCalledWith({ upline_id: "new-upline" });
    });
  });

  describe("findDirectReportsByUplineId", () => {
    it("should find direct reports", async () => {
      const mockReports = [
        {
          id: "r1",
          email: "r1@test.com",
          first_name: "John",
          last_name: "Doe",
        },
      ];

      const chain = createMockChain();
      chain.order.mockResolvedValue({ data: mockReports, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await repository.findDirectReportsByUplineId("upline-1");

      expect(result).toHaveLength(1);
      expect(chain.eq).toHaveBeenCalledWith("upline_id", "upline-1");
    });
  });

  // NOTE: Policy, Commission, and Override queries have been moved to their respective repositories:
  // - PolicyRepository (src/services/policies/PolicyRepository.ts)
  // - CommissionRepository (src/services/commissions/CommissionRepository.ts)
  // - OverrideRepository (src/services/overrides/OverrideRepository.ts)
});

// ---------------------------------------------------------------------------
// HierarchyService Tests
// ---------------------------------------------------------------------------

describe("HierarchyService", () => {
  let service: HierarchyService;

  const mockUser = { id: "user-1", email: "user@example.com" };
  const mockProfile = {
    id: "user-1",
    email: "user@example.com",
    upline_id: null,
    hierarchy_path: "user-1",
    hierarchy_depth: 0,
    approval_status: "approved",
    is_admin: false,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HierarchyService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getMyHierarchyTree", () => {
    it("should fetch hierarchy tree for current user", async () => {
      const mockDownlines = [
        {
          id: "downline-1",
          email: "downline@example.com",
          upline_id: "user-1",
          hierarchy_path: "user-1.downline-1",
          hierarchy_depth: 1,
        },
      ];

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as never);

      // Mock profile fetch (findById)
      const profileChain = createMockChain();
      profileChain.single.mockResolvedValue({ data: mockProfile, error: null });

      // Mock downlines fetch
      const downlineChain = createMockChain();
      downlineChain.order.mockResolvedValue({
        data: mockDownlines,
        error: null,
      });

      // Mock overrides fetch
      const overrideChain = createMockChain();
      overrideChain.in.mockResolvedValue({ data: [], error: null });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain as never;
        if (callCount === 2) return downlineChain as never;
        return overrideChain as never;
      });

      const result = await service.getMyHierarchyTree();

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("user-1");
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].id).toBe("downline-1");
    });

    it("should handle user with no downlines", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as never);

      const profileChain = createMockChain();
      profileChain.single.mockResolvedValue({ data: mockProfile, error: null });

      const downlineChain = createMockChain();
      downlineChain.order.mockResolvedValue({ data: [], error: null });

      const overrideChain = createMockChain();
      overrideChain.in.mockResolvedValue({ data: [], error: null });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain as never;
        if (callCount === 2) return downlineChain as never;
        return overrideChain as never;
      });

      const result = await service.getMyHierarchyTree();

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(0);
    });

    it("should throw error when not authenticated", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      } as never);

      await expect(service.getMyHierarchyTree()).rejects.toThrow(
        "Not authenticated",
      );
    });
  });

  describe("getMyDownlines", () => {
    it("should fetch all downlines for current user", async () => {
      const mockDownlines = [
        { id: "d1", email: "d1@test.com", hierarchy_depth: 1 },
        { id: "d2", email: "d2@test.com", hierarchy_depth: 1 },
      ];

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as never);

      const profileChain = createMockChain();
      profileChain.single.mockResolvedValue({ data: mockProfile, error: null });

      const downlineChain = createMockChain();
      downlineChain.order.mockResolvedValue({
        data: mockDownlines,
        error: null,
      });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain as never;
        return downlineChain as never;
      });

      const result = await service.getMyDownlines();

      expect(result).toHaveLength(2);
    });
  });

  describe("getMyUplineChain", () => {
    it("should return empty array for root agent", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as never);

      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: mockProfile, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await service.getMyUplineChain();

      expect(result).toEqual([]);
    });

    it("should fetch upline chain for non-root agent", async () => {
      const nonRootProfile = {
        ...mockProfile,
        id: "downline-1",
        hierarchy_path: "root.user-1.downline-1",
        hierarchy_depth: 2,
      };

      const uplines = [
        { id: "root", hierarchy_depth: 0 },
        { id: "user-1", hierarchy_depth: 1 },
      ];

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "downline-1" } },
        error: null,
      } as never);

      const profileChain = createMockChain();
      profileChain.single.mockResolvedValue({
        data: nonRootProfile,
        error: null,
      });

      const uplineChain = createMockChain();
      uplineChain.order.mockResolvedValue({ data: uplines, error: null });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain as never;
        return uplineChain as never;
      });

      const result = await service.getMyUplineChain();

      expect(result).toHaveLength(2);
    });
  });

  describe("validateHierarchyChange", () => {
    // validateHierarchyChange now uses supabase.rpc("validate_hierarchy_change")
    it("should allow setting upline to null", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { valid: true, errors: [], warnings: [] },
        error: null,
      } as never);

      const result = await service.validateHierarchyChange({
        agent_id: "agent-1",
        new_upline_id: null,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject circular reference", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: {
          valid: false,
          errors: [
            "Cannot set upline to one of your downlines (would create circular reference)",
          ],
          warnings: [],
        },
        error: null,
      } as never);

      const result = await service.validateHierarchyChange({
        agent_id: "agent-1",
        new_upline_id: "downline-1",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Cannot set upline to one of your downlines (would create circular reference)",
      );
    });

    it("should return error when agent not found", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: {
          valid: false,
          errors: ["Agent not found"],
          warnings: [],
        },
        error: null,
      } as never);

      const result = await service.validateHierarchyChange({
        agent_id: "nonexistent",
        new_upline_id: "upline-1",
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Agent not found");
    });
  });

  describe("updateAgentHierarchy", () => {
    it("should update agent hierarchy successfully", async () => {
      const request = {
        agent_id: "downline-1",
        new_upline_id: "user-2",
        reason: "Organisational restructure",
      };

      const updatedProfile = {
        id: "downline-1",
        upline_id: "user-2",
        hierarchy_path: "user-2.downline-1",
        hierarchy_depth: 1,
      };

      // validateHierarchyChange uses rpc
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { valid: true, errors: [], warnings: [] },
        error: null,
      } as never);

      // updateUpline uses from chain
      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: updatedProfile, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await service.updateAgentHierarchy(request);

      expect(result.upline_id).toBe("user-2");
    });

    it("should allow promoting agent to root", async () => {
      const request = {
        agent_id: "downline-1",
        new_upline_id: null,
        reason: "Promote to root",
      };

      const updatedProfile = {
        id: "downline-1",
        upline_id: null,
        hierarchy_path: "downline-1",
        hierarchy_depth: 0,
      };

      // validateHierarchyChange uses rpc
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { valid: true, errors: [], warnings: [] },
        error: null,
      } as never);

      // updateUpline uses from chain
      const chain = createMockChain();
      chain.single.mockResolvedValue({ data: updatedProfile, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await service.updateAgentHierarchy(request);

      expect(result.upline_id).toBeNull();
    });
  });

  describe("getAllDownlinePerformance", () => {
    it("should return empty array when no downlines", async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as never);

      const profileChain = createMockChain();
      profileChain.single.mockResolvedValue({ data: mockProfile, error: null });

      const downlineChain = createMockChain();
      downlineChain.order.mockResolvedValue({ data: [], error: null });

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain as never;
        return downlineChain as never;
      });

      const result = await service.getAllDownlinePerformance();

      expect(result).toEqual([]);
    });
  });

  describe("getAgentDetails", () => {
    it("should throw error for missing agentId", async () => {
      await expect(service.getAgentDetails("")).rejects.toThrow(
        "AgentId is required",
      );
    });

    it("should throw NotFoundError when agent not found", async () => {
      const chain = createMockChain();
      chain.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      await expect(service.getAgentDetails("nonexistent")).rejects.toThrow();
    });
  });

  describe("getAgentTeam", () => {
    it("should return empty team when agent has no direct reports", async () => {
      const chain = createMockChain();
      chain.order.mockResolvedValue({ data: [], error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const result = await service.getAgentTeam("agent-1");

      expect(result.directReports).toEqual([]);
      expect(result.totalMembers).toBe(0);
      expect(result.totalPremium).toBe(0);
      expect(result.totalPolicies).toBe(0);
    });
  });
});
