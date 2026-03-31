// src/services/subscription/SubscriptionRepository.ts
// Repository for subscription-related tables data access

import { BaseRepository, BaseEntity } from "../base/BaseRepository";
import { logger } from "../base/logger";
import type { Database } from "@/types/database.types";

// Database row types
type SubscriptionPlanRow =
  Database["public"]["Tables"]["subscription_plans"]["Row"];
type UserSubscriptionRow =
  Database["public"]["Tables"]["user_subscriptions"]["Row"];
type UsageTrackingRow = Database["public"]["Tables"]["usage_tracking"]["Row"];
type SubscriptionPaymentRow =
  Database["public"]["Tables"]["subscription_payments"]["Row"];
type SubscriptionEventRow =
  Database["public"]["Tables"]["subscription_events"]["Row"];

// Feature definitions
// All keys must be present in subscription_plans.features JSONB
export interface SubscriptionFeatures {
  dashboard: boolean;
  analytics: boolean;
  policies: boolean;
  comp_guide: boolean;
  settings: boolean;
  connect_upline: boolean;
  expenses: boolean;
  targets_basic: boolean;
  targets_full: boolean;
  reports_view: boolean;
  reports_export: boolean;
  // Messaging features
  email: boolean;
  sms: boolean;
  slack: boolean;
  instagram_messaging: boolean;
  // Instagram sub-features
  instagram_scheduled_messages: boolean;
  instagram_templates: boolean;
  // Team features
  hierarchy: boolean;
  team_analytics: boolean;
  recruiting: boolean;
  overrides: boolean;
  leaderboard: boolean;
  downline_reports: boolean;
  // Training features
  training: boolean;
  // Premium branding features
  recruiting_basic: boolean;
  recruiting_custom_pipeline: boolean;
  custom_branding: boolean;
}

// Entity types
export interface SubscriptionPlan extends Omit<
  SubscriptionPlanRow,
  "features"
> {
  features: SubscriptionFeatures;
}

export interface UserSubscription extends UserSubscriptionRow {
  plan: SubscriptionPlan;
}

export type UsageTracking = UsageTrackingRow;
export type SubscriptionPayment = SubscriptionPaymentRow;
export type SubscriptionEvent = SubscriptionEventRow;

// Base entity type for user_subscriptions
export type SubscriptionBaseEntity = UserSubscriptionRow & BaseEntity;

/**
 * Repository for subscription-related tables
 * Handles subscription_plans, user_subscriptions, usage_tracking,
 * subscription_payments, and subscription_events
 */
export class SubscriptionRepository extends BaseRepository<
  SubscriptionBaseEntity,
  Partial<UserSubscriptionRow>,
  Partial<UserSubscriptionRow>
> {
  constructor() {
    super("user_subscriptions");
  }

  /**
   * Transform database record to entity
   */
  protected transformFromDB(
    dbRecord: Record<string, unknown>,
  ): SubscriptionBaseEntity {
    return dbRecord as unknown as SubscriptionBaseEntity;
  }

  /**
   * Transform entity to database record
   */
  protected transformToDB(
    data: Partial<UserSubscriptionRow>,
  ): Record<string, unknown> {
    return data as Record<string, unknown>;
  }

  // ============================================
  // Plan Transform Helper
  // ============================================

  /** Centralized plan transform — handles the features JSONB cast once. */
  transformPlan(row: SubscriptionPlanRow): SubscriptionPlan {
    return {
      ...row,
      features: row.features as unknown as SubscriptionFeatures,
    };
  }

  // ============================================
  // Subscription Plans Methods
  // ============================================

  /**
   * Get all subscription plans (including inactive), ordered by sort_order.
   */
  async findAllPlans(): Promise<SubscriptionPlan[]> {
    try {
      const { data, error } = await this.client
        .from("subscription_plans")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) {
        throw this.handleError(error, "findAllPlans");
      }

      return (data || []).map((plan) => this.transformPlan(plan));
    } catch (error) {
      throw this.wrapError(error, "findAllPlans");
    }
  }

  /**
   * Get all active subscription plans
   */
  async findActivePlans(): Promise<SubscriptionPlan[]> {
    try {
      const { data, error } = await this.client
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        throw this.handleError(error, "findActivePlans");
      }

      return (data || []).map((plan) => this.transformPlan(plan));
    } catch (error) {
      throw this.wrapError(error, "findActivePlans");
    }
  }

  /**
   * Get a specific plan by ID
   */
  async findPlanById(planId: string): Promise<SubscriptionPlan | null> {
    try {
      const { data, error } = await this.client
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw this.handleError(error, "findPlanById");
      }

      return data ? this.transformPlan(data) : null;
    } catch (error) {
      throw this.wrapError(error, "findPlanById");
    }
  }

  /**
   * Get a specific plan by name
   */
  async findPlanByName(name: string): Promise<SubscriptionPlan | null> {
    try {
      const { data, error } = await this.client
        .from("subscription_plans")
        .select("*")
        .eq("name", name)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw this.handleError(error, "findPlanByName");
      }

      return data ? this.transformPlan(data) : null;
    } catch (error) {
      throw this.wrapError(error, "findPlanByName");
    }
  }

  // ============================================
  // User Subscription Methods
  // ============================================

  /**
   * Get user's subscription with plan details
   */
  async findByUserIdWithPlan(userId: string): Promise<UserSubscription | null> {
    try {
      const { data, error } = await this.client
        .from("user_subscriptions")
        .select(
          `
          *,
          plan:subscription_plans(*)
        `,
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw this.handleError(error, "findByUserIdWithPlan");
      }

      if (!data || !data.plan) return null;

      // Handle the case where plan might be an array
      const planData = Array.isArray(data.plan) ? data.plan[0] : data.plan;

      return {
        ...data,
        plan: {
          ...planData,
          features: planData.features as SubscriptionFeatures,
        },
      };
    } catch (error) {
      throw this.wrapError(error, "findByUserIdWithPlan");
    }
  }

  /**
   * Get user's subscription tier via RPC
   */
  async getUserTier(userId: string): Promise<string> {
    try {
      const { data, error } = await this.client.rpc(
        "get_user_subscription_tier",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        logger.error("SubscriptionRepository.getUserTier", error);
        return "free";
      }

      return data || "free";
    } catch (error) {
      logger.error(
        "SubscriptionRepository.getUserTier",
        error instanceof Error ? error : new Error(String(error)),
      );
      return "free";
    }
  }

  /**
   * Check if user has access to a feature via RPC
   */
  async userHasFeature(userId: string, feature: string): Promise<boolean> {
    try {
      const { data, error } = await this.client.rpc("user_has_feature", {
        p_user_id: userId,
        p_feature: feature,
      });

      if (error) {
        logger.error("SubscriptionRepository.userHasFeature", error);
        return false;
      }

      return data || false;
    } catch (error) {
      logger.error(
        "SubscriptionRepository.userHasFeature",
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Check if user has access to an analytics section via RPC
   */
  async userHasAnalyticsSection(
    userId: string,
    section: string,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.client.rpc(
        "user_has_analytics_section",
        {
          p_user_id: userId,
          p_section: section,
        },
      );

      if (error) {
        logger.error("SubscriptionRepository.userHasAnalyticsSection", error);
        return false;
      }

      return data || false;
    } catch (error) {
      logger.error(
        "SubscriptionRepository.userHasAnalyticsSection",
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Get customer portal info (stripe_customer_id)
   */
  async getCustomerPortalInfo(
    userId: string,
  ): Promise<{ stripe_customer_id: string | null } | null> {
    try {
      const { data, error } = await this.client
        .from("user_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        throw this.handleError(error, "getCustomerPortalInfo");
      }

      return data;
    } catch (error) {
      throw this.wrapError(error, "getCustomerPortalInfo");
    }
  }

  /**
   * Invoke a Supabase Edge Function
   */
  async invokeEdgeFunction(
    functionName: string,
    body: Record<string, unknown>,
  ): Promise<{ data: Record<string, unknown> | null; error: string | null }> {
    try {
      const { data, error } = await this.client.functions.invoke(functionName, {
        body,
      });

      if (error) {
        return { data: null, error: error.message };
      }

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============================================
  // Usage Tracking Methods
  // ============================================

  /**
   * Get usage tracking for current period
   */
  async getUsage(
    userId: string,
    metric: "emails_sent" | "sms_sent",
  ): Promise<UsageTracking | null> {
    try {
      // Use UTC to match database storage
      const now = new Date();
      const periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );

      const { data, error } = await this.client
        .from("usage_tracking")
        .select("*")
        .eq("user_id", userId)
        .eq("metric", metric)
        .eq("period_start", periodStart.toISOString().split("T")[0])
        .maybeSingle();

      if (error) {
        logger.error("SubscriptionRepository.getUsage", error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error(
        "SubscriptionRepository.getUsage",
        error instanceof Error ? error : new Error(String(error)),
      );
      return null;
    }
  }

  /**
   * Increment usage via RPC
   */
  async incrementUsage(
    userId: string,
    metric: "emails_sent" | "sms_sent",
    count: number = 1,
  ): Promise<number> {
    try {
      const { data, error } = await this.client.rpc("increment_usage", {
        p_user_id: userId,
        p_metric: metric,
        p_increment: count,
      });

      if (error) {
        throw this.handleError(error, "incrementUsage");
      }

      return data || 0;
    } catch (error) {
      throw this.wrapError(error, "incrementUsage");
    }
  }

  // ============================================
  // Payment History Methods
  // ============================================

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(userId: string): Promise<SubscriptionPayment[]> {
    try {
      const { data, error } = await this.client
        .from("subscription_payments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("SubscriptionRepository.getPaymentHistory", error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(
        "SubscriptionRepository.getPaymentHistory",
        error instanceof Error ? error : new Error(String(error)),
      );
      return [];
    }
  }

  // ============================================
  // Subscription Events Methods
  // ============================================

  /**
   * Get subscription events for a user
   */
  async getSubscriptionEvents(
    userId: string,
    limit: number = 50,
  ): Promise<SubscriptionEvent[]> {
    try {
      const { data, error } = await this.client
        .from("subscription_events")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error("SubscriptionRepository.getSubscriptionEvents", error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error(
        "SubscriptionRepository.getSubscriptionEvents",
        error instanceof Error ? error : new Error(String(error)),
      );
      return [];
    }
  }
}
