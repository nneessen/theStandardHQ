// src/services/subscription/adminSubscriptionService.ts
// Admin service for managing subscription plans and add-ons

import { supabase } from "@/services/base";
import { logger } from "../base/logger";
import type { Database } from "@/types/database.types";
import { SubscriptionRepository } from "./SubscriptionRepository";
import type { SubscriptionFeatures } from "./SubscriptionRepository";
import type { SubscriptionPlan } from "./SubscriptionRepository";

const subscriptionRepo = new SubscriptionRepository();

// Database row types
type SubscriptionPlanRow =
  Database["public"]["Tables"]["subscription_plans"]["Row"];
type SubscriptionAddonRow =
  Database["public"]["Tables"]["subscription_addons"]["Row"];
type UserSubscriptionAddonRow =
  Database["public"]["Tables"]["user_subscription_addons"]["Row"];
type SubscriptionPlanChangeRow =
  Database["public"]["Tables"]["subscription_plan_changes"]["Row"];

// SubscriptionPlan is imported from SubscriptionRepository (single source of truth)

export type SubscriptionAddon = SubscriptionAddonRow;

export interface UserSubscriptionAddon extends UserSubscriptionAddonRow {
  addon?: SubscriptionAddon;
}

export interface AddonUserSummary {
  userId: string;
  status: string;
  grantedBy: string | null;
  fullName: string;
  email: string | null;
  standardChatBotAgentId: string | null;
  voiceSyncStatus: string | null;
  voiceLastSyncAttemptAt: string | null;
  voiceLastSyncedAt: string | null;
  voiceLastSyncError: string | null;
  voiceEntitlementSnapshot: Database["public"]["Tables"]["user_subscription_addons"]["Row"]["voice_entitlement_snapshot"];
}

export interface SubscriptionPlanChange extends SubscriptionPlanChangeRow {
  changer?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

// Param types
export interface UpdatePlanFeaturesParams {
  planId: string;
  features: SubscriptionFeatures;
  changedBy: string;
}

export interface UpdatePlanAnalyticsParams {
  planId: string;
  analyticsSections: string[];
  changedBy: string;
}

export interface UpdatePlanAnnouncementFeaturesParams {
  planId: string;
  announcementFeatures: string[];
  changedBy: string;
}

export interface UpdatePlanPricingParams {
  planId: string;
  priceMonthly: number;
  priceAnnual: number;
  changedBy: string;
}

export interface UpdatePlanLimitsParams {
  planId: string;
  emailLimit: number;
  smsEnabled: boolean;
  teamSizeLimit: number | null;
  changedBy: string;
}

export interface UpdatePlanMetadataParams {
  planId: string;
  displayName?: string;
  description?: string;
  stripeProductId?: string | null;
  stripePriceIdMonthly?: string | null;
  stripePriceIdAnnual?: string | null;
  changedBy: string;
}

export interface CreateAddonParams {
  name: string;
  displayName: string;
  description?: string;
  priceMonthly: number;
  priceAnnual: number;
  stripePriceIdMonthly?: string;
  stripePriceIdAnnual?: string;
}

export interface UpdateAddonParams {
  displayName?: string;
  description?: string;
  priceMonthly?: number;
  priceAnnual?: number;
  stripePriceIdMonthly?: string | null;
  stripePriceIdAnnual?: string | null;
  isActive?: boolean;
  tierConfig?: AddonTierConfig | null;
}

export interface AddonTier {
  id: string;
  name: string;
  runs_per_month: number;
  included_minutes?: number;
  hard_limit_minutes?: number;
  plan_code?: string;
  allow_overage?: boolean;
  overage_rate_cents?: number | null;
  features?: {
    missedAppointment?: boolean;
    reschedule?: boolean;
    quotedFollowup?: boolean;
    afterHoursInbound?: boolean;
  };
  price_monthly: number;
  price_annual: number;
  stripe_price_id_monthly?: string;
  stripe_price_id_annual?: string;
}

export interface AddonTierConfig {
  tiers: AddonTier[];
}

class AdminSubscriptionService {
  // ============================================
  // Plan Management
  // ============================================

  /**
   * Get all subscription plans (including inactive)
   */
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    return subscriptionRepo.findAllPlans();
  }

  /**
   * Get a specific plan by ID
   */
  async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    return subscriptionRepo.findPlanById(planId);
  }

  /**
   * Update plan features
   */
  async updatePlanFeatures(params: UpdatePlanFeaturesParams): Promise<void> {
    const { planId, features, changedBy } = params;

    try {
      // Get current plan for audit
      const currentPlan = await this.getPlanById(planId);
      if (!currentPlan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      // Update plan
      const { error: updateError } = await supabase
        .from("subscription_plans")
        .update({ features: features as unknown as Record<string, unknown> })
        .eq("id", planId);

      if (updateError) {
        logger.error(
          "AdminSubscriptionService.updatePlanFeatures",
          updateError,
        );
        throw updateError;
      }

      // Create audit entry
      await this.createPlanChangeAudit({
        planId,
        changedBy,
        changeType: "features",
        oldValue: currentPlan.features,
        newValue: features,
      });
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.updatePlanFeatures",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Update plan analytics sections
   */
  async updatePlanAnalytics(params: UpdatePlanAnalyticsParams): Promise<void> {
    const { planId, analyticsSections, changedBy } = params;

    try {
      // Get current plan for audit
      const currentPlan = await this.getPlanById(planId);
      if (!currentPlan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      // Update plan
      const { error: updateError } = await supabase
        .from("subscription_plans")
        .update({ analytics_sections: analyticsSections })
        .eq("id", planId);

      if (updateError) {
        logger.error(
          "AdminSubscriptionService.updatePlanAnalytics",
          updateError,
        );
        throw updateError;
      }

      // Create audit entry
      await this.createPlanChangeAudit({
        planId,
        changedBy,
        changeType: "analytics",
        oldValue: currentPlan.analytics_sections,
        newValue: analyticsSections,
      });
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.updatePlanAnalytics",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  async updatePlanAnnouncementFeatures(
    params: UpdatePlanAnnouncementFeaturesParams,
  ): Promise<void> {
    const { planId, announcementFeatures, changedBy } = params;

    try {
      const currentPlan = await this.getPlanById(planId);
      if (!currentPlan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const { error: updateError } = await supabase
        .from("subscription_plans")
        .update({ announcement_features: announcementFeatures })
        .eq("id", planId);

      if (updateError) {
        logger.error(
          "AdminSubscriptionService.updatePlanAnnouncementFeatures",
          updateError,
        );
        throw updateError;
      }

      await this.createPlanChangeAudit({
        planId,
        changedBy,
        changeType: "announcement_features",
        oldValue: currentPlan.announcement_features,
        newValue: announcementFeatures,
      });
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.updatePlanAnnouncementFeatures",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Update plan pricing
   */
  async updatePlanPricing(params: UpdatePlanPricingParams): Promise<void> {
    const { planId, priceMonthly, priceAnnual } = params;

    try {
      const { error } = await supabase.functions.invoke("update-plan-pricing", {
        body: { planId, priceMonthly, priceAnnual },
      });

      if (error) {
        logger.error("AdminSubscriptionService.updatePlanPricing", error);
        throw error;
      }
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.updatePlanPricing",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Update plan limits
   */
  async updatePlanLimits(params: UpdatePlanLimitsParams): Promise<void> {
    const { planId, emailLimit, smsEnabled, teamSizeLimit, changedBy } = params;

    try {
      // Get current plan for audit
      const currentPlan = await this.getPlanById(planId);
      if (!currentPlan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      // Update plan
      const { error: updateError } = await supabase
        .from("subscription_plans")
        .update({
          email_limit: emailLimit,
          sms_enabled: smsEnabled,
          team_size_limit: teamSizeLimit,
        })
        .eq("id", planId);

      if (updateError) {
        logger.error("AdminSubscriptionService.updatePlanLimits", updateError);
        throw updateError;
      }

      // Create audit entry
      await this.createPlanChangeAudit({
        planId,
        changedBy,
        changeType: "limits",
        oldValue: {
          email_limit: currentPlan.email_limit,
          sms_enabled: currentPlan.sms_enabled,
          team_size_limit: currentPlan.team_size_limit,
        },
        newValue: {
          email_limit: emailLimit,
          sms_enabled: smsEnabled,
          team_size_limit: teamSizeLimit,
        },
      });
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.updatePlanLimits",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Update plan metadata (name, description, Stripe Price IDs)
   */
  async updatePlanMetadata(params: UpdatePlanMetadataParams): Promise<void> {
    const { planId, changedBy, ...updates } = params;

    try {
      // Get current plan for audit
      const currentPlan = await this.getPlanById(planId);
      if (!currentPlan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      // Build update object
      const updateData: Record<string, unknown> = {};
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};

      if (updates.displayName !== undefined) {
        updateData.display_name = updates.displayName;
        oldValues.display_name = currentPlan.display_name;
        newValues.display_name = updates.displayName;
      }
      if (updates.description !== undefined) {
        updateData.description = updates.description;
        oldValues.description = currentPlan.description;
        newValues.description = updates.description;
      }
      if (updates.stripeProductId !== undefined) {
        updateData.stripe_product_id = updates.stripeProductId;
        oldValues.stripe_product_id = currentPlan.stripe_product_id;
        newValues.stripe_product_id = updates.stripeProductId;
      }
      if (updates.stripePriceIdMonthly !== undefined) {
        updateData.stripe_price_id_monthly = updates.stripePriceIdMonthly;
        oldValues.stripe_price_id_monthly = currentPlan.stripe_price_id_monthly;
        newValues.stripe_price_id_monthly = updates.stripePriceIdMonthly;
      }
      if (updates.stripePriceIdAnnual !== undefined) {
        updateData.stripe_price_id_annual = updates.stripePriceIdAnnual;
        oldValues.stripe_price_id_annual = currentPlan.stripe_price_id_annual;
        newValues.stripe_price_id_annual = updates.stripePriceIdAnnual;
      }

      if (Object.keys(updateData).length === 0) {
        return; // Nothing to update
      }

      // Update plan
      const { error: updateError } = await supabase
        .from("subscription_plans")
        .update(updateData)
        .eq("id", planId);

      if (updateError) {
        logger.error(
          "AdminSubscriptionService.updatePlanMetadata",
          updateError,
        );
        throw updateError;
      }

      // Create audit entry
      await this.createPlanChangeAudit({
        planId,
        changedBy,
        changeType: "metadata",
        oldValue: oldValues,
        newValue: newValues,
      });
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.updatePlanMetadata",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  // ============================================
  // Add-on Management
  // ============================================

  /**
   * Get all add-ons
   */
  async getAllAddons(): Promise<SubscriptionAddon[]> {
    try {
      const { data, error } = await supabase
        .from("subscription_addons")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) {
        logger.error("AdminSubscriptionService.getAllAddons", error);
        throw error;
      }

      return data || [];
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.getAllAddons",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get add-on by ID
   */
  async getAddonById(addonId: string): Promise<SubscriptionAddon | null> {
    try {
      const { data, error } = await supabase
        .from("subscription_addons")
        .select("*")
        .eq("id", addonId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        logger.error("AdminSubscriptionService.getAddonById", error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.getAddonById",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get add-on by name
   */
  async getAddonByName(name: string): Promise<SubscriptionAddon | null> {
    try {
      const { data, error } = await supabase
        .from("subscription_addons")
        .select("*")
        .eq("name", name)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        logger.error("AdminSubscriptionService.getAddonByName", error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.getAddonByName",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Create a new add-on
   */
  async createAddon(params: CreateAddonParams): Promise<SubscriptionAddon> {
    try {
      const { data, error } = await supabase
        .from("subscription_addons")
        .insert({
          name: params.name,
          display_name: params.displayName,
          description: params.description,
          price_monthly: params.priceMonthly,
          price_annual: params.priceAnnual,
          stripe_price_id_monthly: params.stripePriceIdMonthly,
          stripe_price_id_annual: params.stripePriceIdAnnual,
        })
        .select()
        .single();

      if (error) {
        logger.error("AdminSubscriptionService.createAddon", error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.createAddon",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Update an add-on
   */
  async updateAddon(
    addonId: string,
    params: UpdateAddonParams,
  ): Promise<SubscriptionAddon> {
    try {
      const updateData: Record<string, unknown> = {};

      if (params.displayName !== undefined)
        updateData.display_name = params.displayName;
      if (params.description !== undefined)
        updateData.description = params.description;
      if (params.priceMonthly !== undefined)
        updateData.price_monthly = params.priceMonthly;
      if (params.priceAnnual !== undefined)
        updateData.price_annual = params.priceAnnual;
      if (params.stripePriceIdMonthly !== undefined)
        updateData.stripe_price_id_monthly = params.stripePriceIdMonthly;
      if (params.stripePriceIdAnnual !== undefined)
        updateData.stripe_price_id_annual = params.stripePriceIdAnnual;
      if (params.isActive !== undefined) updateData.is_active = params.isActive;
      if (params.tierConfig !== undefined)
        updateData.tier_config = params.tierConfig;

      const { data, error } = await supabase
        .from("subscription_addons")
        .update(updateData)
        .eq("id", addonId)
        .select()
        .single();

      if (error) {
        logger.error("AdminSubscriptionService.updateAddon", error);
        throw error;
      }

      return data;
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.updateAddon",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  // ============================================
  // User Add-on Grants
  // ============================================

  /**
   * Grant an add-on to a user (manual grant by admin)
   */
  async grantAddonToUser(
    userId: string,
    addonId: string,
    grantedBy: string,
  ): Promise<void> {
    try {
      const { error } = await supabase.from("user_subscription_addons").upsert(
        {
          user_id: userId,
          addon_id: addonId,
          status: "manual_grant",
          granted_by: grantedBy,
        },
        {
          onConflict: "user_id,addon_id",
        },
      );

      if (error) {
        logger.error("AdminSubscriptionService.grantAddonToUser", error);
        throw error;
      }
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.grantAddonToUser",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Revoke an add-on from a user
   */
  async revokeAddonFromUser(userId: string, addonId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("user_subscription_addons")
        .delete()
        .eq("user_id", userId)
        .eq("addon_id", addonId);

      if (error) {
        logger.error("AdminSubscriptionService.revokeAddonFromUser", error);
        throw error;
      }
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.revokeAddonFromUser",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get all user add-ons (for admin view)
   */
  async getUserAddons(userId: string): Promise<UserSubscriptionAddon[]> {
    try {
      const { data, error } = await supabase
        .from("user_subscription_addons")
        .select(
          `
          *,
          addon:subscription_addons(*)
        `,
        )
        .eq("user_id", userId);

      if (error) {
        logger.error("AdminSubscriptionService.getUserAddons", error);
        throw error;
      }

      return (data || []).map((item) => ({
        ...item,
        addon: Array.isArray(item.addon) ? item.addon[0] : item.addon,
      }));
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.getUserAddons",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get all users with a specific add-on
   */
  async getUsersWithAddon(addonId: string): Promise<AddonUserSummary[]> {
    try {
      const { data, error } = await supabase
        .from("user_subscription_addons")
        .select(
          "id, user_id, status, granted_by, voice_sync_status, voice_last_sync_attempt_at, voice_last_synced_at, voice_last_sync_error, voice_entitlement_snapshot",
        )
        .eq("addon_id", addonId)
        .in("status", ["active", "manual_grant"]);

      if (error) {
        logger.error("AdminSubscriptionService.getUsersWithAddon", error);
        throw error;
      }

      const userAddons = data || [];
      if (userAddons.length === 0) {
        return [];
      }

      const userIds = userAddons.map((item) => item.user_id);

      const [
        { data: profiles, error: profilesError },
        { data: agents, error: agentsError },
      ] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("id, first_name, last_name, email")
          .in("id", userIds),
        supabase
          .from("chat_bot_agents")
          .select("user_id, external_agent_id")
          .in("user_id", userIds),
      ]);

      if (profilesError) {
        logger.error(
          "AdminSubscriptionService.getUsersWithAddon.profiles",
          profilesError,
        );
        throw profilesError;
      }

      if (agentsError) {
        logger.error(
          "AdminSubscriptionService.getUsersWithAddon.agents",
          agentsError,
        );
        throw agentsError;
      }

      const profilesById = new Map(
        (profiles || []).map((profile) => [profile.id, profile]),
      );
      const agentsByUserId = new Map(
        (agents || []).map((agent) => [agent.user_id, agent]),
      );

      return userAddons.map((item) => {
        const profile = profilesById.get(item.user_id);
        const agent = agentsByUserId.get(item.user_id);
        const fullName =
          `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
          profile?.email ||
          item.user_id;

        return {
          userId: item.user_id,
          status: item.status,
          grantedBy: item.granted_by,
          fullName,
          email: profile?.email || null,
          standardChatBotAgentId: agent?.external_agent_id || null,
          voiceSyncStatus: item.voice_sync_status || null,
          voiceLastSyncAttemptAt: item.voice_last_sync_attempt_at || null,
          voiceLastSyncedAt: item.voice_last_synced_at || null,
          voiceLastSyncError: item.voice_last_sync_error || null,
          voiceEntitlementSnapshot: item.voice_entitlement_snapshot,
        };
      });
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.getUsersWithAddon",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  // ============================================
  // Audit Trail
  // ============================================

  /**
   * Get plan change history
   */
  async getPlanChangeHistory(
    planId: string,
    limit: number = 50,
  ): Promise<SubscriptionPlanChange[]> {
    try {
      const { data, error } = await supabase
        .from("subscription_plan_changes")
        .select(
          `
          *,
          changer:user_profiles!subscription_plan_changes_changed_by_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `,
        )
        .eq("plan_id", planId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        logger.error("AdminSubscriptionService.getPlanChangeHistory", error);
        throw error;
      }

      return (data || []).map((item) => ({
        ...item,
        changer: Array.isArray(item.changer) ? item.changer[0] : item.changer,
      }));
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.getPlanChangeHistory",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Create a plan change audit entry
   */
  private async createPlanChangeAudit(params: {
    planId: string;
    changedBy: string;
    changeType: string;
    oldValue: unknown;
    newValue: unknown;
    notes?: string;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from("subscription_plan_changes")
        .insert({
          plan_id: params.planId,
          changed_by: params.changedBy,
          change_type: params.changeType,
          old_value: params.oldValue as Record<string, unknown>,
          new_value: params.newValue as Record<string, unknown>,
          notes: params.notes,
        });

      if (error) {
        // Log but don't throw - audit failures shouldn't block operations
        logger.error("AdminSubscriptionService.createPlanChangeAudit", error);
      }
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.createPlanChangeAudit",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  // ============================================
  // Plan CRUD Operations
  // ============================================

  /**
   * Create a new subscription plan
   */
  async createPlan(params: {
    name: string;
    displayName: string;
    description?: string;
    priceMonthly: number;
    priceAnnual: number;
    sortOrder: number;
  }): Promise<SubscriptionPlan> {
    try {
      // Default features (all off for new plan)
      const defaultFeatures: SubscriptionFeatures = {
        dashboard: false,
        analytics: false,
        policies: false,
        comp_guide: false,
        settings: false,
        connect_upline: false,
        expenses: false,
        targets_basic: false,
        targets_full: false,
        reports_view: false,
        reports_export: false,
        // Messaging features
        email: false,
        sms: false,
        slack: false,
        instagram_messaging: false,
        instagram_scheduled_messages: false,
        instagram_templates: false,
        // Team features
        hierarchy: false,
        team_analytics: false,
        recruiting: false,
        overrides: false,
        leaderboard: false,
        downline_reports: false,
        // Training features
        training: false,
        // Premium branding features
        recruiting_basic: false,
        recruiting_custom_pipeline: false,
        custom_branding: false,
        // Tools features
        business_tools: false,
        // CRM KPI Dashboard
        close_kpi: false,
      };

      const { data, error } = await supabase
        .from("subscription_plans")
        .insert({
          name: params.name,
          display_name: params.displayName,
          description: params.description || null,
          price_monthly: params.priceMonthly,
          price_annual: params.priceAnnual,
          sort_order: params.sortOrder,
          features: defaultFeatures as unknown as Record<string, unknown>,
          analytics_sections: [],
          email_limit: 0,
          sms_enabled: false,
          team_size_limit: null,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        logger.error("AdminSubscriptionService.createPlan", error);
        throw error;
      }

      return subscriptionRepo.transformPlan(data);
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.createPlan",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Toggle plan active status
   */
  async togglePlanActive(
    planId: string,
    isActive: boolean,
    changedBy: string,
  ): Promise<void> {
    try {
      // Get current plan for audit
      const currentPlan = await this.getPlanById(planId);
      if (!currentPlan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const { error } = await supabase
        .from("subscription_plans")
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId);

      if (error) {
        logger.error("AdminSubscriptionService.togglePlanActive", error);
        throw error;
      }

      // Create audit record
      await this.createPlanChangeAudit({
        planId,
        changedBy,
        changeType: "metadata",
        oldValue: { is_active: currentPlan.is_active },
        newValue: { is_active: isActive },
        notes: isActive ? "Plan activated" : "Plan deactivated",
      });
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.togglePlanActive",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  // ============================================
  // User Plan Management (Testing)
  // ============================================

  /**
   * Change a user's subscription plan (for testing purposes)
   * This allows admins to switch users between tiers to test feature gating
   */
  async changeUserPlan(params: {
    userId: string;
    planId: string;
    changedBy: string;
    reason?: string;
  }): Promise<void> {
    const { userId, planId, changedBy, reason } = params;

    try {
      // Get current subscription for audit
      const { data: currentSub, error: fetchError } = await supabase
        .from("user_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("user_id", userId)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        logger.error(
          "AdminSubscriptionService.changeUserPlan - fetch",
          fetchError,
        );
        throw fetchError;
      }

      // Validate the new plan exists
      const newPlan = await this.getPlanById(planId);
      if (!newPlan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      if (currentSub) {
        // Update existing subscription
        const { error: updateError } = await supabase
          .from("user_subscriptions")
          .update({
            plan_id: planId,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (updateError) {
          logger.error(
            "AdminSubscriptionService.changeUserPlan - update",
            updateError,
          );
          throw updateError;
        }

        // Create audit entry
        await this.createPlanChangeAudit({
          planId,
          changedBy,
          changeType: "user_plan_change",
          oldValue: {
            user_id: userId,
            old_plan_id: currentSub.plan_id,
            old_plan_name: (currentSub.plan as SubscriptionPlanRow)
              ?.display_name,
          },
          newValue: {
            user_id: userId,
            new_plan_id: planId,
            new_plan_name: newPlan.display_name,
          },
          notes: reason || "Admin changed user plan for testing",
        });
      } else {
        // Create new subscription for user
        const { error: insertError } = await supabase
          .from("user_subscriptions")
          .insert({
            user_id: userId,
            plan_id: planId,
            status: "active",
            billing_interval: "monthly",
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          });

        if (insertError) {
          logger.error(
            "AdminSubscriptionService.changeUserPlan - insert",
            insertError,
          );
          throw insertError;
        }

        // Create audit entry
        await this.createPlanChangeAudit({
          planId,
          changedBy,
          changeType: "user_plan_change",
          oldValue: {
            user_id: userId,
            old_plan_id: null,
            old_plan_name: "No subscription",
          },
          newValue: {
            user_id: userId,
            new_plan_id: planId,
            new_plan_name: newPlan.display_name,
          },
          notes: reason || "Admin assigned plan to user for testing",
        });
      }

      logger.info("AdminSubscriptionService.changeUserPlan", {
        userId,
        newPlanId: planId,
        newPlanName: newPlan.display_name,
        changedBy,
      });
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.changeUserPlan",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Get a user's current subscription with plan details
   */
  async getUserSubscription(userId: string): Promise<{
    subscription:
      | Database["public"]["Tables"]["user_subscriptions"]["Row"]
      | null;
    plan: SubscriptionPlan | null;
  }> {
    try {
      const { data, error } = await supabase
        .from("user_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { subscription: null, plan: null };
        }
        logger.error("AdminSubscriptionService.getUserSubscription", error);
        throw error;
      }

      const planData = data.plan as SubscriptionPlanRow | null;

      return {
        subscription: data,
        plan: planData ? subscriptionRepo.transformPlan(planData) : null,
      };
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.getUserSubscription",
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  // ============================================
  // Access Checks
  // ============================================

  /**
   * Check if a user has UW Wizard access via add-on purchase
   */
  async checkUwWizardAccess(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc("user_has_uw_wizard_access", {
        p_user_id: userId,
      });

      if (error) {
        logger.error("AdminSubscriptionService.checkUwWizardAccess", error);
        return false;
      }

      return data === true;
    } catch (error) {
      logger.error(
        "AdminSubscriptionService.checkUwWizardAccess",
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }

  /**
   * Invoke the setup-addon-stripe-products edge function to auto-create
   * Stripe product + prices for a given addon's tiers.
   */
  async setupAddonStripeProducts(addonName: string): Promise<{
    results: Array<{
      tierId: string;
      monthlyPriceId?: string;
      annualPriceId?: string;
    }>;
  }> {
    const { data, error } = await supabase.functions.invoke(
      "setup-addon-stripe-products",
      { body: { addonName } },
    );

    if (error) {
      throw new Error(`Stripe setup failed: ${error.message}`);
    }

    return data as {
      results: Array<{
        tierId: string;
        monthlyPriceId?: string;
        annualPriceId?: string;
      }>;
    };
  }
}

export const adminSubscriptionService = new AdminSubscriptionService();
