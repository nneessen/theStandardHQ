// src/hooks/navigation/useSidebarNavigation.ts
// UI-layer hook that resolves sidebar visibility/locked state from canonical access primitives.

import { useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useImo } from "@/hooks/imo";
import { useAuthorizationStatus } from "@/hooks/admin";
import { usePermissionCheck } from "@/hooks/permissions";
import {
  useSubscription,
  type FeatureKey,
  useImoAllFeaturesAccess,
  useOwnerDownlineAccess,
  isOwnerDownlineGrantedFeature,
  useTemporaryAccessCheck,
  useAiAccess,
} from "@/hooks/subscription";
import {
  useUnderwritingFeatureFlag,
  useCanManageUnderwriting,
} from "@/features/underwriting";
import { useLicensingWorkspaceAccess } from "@/features/the-standard-team";
import { isStaffOnlyUser } from "@/constants/roles";
import {
  footerSidebarItems,
  recruitSidebarGroups,
  regularSidebarGroups,
  staffSidebarGroups,
} from "@/components/layout/sidebar/sidebar-nav.config";
import type {
  ResolvedSidebarNavigationGroup,
  ResolvedSidebarNavigationItem,
  SidebarNavigationGroup,
  SidebarNavigationItem,
  SidebarNavigationVariant,
} from "@/components/layout/sidebar/types";

interface UseSidebarNavigationResult {
  footerItems: ResolvedSidebarNavigationItem[];
  isAdmin: boolean;
  isPending: boolean;
  isRecruit: boolean;
  isSuperAdmin: boolean;
  variant: SidebarNavigationVariant;
  visibleGroups: ResolvedSidebarNavigationGroup[];
}

function hasAnyFeatureAccess(
  features: FeatureKey[] | undefined,
  hasFeature: (feature: FeatureKey | undefined) => boolean,
): boolean {
  if (!features || features.length === 0) return true;
  return features.some((feature) => hasFeature(feature));
}

export function useSidebarNavigation(): UseSidebarNavigationResult {
  const { supabaseUser } = useAuth();
  const { agency, isSuperAdmin: isSuperAdminFromImo } = useImo();
  const { can, isAdmin: hasAdminRole, roles, isLoading } = usePermissionCheck();
  const {
    isPending,
    isAdmin: isAdminFromProfile,
    isSuperAdmin: isSuperAdminFromProfile,
  } = useAuthorizationStatus();
  const {
    subscription,
    isLoading: subLoading,
    isActive: isSubscriptionActive,
    hasManageableSubscription,
  } = useSubscription();
  const {
    grantsAllFeatures: imoGrantsAllFeatures,
    isLoading: imoEntitlementLoading,
  } = useImoAllFeaturesAccess();
  const { isDirectDownlineOfOwner, isLoading: downlineLoading } =
    useOwnerDownlineAccess();
  const { hasAiAccess, isLoading: aiAccessLoading } = useAiAccess();
  const { shouldGrantTemporaryAccess, isLoading: tempAccessLoading } =
    useTemporaryAccessCheck();
  const { isEnabled: isUnderwritingEnabled, isLoading: isUnderwritingLoading } =
    useUnderwritingFeatureFlag();
  const { canManage: canManageUnderwriting } = useCanManageUnderwriting();
  const licensingWorkspaceAccess = useLicensingWorkspaceAccess();

  const currentUserEmail = supabaseUser?.email?.toLowerCase() ?? null;
  const isSuperAdmin = isSuperAdminFromImo || isSuperAdminFromProfile;
  const isAdmin = isSuperAdmin || isAdminFromProfile || hasAdminRole();
  const isRecruit = roles.includes("recruit");
  const isTrainerOnly = !isSuperAdmin && isStaffOnlyUser(roles);

  const hasFeature = useCallback(
    (feature: FeatureKey | undefined): boolean => {
      if (!feature) return true;
      if (isAdmin) return true;
      if (
        subLoading ||
        imoEntitlementLoading ||
        downlineLoading ||
        tempAccessLoading
      ) {
        return false;
      }
      if (imoGrantsAllFeatures) return true;

      const features = subscription?.plan?.features;
      if (isSubscriptionActive && features?.[feature]) return true;
      if (isDirectDownlineOfOwner && isOwnerDownlineGrantedFeature(feature)) {
        return true;
      }
      if (shouldGrantTemporaryAccess(feature, supabaseUser?.email)) return true;

      return false;
    },
    [
      downlineLoading,
      isAdmin,
      isDirectDownlineOfOwner,
      imoEntitlementLoading,
      imoGrantsAllFeatures,
      isSubscriptionActive,
      shouldGrantTemporaryAccess,
      subLoading,
      subscription?.plan?.features,
      supabaseUser?.email,
      tempAccessLoading,
    ],
  );

  const isEmailAllowed = useCallback(
    (allowedEmails?: string[]) => {
      if (!allowedEmails || allowedEmails.length === 0) return true;
      if (!currentUserEmail) return false;

      return allowedEmails.some(
        (allowedEmail) => allowedEmail.toLowerCase() === currentUserEmail,
      );
    },
    [currentUserEmail],
  );

  const isAgencyAllowed = useCallback(
    (allowedAgencyId?: string) => {
      if (!allowedAgencyId) return true;
      if (isSuperAdmin) return true;
      return agency?.id === allowedAgencyId;
    },
    [agency?.id, isSuperAdmin],
  );

  const resolveItem = useCallback(
    (item: SidebarNavigationItem): ResolvedSidebarNavigationItem | null => {
      if (item.requiresUnderwritingEnabled) {
        if (isUnderwritingLoading) return null;
        if (!isUnderwritingEnabled) return null;
      }

      if (item.requiresUnderwritingManage && !canManageUnderwriting) {
        return null;
      }

      if (item.requiresLicensingWorkspace) {
        if (licensingWorkspaceAccess.isLoading) {
          return { ...item, state: "visible" };
        }
        if (!licensingWorkspaceAccess.hasAccess) return null;
      }

      if (item.superAdminOnly && !isSuperAdmin) return null;
      if (!isAgencyAllowed(item.allowedAgencyId)) return null;
      if (!isEmailAllowed(item.allowedEmails)) return null;

      // Email-substring gate (e.g. Epic-Life-only command center). Super-admins
      // and members of an IMO that grants all features (e.g. Epic Life) bypass —
      // the email substring is only a stand-in for IMO membership, and not every
      // Epic Life agent has "epiclife" in their email.
      if (
        item.requireEmailIncludes &&
        !isSuperAdmin &&
        !imoGrantsAllFeatures &&
        !currentUserEmail?.includes(item.requireEmailIncludes.toLowerCase())
      ) {
        return null;
      }

      // Paid-subscription-only items (e.g. Billing). Super-admins bypass.
      // Hide while loading to avoid a flash, then resolve once known.
      if (item.requiresPaidSubscription && !isSuperAdmin) {
        if (subLoading || !hasManageableSubscription) return null;
      }

      // AI-access items (e.g. AI Sales Scripts). hasAiAccess already accounts for
      // super-admin / free_all_features / the ai_assistant add-on. Hide while
      // loading to avoid a flash.
      if (item.requiresAiAccess) {
        if (aiAccessLoading || !hasAiAccess) return null;
      }

      if (isPending && !item.public) {
        return { ...item, state: "locked" };
      }

      if (item.public) {
        return { ...item, state: "visible" };
      }

      if (
        !item.permission &&
        !item.subscriptionFeature &&
        !item.subscriptionFeatures
      ) {
        return null;
      }

      if (isLoading) return null;
      if (item.permission && !can(item.permission)) return null;
      if (item.subscriptionFeature && !hasFeature(item.subscriptionFeature)) {
        return null;
      }
      if (
        item.subscriptionFeatures &&
        !hasAnyFeatureAccess(item.subscriptionFeatures, hasFeature)
      ) {
        return null;
      }

      return { ...item, state: "visible" };
    },
    [
      aiAccessLoading,
      can,
      canManageUnderwriting,
      currentUserEmail,
      hasAiAccess,
      hasManageableSubscription,
      hasFeature,
      imoGrantsAllFeatures,
      isAgencyAllowed,
      isEmailAllowed,
      isLoading,
      isPending,
      isSuperAdmin,
      isUnderwritingEnabled,
      isUnderwritingLoading,
      licensingWorkspaceAccess.hasAccess,
      licensingWorkspaceAccess.isLoading,
      subLoading,
    ],
  );

  return useMemo(() => {
    const variant: SidebarNavigationVariant = isRecruit
      ? "recruit"
      : isTrainerOnly
        ? "staff"
        : "regular";

    const sourceGroups: SidebarNavigationGroup[] =
      variant === "recruit"
        ? recruitSidebarGroups
        : variant === "staff"
          ? staffSidebarGroups
          : regularSidebarGroups;

    const visibleGroups = sourceGroups
      .map<ResolvedSidebarNavigationGroup>((group) => ({
        ...group,
        items: group.items
          .map(resolveItem)
          .filter(
            (item): item is ResolvedSidebarNavigationItem => item !== null,
          ),
      }))
      .filter((group) => group.items.length > 0);

    const footerItems = footerSidebarItems
      .map(resolveItem)
      .filter((item): item is ResolvedSidebarNavigationItem => item !== null);

    return {
      footerItems,
      isAdmin,
      isPending,
      isRecruit,
      isSuperAdmin,
      variant,
      visibleGroups,
    };
  }, [isRecruit, isTrainerOnly, isAdmin, isPending, isSuperAdmin, resolveItem]);
}
