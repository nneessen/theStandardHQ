// src/hooks/subscription/useAnalyticsSectionAccess.ts
// Hook for checking analytics section access based on subscription tier
// NOTE: Temporary access controls PAGE access (nav visibility), not section access.
// Individual section access is ALWAYS controlled by the plan's analytics_sections array.

import { useMemo } from "react";
import { useSubscription } from "./useSubscription";
import { useOwnerDownlineAccess } from "./useOwnerDownlineAccess";
import { useImoAllFeaturesAccess } from "./useImoAllFeaturesAccess";
import { useImo } from "@/contexts/ImoContext";

// Analytics section identifiers that match database analytics_sections array
export type AnalyticsSectionKey =
  | "pace_metrics"
  | "policy_status_breakdown"
  | "product_matrix"
  | "carriers_products"
  | "geographic"
  | "client_segmentation"
  | "game_plan"
  | "commission_pipeline"
  | "predictive_analytics"
  | "agent_performance"
  | "trend_comparison"
  | "conversion_funnel";

// Map sections to user-friendly names
export const ANALYTICS_SECTION_NAMES: Record<AnalyticsSectionKey, string> = {
  pace_metrics: "Pace Metrics",
  policy_status_breakdown: "Policy Status Breakdown",
  product_matrix: "Product Matrix",
  carriers_products: "Carriers & Products",
  geographic: "Geographic Analysis",
  client_segmentation: "Client Segmentation",
  game_plan: "Game Plan",
  commission_pipeline: "Commission Pipeline",
  predictive_analytics: "Predictive Analytics",
  agent_performance: "Agent Performance",
  trend_comparison: "Trend Comparison",
  conversion_funnel: "Conversion Funnel",
};

// Map sections to minimum required tier for display purposes (3-tier system)
export const ANALYTICS_SECTION_TIERS: Record<AnalyticsSectionKey, string> = {
  pace_metrics: "Pro",
  carriers_products: "Pro",
  product_matrix: "Pro",
  policy_status_breakdown: "Pro",
  geographic: "Pro",
  client_segmentation: "Pro",
  game_plan: "Pro",
  commission_pipeline: "Pro",
  predictive_analytics: "Pro",
  agent_performance: "Pro",
  trend_comparison: "Pro",
  conversion_funnel: "Pro",
};

export interface UseAnalyticsSectionAccessResult {
  hasAccess: boolean;
  isLoading: boolean;
  currentPlan: string;
  requiredPlan: string;
  sectionName: string;
}

/**
 * Hook to check if the current user has access to a specific analytics section
 * based on their subscription plan.
 *
 * Direct downlines of owners get access to ALL analytics sections.
 *
 * @param section - The analytics section key to check access for
 * @returns Section access status and related metadata
 *
 * @example
 * const { hasAccess, requiredPlan } = useAnalyticsSectionAccess("game_plan");
 * if (!hasAccess) {
 *   return <UpgradePrompt requiredPlan={requiredPlan} />;
 * }
 */
export function useAnalyticsSectionAccess(
  section: AnalyticsSectionKey,
): UseAnalyticsSectionAccessResult {
  const { subscription, isLoading, tierName } = useSubscription();
  const {
    grantsAllFeatures: imoGrantsAllFeatures,
    isLoading: imoEntitlementLoading,
  } = useImoAllFeaturesAccess();
  const { isDirectDownlineOfOwner, isLoading: downlineLoading } =
    useOwnerDownlineAccess();

  // Check if user is super admin (bypasses ALL feature gating)
  const { isSuperAdmin } = useImo();
  const isSuperAdminUser = isSuperAdmin;

  return useMemo(() => {
    // Super admin bypass - immediate access, no loading wait
    if (isSuperAdminUser) {
      return {
        hasAccess: true,
        isLoading: false,
        currentPlan: "Super Admin",
        requiredPlan: ANALYTICS_SECTION_TIERS[section],
        sectionName: ANALYTICS_SECTION_NAMES[section],
      };
    }

    if (isLoading || imoEntitlementLoading || downlineLoading) {
      return {
        hasAccess: false,
        isLoading: true,
        currentPlan: "Loading...",
        requiredPlan: ANALYTICS_SECTION_TIERS[section],
        sectionName: ANALYTICS_SECTION_NAMES[section],
      };
    }

    if (imoGrantsAllFeatures) {
      return {
        hasAccess: true,
        isLoading: false,
        currentPlan: "IMO Access",
        requiredPlan: ANALYTICS_SECTION_TIERS[section],
        sectionName: ANALYTICS_SECTION_NAMES[section],
      };
    }

    // Direct downlines of owner get access to ALL analytics sections
    if (isDirectDownlineOfOwner) {
      return {
        hasAccess: true,
        isLoading: false,
        currentPlan: "Team (via upline)",
        requiredPlan: ANALYTICS_SECTION_TIERS[section],
        sectionName: ANALYTICS_SECTION_NAMES[section],
      };
    }

    // Section access is ALWAYS controlled by the plan's analytics_sections array
    // Temporary access only controls PAGE visibility (handled by sidebar/nav gating)
    const analyticsSections = subscription?.plan?.analytics_sections || [];
    const hasAccess = analyticsSections.includes(section);

    return {
      hasAccess,
      isLoading: false,
      currentPlan: tierName,
      requiredPlan: ANALYTICS_SECTION_TIERS[section],
      sectionName: ANALYTICS_SECTION_NAMES[section],
    };
  }, [
    subscription,
    isLoading,
    imoEntitlementLoading,
    downlineLoading,
    isDirectDownlineOfOwner,
    isSuperAdminUser,
    imoGrantsAllFeatures,
    section,
    tierName,
  ]);
}

/**
 * Hook to get all accessible analytics sections for the current user.
 *
 * Direct downlines of owners get access to ALL analytics sections.
 *
 * @returns Object with accessible sections array and loading state
 */
export function useAccessibleAnalyticsSections(): {
  accessibleSections: AnalyticsSectionKey[];
  lockedSections: AnalyticsSectionKey[];
  isLoading: boolean;
  tierName: string;
} {
  const { subscription, isLoading, tierName } = useSubscription();
  const {
    grantsAllFeatures: imoGrantsAllFeatures,
    isLoading: imoEntitlementLoading,
  } = useImoAllFeaturesAccess();
  const { isDirectDownlineOfOwner, isLoading: downlineLoading } =
    useOwnerDownlineAccess();

  // Check if user is super admin (bypasses ALL feature gating)
  const { isSuperAdmin } = useImo();
  const isSuperAdminUser = isSuperAdmin;

  return useMemo(() => {
    const allSections: AnalyticsSectionKey[] = [
      "pace_metrics",
      "policy_status_breakdown",
      "product_matrix",
      "carriers_products",
      "geographic",
      "client_segmentation",
      "game_plan",
      "commission_pipeline",
      "predictive_analytics",
      "agent_performance",
      "trend_comparison",
      "conversion_funnel",
    ];

    // Super admin bypass - immediate access to all sections
    if (isSuperAdminUser) {
      return {
        accessibleSections: allSections,
        lockedSections: [],
        isLoading: false,
        tierName: "Super Admin",
      };
    }

    if (isLoading || imoEntitlementLoading || downlineLoading) {
      return {
        accessibleSections: [],
        lockedSections: allSections,
        isLoading: true,
        tierName: "Loading...",
      };
    }

    if (imoGrantsAllFeatures) {
      return {
        accessibleSections: allSections,
        lockedSections: [],
        isLoading: false,
        tierName: "IMO Access",
      };
    }

    // Direct downlines of owner get access to ALL analytics sections
    if (isDirectDownlineOfOwner) {
      return {
        accessibleSections: allSections,
        lockedSections: [],
        isLoading: false,
        tierName: "Team (via upline)",
      };
    }

    // Section access is ALWAYS controlled by the plan's analytics_sections array
    const analyticsSections = (subscription?.plan?.analytics_sections ||
      []) as AnalyticsSectionKey[];

    const accessibleSections = allSections.filter((s) =>
      analyticsSections.includes(s),
    );
    const lockedSections = allSections.filter(
      (s) => !analyticsSections.includes(s),
    );

    return {
      accessibleSections,
      lockedSections,
      isLoading: false,
      tierName,
    };
  }, [
    subscription,
    isLoading,
    imoEntitlementLoading,
    downlineLoading,
    isDirectDownlineOfOwner,
    isSuperAdminUser,
    imoGrantsAllFeatures,
    tierName,
  ]);
}
