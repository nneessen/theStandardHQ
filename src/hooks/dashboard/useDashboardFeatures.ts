// src/hooks/dashboard/useDashboardFeatures.ts
// Hook to determine which dashboard features are available based on subscription tier

import { useMemo } from "react";
import {
  useSubscription,
  useOwnerDownlineAccess,
  useImoAllFeaturesAccess,
  isOwnerDownlineGrantedFeature,
} from "@/hooks/subscription";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/contexts/ImoContext";

export interface DashboardFeatures {
  // Expense-related features (Pro+)
  canViewExpenses: boolean;
  canAddExpense: boolean;

  // Reports features (Pro+)
  canViewReports: boolean;
  canExportReports: boolean; // Pro+

  // Target features
  canViewBasicTargets: boolean; // Pro+
  canViewFullTargets: boolean; // Pro+

  // Tier info (3-tier system: Free, Pro, Team)
  tier: "free" | "pro" | "team";
  isLoading: boolean;
  isAdmin: boolean;

  // Organization roles (Phase 5)
  isImoAdmin: boolean;
  isAgencyOwner: boolean;
}

/**
 * Hook to determine which dashboard features are available for the current user
 *
 * Feature access by tier (3-tier system):
 * - Free: Basic dashboard (no expenses, no reports, no targets)
 * - Pro: + expenses, reports_view, reports_export, targets_basic, targets_full
 * - Team: Same as Pro for dashboard, plus team management features
 *
 * Direct downlines of owners get Team-tier features
 */
export function useDashboardFeatures(): DashboardFeatures {
  const { subscription, isLoading, isActive } = useSubscription();
  const {
    grantsAllFeatures: imoGrantsAllFeatures,
    isLoading: imoEntitlementLoading,
  } = useImoAllFeaturesAccess();
  const { supabaseUser } = useAuth();
  const { isDirectDownlineOfOwner, isLoading: downlineLoading } =
    useOwnerDownlineAccess();
  const {
    isImoAdmin: imoAdminFlag,
    isAgencyOwner: agencyOwnerFlag,
    isSuperAdmin,
  } = useImo();

  return useMemo(() => {
    // Check if user is super admin (bypasses ALL gating)
    const isSuperAdminUser = isSuperAdmin;

    // Organization roles from ImoContext
    const isImoAdmin = isSuperAdminUser || imoAdminFlag;
    const isAgencyOwner = agencyOwnerFlag;

    // Super admin bypass - full access to all features
    if (isSuperAdminUser) {
      return {
        canViewExpenses: true,
        canAddExpense: true,
        canViewReports: true,
        canExportReports: true,
        canViewBasicTargets: true,
        canViewFullTargets: true,
        tier: "team" as const,
        isLoading: false,
        isAdmin: true,
        isImoAdmin: true,
        isAgencyOwner: false,
      };
    }

    if (imoGrantsAllFeatures) {
      return {
        canViewExpenses: true,
        canAddExpense: true,
        canViewReports: true,
        canExportReports: true,
        canViewBasicTargets: true,
        canViewFullTargets: true,
        tier: "team" as const,
        isLoading: false,
        isAdmin: false,
        isImoAdmin,
        isAgencyOwner,
      };
    }

    // Still loading subscription or downline data
    if (isLoading || imoEntitlementLoading || downlineLoading) {
      return {
        canViewExpenses: false,
        canAddExpense: false,
        canViewReports: false,
        canExportReports: false,
        canViewBasicTargets: false,
        canViewFullTargets: false,
        tier: "free" as const,
        isLoading: true,
        isAdmin: false,
        isImoAdmin: false,
        isAgencyOwner: false,
      };
    }

    // Helper to check feature access (subscription OR owner downline)
    const hasFeature = (feature: string): boolean => {
      // Check subscription plan - ONLY if subscription is active
      if (
        isActive &&
        subscription?.plan?.features?.[
          feature as keyof typeof subscription.plan.features
        ]
      ) {
        return true;
      }
      // Check owner downline access
      if (isDirectDownlineOfOwner && isOwnerDownlineGrantedFeature(feature)) {
        return true;
      }
      return false;
    };

    // Get plan name for tier display (3-tier system: free, pro, team)
    const planName = subscription?.plan?.name?.toLowerCase() || "free";
    const baseTier = (
      ["free", "pro", "team"].includes(planName) ? planName : "free"
    ) as "free" | "pro" | "team";

    // If direct downline of owner, treat as team tier
    const tier = isDirectDownlineOfOwner ? "team" : baseTier;

    return {
      // Expense features require 'expenses' feature flag
      canViewExpenses: hasFeature("expenses"),
      canAddExpense: hasFeature("expenses"),

      // Report features
      canViewReports: hasFeature("reports_view"),
      canExportReports: hasFeature("reports_export"),

      // Target features
      canViewBasicTargets: hasFeature("targets_basic"),
      canViewFullTargets: hasFeature("targets_full"),

      tier,
      isLoading: false,
      isAdmin: false,

      // Organization roles
      isImoAdmin,
      isAgencyOwner,
    };
  }, [
    subscription,
    isLoading,
    imoGrantsAllFeatures,
    imoEntitlementLoading,
    isActive,
    downlineLoading,
    isDirectDownlineOfOwner,
    supabaseUser?.email,
    imoAdminFlag,
    agencyOwnerFlag,
    isSuperAdmin,
  ]);
}
