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
  useOwnerDownlineAccess,
  isOwnerDownlineGrantedFeature,
  useTemporaryAccessCheck,
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
  } = useSubscription();
  const { isDirectDownlineOfOwner, isLoading: downlineLoading } =
    useOwnerDownlineAccess();
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
      if (subLoading || downlineLoading || tempAccessLoading) return false;

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
      can,
      canManageUnderwriting,
      hasFeature,
      isAgencyAllowed,
      isEmailAllowed,
      isLoading,
      isPending,
      isSuperAdmin,
      isUnderwritingEnabled,
      isUnderwritingLoading,
      licensingWorkspaceAccess.hasAccess,
      licensingWorkspaceAccess.isLoading,
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
