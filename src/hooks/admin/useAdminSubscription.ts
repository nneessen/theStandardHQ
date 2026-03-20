// src/hooks/admin/useAdminSubscription.ts
// Hooks for admin subscription management

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminSubscriptionService,
  type AdminSubscriptionPlan as SubscriptionPlan,
  type SubscriptionAddon,
  type SubscriptionPlanChange,
  type UserSubscriptionAddon,
  type AddonUserSummary,
  type UpdatePlanFeaturesParams,
  type UpdatePlanAnalyticsParams,
  type UpdatePlanPricingParams,
  type UpdatePlanLimitsParams,
  type UpdatePlanMetadataParams,
  type CreateAddonParams,
  type UpdateAddonParams,
  type SubscriptionFeatures,
  type AddonTier,
  type AddonTierConfig,
} from "@/services/subscription";
import { useAuth } from "@/contexts/AuthContext";

// Re-export types for UI components to use (they can't import directly from services)
export type {
  SubscriptionPlan,
  SubscriptionAddon,
  SubscriptionPlanChange,
  UserSubscriptionAddon,
  AddonUserSummary,
  SubscriptionFeatures,
  AddonTier,
  AddonTierConfig,
};

// ============================================
// Query Keys
// ============================================

export const adminSubscriptionKeys = {
  all: ["admin", "subscription"] as const,
  plans: () => [...adminSubscriptionKeys.all, "plans"] as const,
  plan: (id: string) => [...adminSubscriptionKeys.plans(), id] as const,
  planHistory: (id: string) =>
    [...adminSubscriptionKeys.plan(id), "history"] as const,
  addons: () => [...adminSubscriptionKeys.all, "addons"] as const,
  addon: (id: string) => [...adminSubscriptionKeys.addons(), id] as const,
  addonUsers: (id: string) =>
    [...adminSubscriptionKeys.addon(id), "users"] as const,
  userAddons: (userId: string) =>
    [...adminSubscriptionKeys.all, "user", userId, "addons"] as const,
};

// ============================================
// Query Hooks
// ============================================

/**
 * Get all subscription plans (including inactive)
 */
export function useAdminSubscriptionPlans() {
  return useQuery<SubscriptionPlan[], Error>({
    queryKey: adminSubscriptionKeys.plans(),
    queryFn: () => adminSubscriptionService.getAllPlans(),
  });
}

/**
 * Get a specific subscription plan by ID
 */
export function useAdminSubscriptionPlan(planId: string) {
  return useQuery<SubscriptionPlan | null, Error>({
    queryKey: adminSubscriptionKeys.plan(planId),
    queryFn: () => adminSubscriptionService.getPlanById(planId),
    enabled: !!planId,
  });
}

/**
 * Get plan change history
 */
export function usePlanChangeHistory(planId: string, limit = 50) {
  return useQuery<SubscriptionPlanChange[], Error>({
    queryKey: adminSubscriptionKeys.planHistory(planId),
    queryFn: () => adminSubscriptionService.getPlanChangeHistory(planId, limit),
    enabled: !!planId,
  });
}

/**
 * Get all add-ons
 */
export function useAdminSubscriptionAddons() {
  return useQuery<SubscriptionAddon[], Error>({
    queryKey: adminSubscriptionKeys.addons(),
    queryFn: () => adminSubscriptionService.getAllAddons(),
  });
}

/**
 * Get a specific add-on by ID
 */
export function useAdminSubscriptionAddon(addonId: string) {
  return useQuery<SubscriptionAddon | null, Error>({
    queryKey: adminSubscriptionKeys.addon(addonId),
    queryFn: () => adminSubscriptionService.getAddonById(addonId),
    enabled: !!addonId,
  });
}

/**
 * Get users with a specific add-on
 */
export function useAddonUsers(addonId: string) {
  return useQuery<AddonUserSummary[], Error>({
    queryKey: adminSubscriptionKeys.addonUsers(addonId),
    queryFn: () => adminSubscriptionService.getUsersWithAddon(addonId),
    enabled: !!addonId,
  });
}

/**
 * Get add-ons for a specific user
 */
export function useUserAddons(userId: string) {
  return useQuery<UserSubscriptionAddon[], Error>({
    queryKey: adminSubscriptionKeys.userAddons(userId),
    queryFn: () => adminSubscriptionService.getUserAddons(userId),
    enabled: !!userId,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Update plan features
 */
export function useUpdatePlanFeatures() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, Omit<UpdatePlanFeaturesParams, "changedBy">>({
    mutationFn: async (params) => {
      if (!user?.id) throw new Error("User not authenticated");
      return adminSubscriptionService.updatePlanFeatures({
        ...params,
        changedBy: user.id,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate admin queries first (so admin panel shows fresh data)
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plans(),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plan(variables.planId),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.planHistory(variables.planId),
      });
      // Also invalidate user subscription data as features may have changed
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Plan features updated");
    },
    onError: (error) => {
      toast.error(`Failed to update features: ${error.message}`);
    },
  });
}

/**
 * Update plan analytics sections
 */
export function useUpdatePlanAnalytics() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, Omit<UpdatePlanAnalyticsParams, "changedBy">>(
    {
      mutationFn: async (params) => {
        if (!user?.id) throw new Error("User not authenticated");
        return adminSubscriptionService.updatePlanAnalytics({
          ...params,
          changedBy: user.id,
        });
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({
          queryKey: adminSubscriptionKeys.plans(),
        });
        queryClient.invalidateQueries({
          queryKey: adminSubscriptionKeys.plan(variables.planId),
        });
        queryClient.invalidateQueries({
          queryKey: adminSubscriptionKeys.planHistory(variables.planId),
        });
        queryClient.invalidateQueries({ queryKey: ["subscription"] });
        toast.success("Plan analytics updated");
      },
      onError: (error) => {
        toast.error(`Failed to update analytics: ${error.message}`);
      },
    },
  );
}

export function useUpdatePlanAnnouncementFeatures() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    void,
    Error,
    { planId: string; announcementFeatures: string[] }
  >({
    mutationFn: async (params) => {
      if (!user?.id) throw new Error("User not authenticated");
      return adminSubscriptionService.updatePlanAnnouncementFeatures({
        ...params,
        changedBy: user.id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plans(),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plan(variables.planId),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.planHistory(variables.planId),
      });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Announcement features updated");
    },
    onError: (error) => {
      toast.error(`Failed to update announcement features: ${error.message}`);
    },
  });
}

/**
 * Update plan pricing
 */
export function useUpdatePlanPricing() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, Omit<UpdatePlanPricingParams, "changedBy">>({
    mutationFn: async (params) => {
      if (!user?.id) throw new Error("User not authenticated");
      return adminSubscriptionService.updatePlanPricing({
        ...params,
        changedBy: user.id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plans(),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plan(variables.planId),
      });
      toast.success("Plan pricing updated");
    },
    onError: (error) => {
      toast.error(`Failed to update pricing: ${error.message}`);
    },
  });
}

/**
 * Update plan limits
 */
export function useUpdatePlanLimits() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, Omit<UpdatePlanLimitsParams, "changedBy">>({
    mutationFn: async (params) => {
      if (!user?.id) throw new Error("User not authenticated");
      return adminSubscriptionService.updatePlanLimits({
        ...params,
        changedBy: user.id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plans(),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plan(variables.planId),
      });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Plan limits updated");
    },
    onError: (error) => {
      toast.error(`Failed to update limits: ${error.message}`);
    },
  });
}

/**
 * Update plan metadata
 */
export function useUpdatePlanMetadata() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, Omit<UpdatePlanMetadataParams, "changedBy">>({
    mutationFn: async (params) => {
      if (!user?.id) throw new Error("User not authenticated");
      return adminSubscriptionService.updatePlanMetadata({
        ...params,
        changedBy: user.id,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plans(),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plan(variables.planId),
      });
      toast.success("Plan metadata updated");
    },
    onError: (error) => {
      toast.error(`Failed to update metadata: ${error.message}`);
    },
  });
}

/**
 * Create a new add-on
 */
export function useCreateAddon() {
  const queryClient = useQueryClient();

  return useMutation<SubscriptionAddon, Error, CreateAddonParams>({
    mutationFn: (params) => adminSubscriptionService.createAddon(params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.addons(),
      });
      toast.success("Add-on created");
    },
    onError: (error) => {
      toast.error(`Failed to create add-on: ${error.message}`);
    },
  });
}

/**
 * Update an add-on
 */
export function useUpdateAddon() {
  const queryClient = useQueryClient();

  return useMutation<
    SubscriptionAddon,
    Error,
    { addonId: string; params: UpdateAddonParams }
  >({
    mutationFn: ({ addonId, params }) =>
      adminSubscriptionService.updateAddon(addonId, params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.addons(),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.addon(variables.addonId),
      });
      toast.success("Add-on updated");
    },
    onError: (error) => {
      toast.error(`Failed to update add-on: ${error.message}`);
    },
  });
}

/**
 * Grant an add-on to a user
 */
export function useGrantAddonToUser() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, { userId: string; addonId: string }>({
    mutationFn: async ({ userId, addonId }) => {
      if (!user?.id) throw new Error("User not authenticated");
      return adminSubscriptionService.grantAddonToUser(
        userId,
        addonId,
        user.id,
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.addonUsers(variables.addonId),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.userAddons(variables.userId),
      });
      toast.success("Add-on granted to user");
    },
    onError: (error) => {
      toast.error(`Failed to grant add-on: ${error.message}`);
    },
  });
}

/**
 * Revoke an add-on from a user
 */
export function useRevokeAddonFromUser() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { userId: string; addonId: string }>({
    mutationFn: ({ userId, addonId }) =>
      adminSubscriptionService.revokeAddonFromUser(userId, addonId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.addonUsers(variables.addonId),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.userAddons(variables.userId),
      });
      toast.success("Add-on revoked from user");
    },
    onError: (error) => {
      toast.error(`Failed to revoke add-on: ${error.message}`);
    },
  });
}

// ============================================
// Plan CRUD Mutations
// ============================================

export interface CreatePlanParams {
  name: string;
  displayName: string;
  description?: string;
  priceMonthly: number;
  priceAnnual: number;
  sortOrder: number;
}

/**
 * Create a new subscription plan
 */
export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation<SubscriptionPlan, Error, CreatePlanParams>({
    mutationFn: (params) => adminSubscriptionService.createPlan(params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plans(),
      });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success("Plan created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create plan: ${error.message}`);
    },
  });
}

/**
 * Toggle plan active status
 */
export function useTogglePlanActive() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<void, Error, { planId: string; isActive: boolean }>({
    mutationFn: async ({ planId, isActive }) => {
      if (!user?.id) throw new Error("User not authenticated");
      return adminSubscriptionService.togglePlanActive(
        planId,
        isActive,
        user.id,
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plans(),
      });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plan(variables.planId),
      });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      toast.success(variables.isActive ? "Plan activated" : "Plan deactivated");
    },
    onError: (error) => {
      toast.error(`Failed to toggle plan: ${error.message}`);
    },
  });
}

// ============================================
// User Plan Testing
// ============================================

/**
 * Change a user's subscription plan (for testing tier feature gating)
 */
export function useChangeUserPlan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<
    void,
    Error,
    { userId: string; planId: string; reason?: string }
  >({
    mutationFn: async ({ userId, planId, reason }) => {
      if (!user?.id) throw new Error("User not authenticated");
      return adminSubscriptionService.changeUserPlan({
        userId,
        planId,
        changedBy: user.id,
        reason,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate all subscription-related queries
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({
        queryKey: adminSubscriptionKeys.plans(),
      });
      queryClient.invalidateQueries({
        queryKey: ["user-subscription", variables.userId],
      });
      toast.success("User plan changed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to change plan: ${error.message}`);
    },
  });
}

/**
 * Get a user's current subscription (for admin testing view)
 */
export function useUserSubscriptionAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-subscription", userId],
    queryFn: () => {
      if (!userId) return Promise.resolve({ subscription: null, plan: null });
      return adminSubscriptionService.getUserSubscription(userId);
    },
    enabled: !!userId,
  });
}

// ============================================
// Access Check Hooks
// ============================================

/**
 * Check if a user has UW Wizard access via add-on purchase
 */
export function useUwWizardAddonAccess(userId: string | undefined) {
  return useQuery<boolean, Error>({
    queryKey: ["user-addon", userId, "uw_wizard"],
    queryFn: () => {
      if (!userId) return Promise.resolve(false);
      return adminSubscriptionService.checkUwWizardAccess(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
