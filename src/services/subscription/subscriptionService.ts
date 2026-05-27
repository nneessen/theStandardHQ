// src/services/subscription/subscriptionService.ts
// Service for managing subscription data

import {
  SubscriptionRepository,
  SubscriptionPlan,
  UserSubscription,
  UsageTracking,
  SubscriptionPayment,
  SubscriptionEvent,
} from "./SubscriptionRepository";
import { supabase } from "@/services/base";
import type {
  AddonTierConfig,
  SubscriptionAddon,
} from "./adminSubscriptionService";
import type { Database } from "@/types/database.types";

type UserSubscriptionAddonRow =
  Database["public"]["Tables"]["user_subscription_addons"]["Row"];
type TeamUWWizardSeatUsageRow =
  Database["public"]["Functions"]["get_team_uw_wizard_seat_usage"]["Returns"][number];

export interface UserActiveAddon extends UserSubscriptionAddonRow {
  addon: SubscriptionAddon | null;
}

export type {
  SubscriptionPlan,
  UserSubscription,
  UsageTracking,
  SubscriptionPayment,
  SubscriptionEvent,
};

export type { SubscriptionFeatures } from "./SubscriptionRepository";

export interface UsageStatus {
  metric: "emails_sent" | "sms_sent";
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  isOverLimit: boolean;
  overage: number;
  overageCost: number; // in cents
}

// Pricing constants
export const PRICING = {
  EMAIL_OVERAGE_PACK: 500,
  EMAIL_OVERAGE_PRICE: 500, // cents ($5.00)
  EMAIL_OVERAGE_PER_EMAIL: 1, // cents per email ($0.01)
  SMS_PRICE_PER_MESSAGE: 5, // cents per SMS ($0.05)
  USAGE_WARNING_THRESHOLD: 0.8, // 80%
  USAGE_LIMIT_THRESHOLD: 1.0, // 100%
} as const;

class SubscriptionService {
  private repository: SubscriptionRepository;

  constructor() {
    this.repository = new SubscriptionRepository();
  }

  /**
   * Get all active subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    return this.repository.findActivePlans();
  }

  /**
   * Get a specific plan by name
   */
  async getPlanByName(name: string): Promise<SubscriptionPlan | null> {
    return this.repository.findPlanByName(name);
  }

  /**
   * Get current user's subscription with plan details
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    return this.repository.findByUserIdWithPlan(userId);
  }

  /**
   * Get user's subscription tier (quick lookup)
   */
  async getUserTier(userId: string): Promise<string> {
    return this.repository.getUserTier(userId);
  }

  /**
   * Check if user has access to a feature
   */
  async hasFeature(userId: string, feature: string): Promise<boolean> {
    return this.repository.userHasFeature(userId, feature);
  }

  /**
   * Check if user has access to an analytics section
   */
  async hasAnalyticsSection(userId: string, section: string): Promise<boolean> {
    return this.repository.userHasAnalyticsSection(userId, section);
  }

  /**
   * Get usage tracking for current period
   */
  async getUsage(
    userId: string,
    metric: "emails_sent" | "sms_sent",
  ): Promise<UsageTracking | null> {
    return this.repository.getUsage(userId, metric);
  }

  /**
   * Get usage status with calculated limits
   */
  async getUsageStatus(
    userId: string,
    metric: "emails_sent" | "sms_sent",
  ): Promise<UsageStatus> {
    const [usage, subscription] = await Promise.all([
      this.getUsage(userId, metric),
      this.getUserSubscription(userId),
    ]);

    const used = usage?.count || 0;
    const limit =
      metric === "emails_sent" ? subscription?.plan.email_limit || 0 : 0;

    const remaining = Math.max(0, limit - used);
    const percentUsed = limit > 0 ? (used / limit) * 100 : 0;
    const isOverLimit = limit > 0 && used > limit;
    const overage = isOverLimit ? used - limit : 0;

    let overageCost = 0;
    if (metric === "emails_sent" && overage > 0) {
      overageCost = overage * PRICING.EMAIL_OVERAGE_PER_EMAIL;
    } else if (metric === "sms_sent") {
      overageCost = used * PRICING.SMS_PRICE_PER_MESSAGE;
    }

    return {
      metric,
      used,
      limit,
      remaining,
      percentUsed: Math.min(percentUsed, 100),
      isOverLimit,
      overage,
      overageCost,
    };
  }

  /**
   * Increment usage (for tracking email/SMS sends)
   */
  async incrementUsage(
    userId: string,
    metric: "emails_sent" | "sms_sent",
    count: number = 1,
  ): Promise<number> {
    return this.repository.incrementUsage(userId, metric, count);
  }

  /**
   * Check subscription status
   */
  isSubscriptionActive(subscription: UserSubscription | null): boolean {
    if (!subscription) return false;

    // Free plan is always active — it never expires
    if (subscription.plan?.name === "free") return true;

    const validStatuses = ["active", "trialing"];
    if (!validStatuses.includes(subscription.status)) return false;

    const now = new Date();

    // Check if grandfathered period is still valid
    if (subscription.grandfathered_until) {
      const grandfatherEnd = new Date(subscription.grandfathered_until);
      if (grandfatherEnd > now) return true;
    }

    // Check if current period is still valid
    if (subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end);
      return periodEnd > now;
    }

    // No period end set and status is active/trialing
    return true;
  }

  /**
   * Whether the user is on a PAID tier (Pro/Team) and therefore has a real
   * subscription to manage — view invoices, update card, or cancel — via the
   * Stripe customer portal. Returns false for the Free plan and for users with
   * no subscription.
   *
   * Used to decide who may see the Billing page while self-serve sign-ups are
   * disabled. Intentionally does NOT require `isSubscriptionActive`: a
   * delinquent payer (status `past_due`/`unpaid`/`incomplete`) still has a live
   * Stripe subscription and MOST needs portal access to fix their card or
   * cancel — locking them out would let charges continue with no way to stop.
   * Cancellation reverts the row to the Free plan, which this correctly excludes.
   */
  hasManageableSubscription(subscription: UserSubscription | null): boolean {
    if (!subscription?.plan) return false;
    return this.isPaidPlan(subscription.plan);
  }

  /**
   * Check if user is grandfathered
   */
  isGrandfathered(subscription: UserSubscription | null): boolean {
    if (!subscription?.grandfathered_until) return false;
    const grandfatherEnd = new Date(subscription.grandfathered_until);
    return grandfatherEnd > new Date();
  }

  /**
   * Get days remaining in grandfather period
   */
  getGrandfatherDaysRemaining(subscription: UserSubscription | null): number {
    if (!subscription?.grandfathered_until) return 0;
    const grandfatherEnd = new Date(subscription.grandfathered_until);
    const now = new Date();
    const diff = grandfatherEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Format price in dollars
   */
  formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(userId: string): Promise<SubscriptionPayment[]> {
    return this.repository.getPaymentHistory(userId);
  }

  /**
   * Get subscription events for a user (for debugging/admin)
   */
  async getSubscriptionEvents(
    userId: string,
    limit: number = 50,
  ): Promise<SubscriptionEvent[]> {
    return this.repository.getSubscriptionEvents(userId, limit);
  }

  /**
   * Create a Stripe Checkout Session for a plan subscription
   * Returns the checkout URL to redirect the user to
   */
  async createCheckoutSession(
    plan: SubscriptionPlan,
    billingInterval: "monthly" | "annual" = "monthly",
    discountCode?: string,
    pendingAddon?: { addonId: string; tierId: string },
  ): Promise<string | null> {
    const priceId =
      billingInterval === "annual"
        ? plan.stripe_price_id_annual
        : plan.stripe_price_id_monthly;

    if (!priceId) {
      console.error(
        `No Stripe Price ID configured for plan: ${plan.name} (${billingInterval})`,
      );
      return null;
    }

    // Build success URL with plan context and optional pending addon params
    let successUrl = `${window.location.origin}/billing?checkout=success&plan_name=${encodeURIComponent(plan.name)}&billing_interval=${billingInterval}`;
    if (pendingAddon) {
      successUrl += `&pending_addon_id=${pendingAddon.addonId}&pending_tier_id=${pendingAddon.tierId}`;
    }

    try {
      const { data, error } = await this.repository.invokeEdgeFunction(
        "create-checkout-session",
        {
          priceId,
          successUrl,
          cancelUrl: `${window.location.origin}/billing`,
          discountCode: discountCode || undefined,
        },
      );

      if (error) {
        console.error("Failed to create checkout session:", error);
        return null;
      }

      return (data?.url as string) || null;
    } catch (error) {
      console.error("Error creating checkout session:", error);
      return null;
    }
  }

  /**
   * Create a Stripe Customer Portal session
   * Returns the portal URL to redirect the user to
   */
  async createPortalSession(_userId: string): Promise<string | null> {
    // Do not guard on stripe_customer_id here — the edge function resolves it
    // via email fallback if missing (e.g. webhook delay or prior failure).
    try {
      const { data: result, error } = await this.repository.invokeEdgeFunction(
        "create-portal-session",
        {
          returnUrl: `${window.location.origin}/billing?portal_return=1`,
        },
      );

      if (error) {
        console.error("Failed to create portal session:", error);
        return null;
      }

      return (result?.url as string) || null;
    } catch (error) {
      console.error("Error creating portal session:", error);
      return null;
    }
  }

  /**
   * Add an addon as a line item on the user's existing subscription.
   * Price resolution is handled server-side based on the subscription's billing interval.
   */
  async addSubscriptionAddon(
    addonId: string,
    tierId?: string,
  ): Promise<{ success: boolean; error?: string; checkoutUrl?: string }> {
    try {
      const { data, error } = await this.repository.invokeEdgeFunction(
        "manage-subscription-items",
        {
          action: "add_addon",
          addonId,
          tierId: tierId || undefined,
        },
      );

      if (error) {
        return { success: false, error };
      }

      // If the server returns a checkout URL, the client should redirect
      if (data?.requiresCheckout && data?.checkoutUrl) {
        return {
          success: true,
          checkoutUrl: data.checkoutUrl as string,
        };
      }

      return {
        success: !!data?.success,
        error: (data?.error as string) || undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * Remove an addon line item from the user's subscription.
   */
  async removeSubscriptionAddon(
    addonId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.repository.invokeEdgeFunction(
        "manage-subscription-items",
        {
          action: "remove_addon",
          addonId,
        },
      );

      if (error) {
        return { success: false, error };
      }

      return {
        success: !!data?.success,
        error: (data?.error as string) || undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * Get user's active addon subscriptions with addon details
   * Returns addons with status 'active' or 'manual_grant'
   */
  async getUserActiveAddons(userId: string): Promise<UserActiveAddon[]> {
    try {
      const { data, error } = await supabase
        .from("user_subscription_addons")
        .select(`*, addon:subscription_addons(*)`)
        .eq("user_id", userId)
        .in("status", ["active", "manual_grant"]);

      if (error) {
        console.error("Failed to fetch user active addons:", error);
        return [];
      }

      return (data || []).map((item) => ({
        ...item,
        addon: Array.isArray(item.addon) ? item.addon[0] : item.addon,
      }));
    } catch (error) {
      console.error("Error fetching user active addons:", error);
      return [];
    }
  }

  /**
   * Calculate the monthly price of an addon subscription,
   * resolving tiered pricing when applicable
   */
  getAddonMonthlyPrice(userAddon: UserActiveAddon): number {
    if (!userAddon.addon) return 0;

    // If addon has tier_config and user has a tier_id, resolve tier pricing
    if (userAddon.tier_id) {
      const tierConfig = userAddon.addon.tier_config as AddonTierConfig | null;
      if (tierConfig?.tiers) {
        const tier = tierConfig.tiers.find((t) => t.id === userAddon.tier_id);
        if (tier) {
          return userAddon.billing_interval === "annual"
            ? Math.round(tier.price_annual / 12)
            : tier.price_monthly;
        }
      }
    }

    // Fallback to addon-level pricing
    return userAddon.billing_interval === "annual"
      ? Math.round(userAddon.addon.price_annual / 12)
      : userAddon.addon.price_monthly;
  }

  /**
   * Check if a plan requires payment (not free)
   */
  isPaidPlan(plan: SubscriptionPlan): boolean {
    return plan.price_monthly > 0 || plan.price_annual > 0;
  }

  /**
   * Calculate annual savings for a plan
   */
  getAnnualSavings(plan: SubscriptionPlan): number {
    const monthlyTotal = plan.price_monthly * 12;
    return Math.max(0, monthlyTotal - plan.price_annual);
  }

  /**
   * Get the effective price per month for annual billing
   */
  getEffectiveMonthlyPrice(
    plan: SubscriptionPlan,
    billingInterval: "monthly" | "annual",
  ): number {
    if (billingInterval === "monthly") {
      return plan.price_monthly;
    }
    return Math.round(plan.price_annual / 12);
  }

  // ──────────────────────────────────────────────
  // Team UW Wizard Seat Management
  // ──────────────────────────────────────────────

  /**
   * Get all team UW wizard seats for a team owner
   */
  async getTeamUWWizardSeats(ownerId: string): Promise<TeamUWWizardSeat[]> {
    const { data, error } = await supabase.rpc(
      "get_team_uw_wizard_seat_usage",
      {
        p_owner_id: ownerId,
      },
    );

    if (error) {
      console.error("Failed to fetch team UW wizard seats:", error);
      return [];
    }

    return (data || []).map((row: TeamUWWizardSeatUsageRow) => ({
      id: row.seat_id,
      team_owner_id: row.team_owner_id,
      agent_id: row.agent_id,
      runs_limit: row.runs_limit,
      runs_used: row.runs_used,
      runs_remaining: row.runs_remaining,
      last_run_at: row.last_run_at,
      created_at: row.created_at,
      agent: {
        id: row.agent_id,
        first_name: row.agent_first_name,
        last_name: row.agent_last_name,
        email: row.agent_email,
      },
    })) as TeamUWWizardSeat[];
  }

  /**
   * Get team seat limit for an owner (base 5 + seat packs)
   */
  async getTeamSeatLimit(ownerId: string): Promise<number> {
    const { data, error } = await supabase.rpc("get_team_seat_limit", {
      p_owner_id: ownerId,
    });

    if (error) {
      console.error("Failed to get team seat limit:", error);
      return 5; // default base
    }

    return data as number;
  }

  /**
   * Get eligible downline agents (not already seated) for seat assignment
   */
  async getEligibleDownlines(
    ownerId: string,
  ): Promise<EligibleDownlineAgent[]> {
    // Get agents in downline via hierarchy_path containing owner ID
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email")
      .like("hierarchy_path", `%${ownerId}%`)
      .neq("id", ownerId)
      .order("last_name");

    if (error) {
      console.error("Failed to fetch eligible downlines:", error);
      return [];
    }

    // Filter out agents already seated by anyone
    const { data: seated } = await supabase
      .from("team_uw_wizard_seats")
      .select("agent_id");

    const seatedIds = new Set((seated || []).map((s) => s.agent_id));

    return (data || []).filter(
      (agent) => !seatedIds.has(agent.id),
    ) as EligibleDownlineAgent[];
  }

  /**
   * Grant a team UW wizard seat to an agent
   */
  async grantTeamUWSeat(
    ownerId: string,
    agentId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc("manage_team_uw_seat", {
      p_owner_id: ownerId,
      p_agent_id: agentId,
      p_action: "grant",
    });

    if (error) {
      console.error("Failed to grant team UW seat:", error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string };
    return result;
  }

  /**
   * Revoke a team UW wizard seat from an agent
   */
  async revokeTeamUWSeat(
    ownerId: string,
    agentId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.rpc("manage_team_uw_seat", {
      p_owner_id: ownerId,
      p_agent_id: agentId,
      p_action: "revoke",
    });

    if (error) {
      console.error("Failed to revoke team UW seat:", error);
      return { success: false, error: error.message };
    }

    const result = data as { success: boolean; error?: string };
    return result;
  }

  /**
   * Add a seat pack as a line item on the user's existing subscription.
   * Price is resolved server-side.
   */
  async addSeatPack(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.repository.invokeEdgeFunction(
        "manage-subscription-items",
        {
          action: "add_seat_pack",
        },
      );

      if (error) {
        return { success: false, error };
      }

      return {
        success: !!data?.success,
        error: (data?.error as string) || undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }

  /**
   * Remove a seat pack line item from the user's subscription.
   */
  async removeSeatPack(
    seatPackId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.repository.invokeEdgeFunction(
        "manage-subscription-items",
        {
          action: "remove_seat_pack",
          seatPackId,
        },
      );

      if (error) {
        return { success: false, error };
      }

      return {
        success: !!data?.success,
        error: (data?.error as string) || undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  }
  /**
   * Reconciliation fallback: syncs subscription state from Stripe to DB.
   * Called after checkout when webhook delivery may be delayed.
   */
  async syncSubscriptionFromStripe(): Promise<{
    synced: boolean;
    plan?: string;
    reason?: string;
  }> {
    try {
      const { data, error } = await this.repository.invokeEdgeFunction(
        "sync-subscription",
        {},
      );

      if (error) {
        return { synced: false, reason: error };
      }

      return {
        synced: !!data?.synced,
        plan: (data?.plan as string) || undefined,
        reason: (data?.reason as string) || undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { synced: false, reason: msg };
    }
  }
}

export interface TeamUWWizardSeat {
  id: string;
  team_owner_id: string;
  agent_id: string;
  runs_limit: number;
  runs_used: number;
  runs_remaining: number;
  last_run_at: string | null;
  created_at: string;
  agent: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

export interface EligibleDownlineAgent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export const subscriptionService = new SubscriptionService();
