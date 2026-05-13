// src/__tests__/services/hierarchy/batchQueries.test.ts
// Unit tests for batch query methods used in the N+1 fix

import { describe, it, expect, vi, beforeEach, Mock } from "vitest";

// Mock Supabase before imports
vi.mock("../../../services/base/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
  TABLES: {
    COMMISSIONS: "commissions",
    OVERRIDE_COMMISSIONS: "override_commissions",
    POLICIES: "policies",
    USER_PROFILES: "user_profiles",
  },
}));

import { supabase } from "../../../services/base/supabase";

// Create a mock query builder that chains methods
function createMockQueryBuilder(
  data: unknown[] = [],
  error: Error | null = null,
) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve({ data, error })),
  };
  // Make the builder thenable for async/await
  Object.defineProperty(builder, "then", {
    value: (
      resolve: (value: { data: unknown[]; error: Error | null }) => void,
    ) => Promise.resolve({ data, error }).then(resolve),
  });
  return builder;
}

// Used by OverrideRepository.findByOverrideAndBaseAgentInRange tests: one
// commissions query, one overrides query, single builder each.
function mockPaidOverrideFlow(
  commissionsData: unknown[] = [],
  overridesData: unknown[] = [],
) {
  const commissionsBuilder = createMockQueryBuilder(commissionsData);
  const overridesBuilder = createMockQueryBuilder(overridesData);

  (supabase.from as Mock).mockImplementation((tableName: string) => {
    if (tableName === "commissions") return commissionsBuilder;
    if (tableName === "override_commissions") return overridesBuilder;
    return createMockQueryBuilder([]);
  });

  return { commissionsBuilder, overridesBuilder };
}

// Used by HierarchyService.getViewerOverridesFromAgent tests: the service
// fires findByOverrideAndBaseAgentInRange (earned/paid path, awaits commissions
// internally) AND findPendingByOverrideAndBaseAgent in parallel. Because the
// earned path's await on commissions defers its from('override_commissions')
// call by a microtask, the pending path's call lands first. Queue order:
// pendingOverridesBuilder, then overridesBuilder.
function mockServiceOverrideFlow(
  commissionsData: unknown[] = [],
  overridesData: unknown[] = [],
  pendingOverridesData: unknown[] = [],
) {
  const commissionsBuilder = createMockQueryBuilder(commissionsData);
  const overridesBuilder = createMockQueryBuilder(overridesData);
  const pendingOverridesBuilder = createMockQueryBuilder(pendingOverridesData);
  const overrideBuilderQueue = [pendingOverridesBuilder, overridesBuilder];

  (supabase.from as Mock).mockImplementation((tableName: string) => {
    if (tableName === "commissions") return commissionsBuilder;
    if (tableName === "override_commissions") {
      return overrideBuilderQueue.shift() || createMockQueryBuilder([]);
    }
    return createMockQueryBuilder([]);
  });

  return { commissionsBuilder, overridesBuilder, pendingOverridesBuilder };
}

describe("OverrideRepository.findByOverrideAndBaseAgentInRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array for empty baseAgentIds", async () => {
    const { OverrideRepository } =
      await import("../../../services/overrides/OverrideRepository");
    const repo = new OverrideRepository();

    const result = await repo.findByOverrideAndBaseAgentInRange(
      "viewer-123",
      [],
      "2024-01-01",
    );

    expect(result).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("should handle single baseAgentId (backward compatible)", async () => {
    const mockData = [
      {
        base_agent_id: "agent-1",
        policy_id: "policy-1",
        override_commission_amount: 100,
        status: "earned",
      },
    ];
    const { commissionsBuilder, overridesBuilder } = mockPaidOverrideFlow(
      [
        {
          policy_id: "policy-1",
          user_id: "agent-1",
          payment_date: "2024-01-05",
        },
      ],
      mockData,
    );

    const { OverrideRepository } =
      await import("../../../services/overrides/OverrideRepository");
    const repo = new OverrideRepository();

    const result = await repo.findByOverrideAndBaseAgentInRange(
      "viewer-123",
      "agent-1", // Single string, not array
      "2024-01-01",
    );

    expect(result).toEqual(mockData);
    expect(commissionsBuilder.eq).toHaveBeenCalledWith("status", "paid");
    expect(commissionsBuilder.eq).toHaveBeenCalledWith("type", "advance");
    expect(commissionsBuilder.eq).toHaveBeenCalledWith(
      "policy.lifecycle_status",
      "active",
    );
    expect(overridesBuilder.eq).toHaveBeenCalledWith(
      "override_agent_id",
      "viewer-123",
    );
    expect(overridesBuilder.in).toHaveBeenCalledWith("base_agent_id", [
      "agent-1",
    ]);
  });

  it("should handle array of baseAgentIds (batch mode)", async () => {
    const mockData = [
      {
        base_agent_id: "agent-1",
        policy_id: "policy-1",
        override_commission_amount: 100,
        status: "earned",
      },
      {
        base_agent_id: "agent-2",
        policy_id: "policy-2",
        override_commission_amount: 200,
        status: "earned",
      },
      {
        base_agent_id: "agent-1",
        policy_id: "policy-3",
        override_commission_amount: 50,
        status: "earned",
      },
    ];
    const { commissionsBuilder, overridesBuilder } = mockPaidOverrideFlow(
      [
        {
          policy_id: "policy-1",
          user_id: "agent-1",
          payment_date: "2024-01-05",
        },
        {
          policy_id: "policy-2",
          user_id: "agent-2",
          payment_date: "2024-01-06",
        },
        {
          policy_id: "policy-3",
          user_id: "agent-1",
          payment_date: "2024-01-07",
        },
      ],
      mockData,
    );

    const { OverrideRepository } =
      await import("../../../services/overrides/OverrideRepository");
    const repo = new OverrideRepository();

    const result = await repo.findByOverrideAndBaseAgentInRange(
      "viewer-123",
      ["agent-1", "agent-2", "agent-3"],
      "2024-01-01",
    );

    expect(result).toEqual(mockData);
    expect(commissionsBuilder.in).toHaveBeenCalledWith("user_id", [
      "agent-1",
      "agent-2",
      "agent-3",
    ]);
    expect(overridesBuilder.in).toHaveBeenCalledWith("base_agent_id", [
      "agent-1",
      "agent-2",
      "agent-3",
    ]);
  });

  it("should filter by paid commission date range", async () => {
    const { overridesBuilder } = mockPaidOverrideFlow(
      [
        {
          policy_id: "policy-1",
          user_id: "agent-1",
          payment_date: "2024-01-05",
        },
        {
          policy_id: "policy-2",
          user_id: "agent-1",
          payment_date: "2024-02-05",
        },
      ],
      [
        {
          base_agent_id: "agent-1",
          policy_id: "policy-1",
          override_commission_amount: 100,
          status: "earned",
        },
        {
          base_agent_id: "agent-1",
          policy_id: "policy-2",
          override_commission_amount: 200,
          status: "earned",
        },
      ],
    );

    const { OverrideRepository } =
      await import("../../../services/overrides/OverrideRepository");
    const repo = new OverrideRepository();

    const result = await repo.findByOverrideAndBaseAgentInRange(
      "viewer-123",
      ["agent-1"],
      "2024-01-01",
      "2024-01-31",
    );

    expect(result).toEqual([
      {
        base_agent_id: "agent-1",
        policy_id: "policy-1",
        override_commission_amount: 100,
        status: "earned",
      },
    ]);
    expect(overridesBuilder.eq).toHaveBeenCalledWith(
      "override_agent_id",
      "viewer-123",
    );
  });

  it("should return empty array when no paid active commissions exist", async () => {
    const { overridesBuilder } = mockPaidOverrideFlow([], []);

    const { OverrideRepository } =
      await import("../../../services/overrides/OverrideRepository");
    const repo = new OverrideRepository();

    const result = await repo.findByOverrideAndBaseAgentInRange(
      "viewer-123",
      ["agent-1"],
      "2024-01-01",
    );

    expect(result).toEqual([]);
    expect(overridesBuilder.eq).not.toHaveBeenCalledWith(
      "override_agent_id",
      "viewer-123",
    );
  });
});

describe("HierarchyService.getViewerOverridesFromAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return { mtd: 0, pending: 0 } for single ID with empty results", async () => {
    mockServiceOverrideFlow([], [], []);

    const { HierarchyService } =
      await import("../../../services/hierarchy/hierarchyService");
    const service = new HierarchyService();

    const result = await service.getViewerOverridesFromAgent(
      "viewer-123",
      "agent-1",
    );

    expect(result).toEqual({ mtd: 0, pending: 0 });
  });

  it("should return Map for array input", async () => {
    const mockData = [
      {
        base_agent_id: "agent-1",
        policy_id: "policy-1",
        override_commission_amount: 100,
        status: "earned",
      },
      {
        base_agent_id: "agent-2",
        policy_id: "policy-2",
        override_commission_amount: 200,
        status: "earned",
      },
      {
        base_agent_id: "agent-1",
        policy_id: "policy-3",
        override_commission_amount: 50,
        status: "earned",
      },
    ];
    mockServiceOverrideFlow(
      [
        {
          policy_id: "policy-1",
          user_id: "agent-1",
          payment_date: "2024-01-05",
        },
        {
          policy_id: "policy-2",
          user_id: "agent-2",
          payment_date: "2024-01-06",
        },
        {
          policy_id: "policy-3",
          user_id: "agent-1",
          payment_date: "2024-01-07",
        },
      ],
      mockData,
    );

    const { HierarchyService } =
      await import("../../../services/hierarchy/hierarchyService");
    const service = new HierarchyService();

    const result = await service.getViewerOverridesFromAgent(
      "viewer-123",
      ["agent-1", "agent-2"],
      {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      },
    );

    expect(result).toBeInstanceOf(Map);
    const map = result as Map<string, { earned: number; pending: number }>;
    expect(map.get("agent-1")).toEqual({ earned: 150, pending: 0 }); // 100 + 50
    expect(map.get("agent-2")).toEqual({ earned: 200, pending: 0 });
  });

  it("should return empty Map for empty array input", async () => {
    const { HierarchyService } =
      await import("../../../services/hierarchy/hierarchyService");
    const service = new HierarchyService();

    const result = await service.getViewerOverridesFromAgent("viewer-123", []);

    expect(result).toBeInstanceOf(Map);
    expect(
      (result as Map<string, { earned: number; pending: number }>).size,
    ).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("should aggregate multiple overrides per agent correctly", async () => {
    const mockData = [
      {
        base_agent_id: "agent-1",
        policy_id: "policy-1",
        override_commission_amount: "100.50",
        status: "earned",
      },
      {
        base_agent_id: "agent-1",
        policy_id: "policy-2",
        override_commission_amount: "200.25",
        status: "earned",
      },
      {
        base_agent_id: "agent-1",
        policy_id: "policy-3",
        override_commission_amount: "50.00",
        status: "earned",
      },
    ];
    mockServiceOverrideFlow(
      [
        {
          policy_id: "policy-1",
          user_id: "agent-1",
          payment_date: "2024-01-05",
        },
        {
          policy_id: "policy-2",
          user_id: "agent-1",
          payment_date: "2024-01-06",
        },
        {
          policy_id: "policy-3",
          user_id: "agent-1",
          payment_date: "2024-01-07",
        },
      ],
      mockData,
    );

    const { HierarchyService } =
      await import("../../../services/hierarchy/hierarchyService");
    const service = new HierarchyService();

    const result = await service.getViewerOverridesFromAgent(
      "viewer-123",
      ["agent-1"],
      {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      },
    );

    const map = result as Map<string, { earned: number; pending: number }>;
    expect(map.get("agent-1")?.earned).toBeCloseTo(350.75, 2);
    expect(map.get("agent-1")?.pending).toBe(0);
  });

  it("should handle null/undefined override amounts gracefully", async () => {
    const mockData = [
      {
        base_agent_id: "agent-1",
        policy_id: "policy-1",
        override_commission_amount: null,
        status: "earned",
      },
      {
        base_agent_id: "agent-1",
        policy_id: "policy-2",
        override_commission_amount: undefined,
        status: "earned",
      },
      {
        base_agent_id: "agent-1",
        policy_id: "policy-3",
        override_commission_amount: "100",
        status: "earned",
      },
    ];
    mockServiceOverrideFlow(
      [
        {
          policy_id: "policy-1",
          user_id: "agent-1",
          payment_date: "2024-01-05",
        },
        {
          policy_id: "policy-2",
          user_id: "agent-1",
          payment_date: "2024-01-06",
        },
        {
          policy_id: "policy-3",
          user_id: "agent-1",
          payment_date: "2024-01-07",
        },
      ],
      mockData,
    );

    const { HierarchyService } =
      await import("../../../services/hierarchy/hierarchyService");
    const service = new HierarchyService();

    const result = await service.getViewerOverridesFromAgent(
      "viewer-123",
      ["agent-1"],
      {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      },
    );

    const map = result as Map<string, { earned: number; pending: number }>;
    expect(map.get("agent-1")).toEqual({ earned: 100, pending: 0 }); // null and undefined treated as 0
  });
});

describe("PolicyRepository.findMetricsByUserIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array for empty userIds", async () => {
    const { PolicyRepository } =
      await import("../../../services/policies/PolicyRepository");
    const repo = new PolicyRepository();

    const result = await repo.findMetricsByUserIds([]);

    expect(result).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("should fetch policies for multiple users in single query", async () => {
    const mockData = [
      {
        user_id: "user-1",
        status: "active",
        annual_premium: 1000,
        created_at: "2024-01-15",
      },
      {
        user_id: "user-2",
        status: "active",
        annual_premium: 2000,
        created_at: "2024-01-20",
      },
      {
        user_id: "user-1",
        status: "pending",
        annual_premium: 500,
        created_at: "2024-01-25",
      },
    ];
    const mockBuilder = createMockQueryBuilder(mockData);
    (supabase.from as Mock).mockReturnValue(mockBuilder);

    const { PolicyRepository } =
      await import("../../../services/policies/PolicyRepository");
    const repo = new PolicyRepository();

    const result = await repo.findMetricsByUserIds(["user-1", "user-2"]);

    expect(result).toEqual(mockData);
    expect(mockBuilder.select).toHaveBeenCalledWith(
      "user_id, status, lifecycle_status, annual_premium, created_at, submit_date, effective_date",
    );
    expect(mockBuilder.in).toHaveBeenCalledWith("user_id", [
      "user-1",
      "user-2",
    ]);
  });

  it("should include created_at for date filtering", async () => {
    const mockData = [
      {
        user_id: "user-1",
        status: "active",
        annual_premium: 1000,
        created_at: "2024-01-15T10:00:00Z",
      },
    ];
    const mockBuilder = createMockQueryBuilder(mockData);
    (supabase.from as Mock).mockReturnValue(mockBuilder);

    const { PolicyRepository } =
      await import("../../../services/policies/PolicyRepository");
    const repo = new PolicyRepository();

    const result = await repo.findMetricsByUserIds(["user-1"]);

    expect(result[0]).toHaveProperty("created_at");
    expect(result[0].created_at).toBe("2024-01-15T10:00:00Z");
  });
});
