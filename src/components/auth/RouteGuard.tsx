// src/components/auth/RouteGuard.tsx

import React from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuthorizationStatus } from "@/hooks/admin";
import { usePermissionCheck } from "@/hooks/permissions";
import { useAuth } from "@/contexts/AuthContext";
import {
  useFeatureAccess,
  useAnyFeatureAccess,
  useSubscription,
  type FeatureKey,
} from "@/hooks/subscription";
import { PendingApproval } from "@/features/auth";
import { PermissionDenied } from "@/features/auth";
import { UpgradePrompt } from "@/components/subscription";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import type { PermissionCode } from "@/types/permissions.types";
import { STAFF_ONLY_ROLES } from "@/constants/roles";

interface RouteGuardProps {
  children: React.ReactNode;
  /** Required permission to access this route */
  permission?: PermissionCode;
  /** Multiple permissions (require any by default) */
  permissions?: PermissionCode[];
  /** If true, require ALL permissions */
  requireAll?: boolean;
  /** If true, allow pending users to access (for settings page) */
  allowPending?: boolean;
  /** If true, only recruits can access this route */
  recruitOnly?: boolean;
  /** If true, recruits are NOT allowed (redirects to pipeline) */
  noRecruits?: boolean;
  /** If true, staff-only roles (trainer, contracting_manager) are NOT allowed */
  noStaffRoles?: boolean;
  /** If true, only staff roles (trainer, contracting_manager) can access */
  staffOnly?: boolean;
  /** If true, only super admins can access this route */
  superAdminOnly?: boolean;
  /** Required email for super-admin routes */
  requireEmail?: string;
  /** Require the user's email to contain this substring, case-insensitive (super admins bypass) */
  requireEmailIncludes?: string;
  /** Whitelist of emails that can access this route (super admins always bypass) */
  allowedEmails?: string[];
  /** Restrict route to users belonging to a specific agency ID */
  allowedAgencyId?: string;
  /** Required subscription feature to access this route (single) */
  subscriptionFeature?: FeatureKey;
  /** Multiple subscription features - ANY grants access (like Sidebar) */
  subscriptionFeatures?: FeatureKey[];
  /**
   * If true, only users with an active PAID subscription (Pro/Team) may access.
   * Super-admins bypass. Used by the Billing route while self-serve
   * subscriptions are disabled.
   */
  requiresPaidSubscription?: boolean;
  /** Custom fallback component */
  fallback?: React.ReactNode;
}

/**
 * RouteGuard component - unified route protection
 *
 * Combines approval status, permissions, and role checks:
 * - Blocks pending users (unless allowPending is true)
 * - Blocks/redirects recruits (unless recruitOnly or explicitly allowed)
 * - Checks permissions
 *
 * @example
 * ```tsx
 * // Standard protected route (blocks pending and recruits)
 * <RouteGuard permission="nav.dashboard" noRecruits>
 *   <DashboardPage />
 * </RouteGuard>
 *
 * // Settings page (allow pending users)
 * <RouteGuard allowPending>
 *   <SettingsPage />
 * </RouteGuard>
 *
 * // Recruit-only route
 * <RouteGuard recruitOnly allowPending>
 *   <MyRecruitingPipeline />
 * </RouteGuard>
 * ```
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  allowPending = false,
  recruitOnly = false,
  noRecruits = false,
  noStaffRoles = false,
  staffOnly = false,
  superAdminOnly = false,
  requireEmail,
  requireEmailIncludes,
  allowedEmails,
  allowedAgencyId,
  subscriptionFeature,
  subscriptionFeatures,
  requiresPaidSubscription = false,
  fallback,
}) => {
  const { supabaseUser } = useAuth();
  const {
    isApproved: _isApproved,
    isPending,
    isDenied,
    isSuperAdmin,
    profile,
    isLoading: authLoading,
  } = useAuthorizationStatus();
  const {
    can,
    canAny,
    canAll,
    is,
    isLoading: permLoading,
  } = usePermissionCheck();

  // Feature access check - single feature (only if subscriptionFeature is specified)
  const singleFeatureAccess = useFeatureAccess(
    subscriptionFeature || "dashboard",
  );

  // Feature access check - multiple features (any grants access)
  const multiFeatureAccess = useAnyFeatureAccess(subscriptionFeatures || []);

  // Paid-subscription gate (Billing route while self-serve sign-ups are off)
  const { hasManageableSubscription, isLoading: subscriptionLoading } =
    useSubscription();

  // Determine which feature check to use
  const hasFeatureRequirement = subscriptionFeature || subscriptionFeatures;
  const checkingFeature =
    (subscriptionFeature && singleFeatureAccess.isLoading) ||
    (subscriptionFeatures && multiFeatureAccess.isLoading);

  // Show loading state while checking
  if (
    authLoading ||
    permLoading ||
    checkingFeature ||
    (requiresPaidSubscription && subscriptionLoading)
  ) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <LogoSpinner size="xl" className="mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Super admin bypass - users with is_super_admin flag bypass all checks
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Paid-subscription-only routes: non-subscribers have nothing to manage here
  // (self-serve sign-ups are disabled), so send them back to the dashboard.
  // Existing paid subscribers — including delinquent (past_due) ones — keep
  // access so they can reach the Stripe portal to fix payment or cancel.
  if (requiresPaidSubscription && !hasManageableSubscription) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check super-admin-only routes
  if (superAdminOnly) {
    return <>{fallback || <PermissionDenied />}</>;
  }

  const currentEmail = supabaseUser?.email;

  // Check email requirement for super-admin routes
  if (requireEmail && currentEmail !== requireEmail) {
    return <>{fallback || <PermissionDenied />}</>;
  }

  // Check email-substring requirement (e.g. Epic-Life-only command center).
  // Super admins already returned above, so this only gates non-super-admins.
  if (
    requireEmailIncludes &&
    !currentEmail?.toLowerCase().includes(requireEmailIncludes.toLowerCase())
  ) {
    return <>{fallback || <PermissionDenied />}</>;
  }

  // Check email whitelist - only specified emails can access
  if (allowedEmails && allowedEmails.length > 0) {
    const emailAllowed = allowedEmails.some(
      (email) => email.toLowerCase() === currentEmail?.toLowerCase(),
    );
    if (!emailAllowed) {
      return <>{fallback || <PermissionDenied />}</>;
    }
  }

  // Check agency ID restriction - only users from specified agency can access
  if (allowedAgencyId && profile?.agency_id !== allowedAgencyId) {
    return <>{fallback || <PermissionDenied />}</>;
  }

  // Role checks
  const isRecruit = is("recruit");
  const isAgent = is("agent");
  const isAdmin = is("admin");

  // Check if user has any staff-only role using centralized constant
  const hasStaffOnlyRole = STAFF_ONLY_ROLES.some((role) => is(role));

  // Determine if user is ONLY a recruit (not also an agent)
  const isRecruitOnly = isRecruit && !isAgent && !isAdmin;

  // Determine if user is a staff-only role (trainer or contracting_manager, but not admin or agent)
  const isStaffOnlyRole = hasStaffOnlyRole && !isAgent && !isAdmin;

  // Check recruitOnly routes - only recruits can access
  if (recruitOnly && !isRecruitOnly) {
    // Non-recruits trying to access recruit-only route
    return <>{fallback || <PermissionDenied />}</>;
  }

  // Check noRecruits routes - recruits are NOT allowed
  if (noRecruits && isRecruitOnly) {
    // Redirect recruits to their pipeline
    return <Navigate to="/recruiting/my-pipeline" replace />;
  }

  // Check staffOnly routes - only trainers/contracting_managers can access
  if (staffOnly && !isStaffOnlyRole) {
    // Non-staff trying to access staff-only route
    return <>{fallback || <PermissionDenied />}</>;
  }

  // Check noStaffRoles routes - trainers/contracting_managers are NOT allowed
  if (noStaffRoles && isStaffOnlyRole) {
    // Redirect staff to trainer dashboard
    return <Navigate to="/trainer-dashboard" replace />;
  }

  // Check approval status (unless allowPending is true)
  if (!allowPending) {
    if (isDenied) {
      return <Navigate to="/auth/denied" replace />;
    }

    if (isPending) {
      return <PendingApproval email={profile?.email ?? currentEmail} />;
    }
  }

  // Check permission requirements
  let hasPermission = true;
  if (permission) {
    hasPermission = can(permission);
  } else if (permissions && permissions.length > 0) {
    hasPermission = requireAll ? canAll(permissions) : canAny(permissions);
  }

  // Show permission denied if check fails
  // FIXED: Previously used `&& !isApproved` which bypassed permission checks for approved users
  if (!hasPermission) {
    return <>{fallback || <PermissionDenied />}</>;
  }

  // Check subscription feature access (after permission checks)
  // Staff-only roles (trainers, contracting managers) bypass subscription checks
  // They have IMO-level access and don't need individual subscriptions
  if (hasFeatureRequirement && !isStaffOnlyRole) {
    // Check single feature
    if (subscriptionFeature && !singleFeatureAccess.hasAccess) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <UpgradePrompt feature={subscriptionFeature} variant="card" />
        </div>
      );
    }
    // Check multiple features (any grants access)
    if (subscriptionFeatures && !multiFeatureAccess.hasAccess) {
      // Use the first feature for the upgrade prompt
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <UpgradePrompt feature={subscriptionFeatures[0]} variant="card" />
        </div>
      );
    }
  }

  // All checks passed - render children
  return <>{children}</>;
};

export default RouteGuard;
