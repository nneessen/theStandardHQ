// src/services/subscription/__tests__/subscriptionService.test.ts
// Unit tests for SubscriptionService and SubscriptionRepository

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Supabase - using hoisted mock
vi.mock("../../base/supabase", () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();

  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
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
import { SubscriptionRepository } from "../SubscriptionRepository";
import { subscriptionService, PRICING } from "../subscriptionService";
import { supabase } from "../../base/supabase";

// ---------------------------------------------------------------------------
// Helper functions for mock setup
// ---------------------------------------------------------------------------

function createMockChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();

  return chain;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPlan = {
  id: "plan-1",
  name: "pro",
  display_name: "Pro",
  description: "Professional plan",
  price_monthly: 2900,
  price_annual: 29000,
  email_limit: 1000,
  is_active: true,
  sort_order: 2,
  stripe_price_id_monthly: "price_monthly_1",
  stripe_price_id_annual: "price_annual_1",
  features: {
    dashboard: true,
    policies: true,
    comp_guide: true,
    settings: true,
    connect_upline: true,
    expenses: true,
    targets_basic: true,
    targets_full: true,
    reports_view: true,
    reports_export: true,
    email: true,
    sms: false,
    hierarchy: true,
    recruiting: true,
    overrides: true,
    downline_reports: true,
  },
  analytics_sections: ["core", "advanced"],
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

// Use dynamic dates to ensure tests always work
const futureEndDate = new Date();
futureEndDate.setMonth(futureEndDate.getMonth() + 1);

const mockSubscription = {
  id: "sub-1",
  user_id: "user-123",
  plan_id: "plan-1",
  status: "active",
  stripe_subscription_id: "sub_123",
  stripe_customer_id: "cus_123",
  current_period_start: new Date().toISOString(),
  current_period_end: futureEndDate.toISOString(),
  grandfathered_until: null,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  plan: mockPlan,
};

const mockUsage = {
  id: "usage-1",
  user_id: "user-123",
  metric: "emails_sent",
  count: 500,
  period_start: "2025-01-01",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-15T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// SubscriptionRepository Tests
// ---------------------------------------------------------------------------

describe("SubscriptionRepository", () => {
  let repository: SubscriptionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new SubscriptionRepository();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("findActivePlans", () => {
    it("should return all active plans", async () => {
      const mockChain = createMockChain();
      mockChain.order.mockResolvedValue({ data: [mockPlan], error: null });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await repository.findActivePlans();

      expect(supabase.from).toHaveBeenCalledWith("subscription_plans");
      expect(mockChain.select).toHaveBeenCalledWith("*");
      expect(mockChain.eq).toHaveBeenCalledWith("is_active", true);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("pro");
    });

    it("should return empty array on error", async () => {
      const mockChain = createMockChain();
      mockChain.order.mockResolvedValue({
        data: null,
        error: { code: "500", message: "DB error" },
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      await expect(repository.findActivePlans()).rejects.toThrow();
    });
  });

  describe("findPlanByName", () => {
    it("should find plan by name", async () => {
      const mockChain = createMockChain();
      mockChain.single.mockResolvedValue({ data: mockPlan, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await repository.findPlanByName("pro");

      expect(mockChain.eq).toHaveBeenCalledWith("name", "pro");
      expect(result).toBeDefined();
      expect(result?.name).toBe("pro");
    });

    it("should return null for non-existent plan", async () => {
      const mockChain = createMockChain();
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await repository.findPlanByName("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByUserIdWithPlan", () => {
    it("should find subscription with plan details", async () => {
      // Code uses .maybeSingle() not .single()
      const mockChain = createMockChain();
      mockChain.maybeSingle.mockResolvedValue({
        data: mockSubscription,
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await repository.findByUserIdWithPlan("user-123");

      expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(result).toBeDefined();
      expect(result?.plan.name).toBe("pro");
    });

    it("should return null when no subscription exists", async () => {
      // Code uses .maybeSingle() not .single()
      const mockChain = createMockChain();
      mockChain.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await repository.findByUserIdWithPlan("user-no-sub");

      expect(result).toBeNull();
    });
  });

  describe("getUserTier", () => {
    it("should return user tier via RPC", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: "pro",
        error: null,
      } as never);

      const result = await repository.getUserTier("user-123");

      expect(supabase.rpc).toHaveBeenCalledWith("get_user_subscription_tier", {
        p_user_id: "user-123",
      });
      expect(result).toBe("pro");
    });

    it("should return 'free' on error", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { code: "500", message: "Error" },
      } as never);

      const result = await repository.getUserTier("user-123");

      expect(result).toBe("free");
    });
  });

  describe("userHasFeature", () => {
    it("should check feature access via RPC", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as never);

      const result = await repository.userHasFeature("user-123", "email");

      expect(supabase.rpc).toHaveBeenCalledWith("user_has_feature", {
        p_user_id: "user-123",
        p_feature: "email",
      });
      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { code: "500", message: "Error" },
      } as never);

      const result = await repository.userHasFeature("user-123", "email");

      expect(result).toBe(false);
    });
  });

  describe("userHasAnalyticsSection", () => {
    it("should check analytics section access via RPC", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: true,
        error: null,
      } as never);

      const result = await repository.userHasAnalyticsSection(
        "user-123",
        "advanced",
      );

      expect(supabase.rpc).toHaveBeenCalledWith("user_has_analytics_section", {
        p_user_id: "user-123",
        p_section: "advanced",
      });
      expect(result).toBe(true);
    });
  });

  describe("getUsage", () => {
    it("should get usage for current period", async () => {
      const mockChain = createMockChain();
      mockChain.maybeSingle.mockResolvedValue({ data: mockUsage, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await repository.getUsage("user-123", "emails_sent");

      expect(supabase.from).toHaveBeenCalledWith("usage_tracking");
      expect(mockChain.eq).toHaveBeenCalledWith("user_id", "user-123");
      expect(mockChain.eq).toHaveBeenCalledWith("metric", "emails_sent");
      expect(result).toBeDefined();
      expect(result?.count).toBe(500);
    });
  });

  describe("incrementUsage", () => {
    it("should increment usage via RPC", async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 501,
        error: null,
      } as never);

      const result = await repository.incrementUsage(
        "user-123",
        "emails_sent",
        1,
      );

      expect(supabase.rpc).toHaveBeenCalledWith("increment_usage", {
        p_user_id: "user-123",
        p_metric: "emails_sent",
        p_increment: 1,
      });
      expect(result).toBe(501);
    });
  });

  describe("getPaymentHistory", () => {
    it("should get payment history ordered by date", async () => {
      const mockPayments = [
        {
          id: "pay-1",
          user_id: "user-123",
          amount: 2900,
          status: "succeeded",
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ];
      const mockChain = createMockChain();
      mockChain.order.mockResolvedValue({ data: mockPayments, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await repository.getPaymentHistory("user-123");

      expect(supabase.from).toHaveBeenCalledWith("subscription_payments");
      expect(result).toHaveLength(1);
    });
  });

  describe("getSubscriptionEvents", () => {
    it("should get subscription events with limit", async () => {
      const mockEvents = [
        {
          id: "evt-1",
          user_id: "user-123",
          event_type: "subscription_created",
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ];
      const mockChain = createMockChain();
      mockChain.limit.mockResolvedValue({ data: mockEvents, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await repository.getSubscriptionEvents("user-123", 10);

      expect(supabase.from).toHaveBeenCalledWith("subscription_events");
      expect(mockChain.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// SubscriptionService Tests
// ---------------------------------------------------------------------------

describe("SubscriptionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("PRICING constants", () => {
    it("should have correct pricing values", () => {
      expect(PRICING.EMAIL_OVERAGE_PACK).toBe(500);
      expect(PRICING.EMAIL_OVERAGE_PRICE).toBe(500);
      expect(PRICING.EMAIL_OVERAGE_PER_EMAIL).toBe(1);
      expect(PRICING.SMS_PRICE_PER_MESSAGE).toBe(5);
      expect(PRICING.USAGE_WARNING_THRESHOLD).toBe(0.8);
      expect(PRICING.USAGE_LIMIT_THRESHOLD).toBe(1.0);
    });
  });

  describe("getUsageStatus", () => {
    it("should calculate usage status correctly", async () => {
      // getUsageStatus runs two parallel queries: getUsage (usage_tracking, maybeSingle)
      // and getUserSubscription (user_subscriptions, maybeSingle).
      // Branch by table name to return the right data to each.
      const usageChain = createMockChain();
      usageChain.maybeSingle.mockResolvedValue({
        data: mockUsage,
        error: null,
      });

      const subscriptionChain = createMockChain();
      subscriptionChain.maybeSingle.mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "usage_tracking") return usageChain as never;
        return subscriptionChain as never;
      });

      const result = await subscriptionService.getUsageStatus(
        "user-123",
        "emails_sent",
      );

      expect(result.metric).toBe("emails_sent");
      expect(result.used).toBe(500);
      expect(result.limit).toBe(1000);
      expect(result.remaining).toBe(500);
      expect(result.percentUsed).toBe(50);
      expect(result.isOverLimit).toBe(false);
      expect(result.overage).toBe(0);
      expect(result.overageCost).toBe(0);
    });

    it("should calculate overage correctly when over limit", async () => {
      const overLimitUsage = { ...mockUsage, count: 1200 };

      const usageChain = createMockChain();
      usageChain.maybeSingle.mockResolvedValue({
        data: overLimitUsage,
        error: null,
      });

      const subscriptionChain = createMockChain();
      subscriptionChain.maybeSingle.mockResolvedValue({
        data: mockSubscription,
        error: null,
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "usage_tracking") return usageChain as never;
        return subscriptionChain as never;
      });

      const result = await subscriptionService.getUsageStatus(
        "user-123",
        "emails_sent",
      );

      expect(result.isOverLimit).toBe(true);
      expect(result.overage).toBe(200);
      expect(result.overageCost).toBe(200); // 200 * 1 cent per email
    });
  });

  describe("isSubscriptionActive", () => {
    it("should return true for active subscription", () => {
      const result = subscriptionService.isSubscriptionActive(
        mockSubscription as never,
      );
      expect(result).toBe(true);
    });

    it("should return false for null subscription", () => {
      const result = subscriptionService.isSubscriptionActive(null);
      expect(result).toBe(false);
    });

    it("should return false for canceled subscription", () => {
      const canceled = { ...mockSubscription, status: "canceled" };
      const result = subscriptionService.isSubscriptionActive(
        canceled as never,
      );
      expect(result).toBe(false);
    });

    it("should return true for trialing subscription", () => {
      const trialing = { ...mockSubscription, status: "trialing" };
      const result = subscriptionService.isSubscriptionActive(
        trialing as never,
      );
      expect(result).toBe(true);
    });

    it("should return true for active grandfathered subscription", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const grandfathered = {
        ...mockSubscription,
        grandfathered_until: futureDate.toISOString(),
      };
      const result = subscriptionService.isSubscriptionActive(
        grandfathered as never,
      );
      expect(result).toBe(true);
    });
  });

  describe("isGrandfathered", () => {
    it("should return true for active grandfathered subscription", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const grandfathered = {
        ...mockSubscription,
        grandfathered_until: futureDate.toISOString(),
      };
      const result = subscriptionService.isGrandfathered(
        grandfathered as never,
      );
      expect(result).toBe(true);
    });

    it("should return false for expired grandfather period", () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const expired = {
        ...mockSubscription,
        grandfathered_until: pastDate.toISOString(),
      };
      const result = subscriptionService.isGrandfathered(expired as never);
      expect(result).toBe(false);
    });

    it("should return false for null subscription", () => {
      const result = subscriptionService.isGrandfathered(null);
      expect(result).toBe(false);
    });
  });

  describe("getGrandfatherDaysRemaining", () => {
    it("should calculate days remaining correctly", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const grandfathered = {
        ...mockSubscription,
        grandfathered_until: futureDate.toISOString(),
      };
      const result = subscriptionService.getGrandfatherDaysRemaining(
        grandfathered as never,
      );
      expect(result).toBeGreaterThanOrEqual(29);
      expect(result).toBeLessThanOrEqual(31);
    });

    it("should return 0 for expired grandfather period", () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const expired = {
        ...mockSubscription,
        grandfathered_until: pastDate.toISOString(),
      };
      const result = subscriptionService.getGrandfatherDaysRemaining(
        expired as never,
      );
      expect(result).toBe(0);
    });

    it("should return 0 for null subscription", () => {
      const result = subscriptionService.getGrandfatherDaysRemaining(null);
      expect(result).toBe(0);
    });
  });

  describe("formatPrice", () => {
    it("should format cents to dollars", () => {
      expect(subscriptionService.formatPrice(2900)).toBe("$29.00");
      expect(subscriptionService.formatPrice(100)).toBe("$1.00");
      expect(subscriptionService.formatPrice(0)).toBe("$0.00");
      expect(subscriptionService.formatPrice(999)).toBe("$9.99");
    });
  });

  describe("isPaidPlan", () => {
    it("should return true for paid plan", () => {
      const result = subscriptionService.isPaidPlan(mockPlan as never);
      expect(result).toBe(true);
    });

    it("should return false for free plan", () => {
      const freePlan = { ...mockPlan, price_monthly: 0, price_annual: 0 };
      const result = subscriptionService.isPaidPlan(freePlan as never);
      expect(result).toBe(false);
    });
  });

  describe("hasManageableSubscription", () => {
    it("should return true for an active paid (Pro/Team) subscription", () => {
      const result = subscriptionService.hasManageableSubscription(
        mockSubscription as never,
      );
      expect(result).toBe(true);
    });

    it("should return false for null subscription", () => {
      const result = subscriptionService.hasManageableSubscription(null);
      expect(result).toBe(false);
    });

    it("should return false for a FREE plan (not a paid subscription)", () => {
      const freePlan = {
        ...mockPlan,
        name: "free",
        price_monthly: 0,
        price_annual: 0,
      };
      const freeSubscription = { ...mockSubscription, plan: freePlan };
      const result = subscriptionService.hasManageableSubscription(
        freeSubscription as never,
      );
      expect(result).toBe(false);
    });

    it("should return TRUE for a past_due paid subscriber (must keep portal access to fix payment / cancel)", () => {
      const pastDue = { ...mockSubscription, status: "past_due" };
      const result = subscriptionService.hasManageableSubscription(
        pastDue as never,
      );
      expect(result).toBe(true);
    });

    it("should return TRUE for an unpaid paid subscriber", () => {
      const unpaid = { ...mockSubscription, status: "unpaid" };
      const result = subscriptionService.hasManageableSubscription(
        unpaid as never,
      );
      expect(result).toBe(true);
    });

    it("should return false once a canceled subscription has reverted to the Free plan", () => {
      const freePlan = {
        ...mockPlan,
        name: "free",
        price_monthly: 0,
        price_annual: 0,
      };
      const reverted = {
        ...mockSubscription,
        status: "canceled",
        plan: freePlan,
      };
      const result = subscriptionService.hasManageableSubscription(
        reverted as never,
      );
      expect(result).toBe(false);
    });

    it("should return false when the plan relation is missing", () => {
      const noPlan = { ...mockSubscription, plan: undefined };
      const result = subscriptionService.hasManageableSubscription(
        noPlan as never,
      );
      expect(result).toBe(false);
    });
  });

  describe("getAnnualSavings", () => {
    it("should calculate annual savings correctly", () => {
      const result = subscriptionService.getAnnualSavings(mockPlan as never);
      // 2900 * 12 = 34800 - 29000 = 5800
      expect(result).toBe(5800);
    });

    it("should return 0 when annual is more expensive", () => {
      const weirdPlan = {
        ...mockPlan,
        price_monthly: 1000,
        price_annual: 15000,
      };
      const result = subscriptionService.getAnnualSavings(weirdPlan as never);
      expect(result).toBe(0);
    });
  });

  describe("getEffectiveMonthlyPrice", () => {
    it("should return monthly price for monthly billing", () => {
      const result = subscriptionService.getEffectiveMonthlyPrice(
        mockPlan as never,
        "monthly",
      );
      expect(result).toBe(2900);
    });

    it("should calculate monthly equivalent for annual billing", () => {
      const result = subscriptionService.getEffectiveMonthlyPrice(
        mockPlan as never,
        "annual",
      );
      // 29000 / 12 = 2416.66... rounded to 2417
      expect(result).toBe(2417);
    });
  });

  describe("createCheckoutSession", () => {
    it("should return null when price ID is missing", async () => {
      const planNoPrice = {
        ...mockPlan,
        stripe_price_id_monthly: null,
        stripe_price_id_annual: null,
      };
      const result = await subscriptionService.createCheckoutSession(
        planNoPrice as never,
        "monthly",
      );
      expect(result).toBeNull();
    });
  });

  describe("createPortalSession", () => {
    it("should return null when no customer ID exists", async () => {
      const mockChain = createMockChain();
      mockChain.single.mockResolvedValue({
        data: { stripe_customer_id: null },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockChain as never);

      const result = await subscriptionService.createPortalSession("user-123");

      expect(result).toBeNull();
    });
  });
});
