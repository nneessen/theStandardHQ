// /home/nneessen/projects/commissionTracker/src/components/auth/ApprovalGuard.tsx

import React from "react";
import { Navigate, useLocation } from "@tanstack/react-router";
import { useAuthorizationStatus } from "@/hooks/admin";
import { PendingApproval, DeniedAccess } from "@/features/auth";
import { usePermissionCheck } from "@/hooks/permissions";
import { LogoSpinner } from "@/components/ui/logo-spinner";
import { useAuth } from "@/contexts/AuthContext";
import { TermsAcceptanceGate } from "@/components/auth/TermsAcceptanceGate";

interface ApprovalGuardProps {
  children: React.ReactNode;
}

/**
 * ApprovalGuard component
 * Wraps protected routes and checks user approval status
 * - Shows PendingApproval screen if user is pending (EXCEPT for recruits)
 * - Recruits with pending approval are routed directly to /recruiting/my-pipeline
 * - Shows DeniedAccess screen if user is denied
 * - Allows access if user is approved or is admin
 */
export const ApprovalGuard: React.FC<ApprovalGuardProps> = ({ children }) => {
  const location = useLocation();
  const { isApproved, isPending, isDenied, denialReason, isLoading, profile } =
    useAuthorizationStatus();
  const { supabaseUser } = useAuth();

  const { is, isLoading: permissionsLoading } = usePermissionCheck();
  const currentUserEmail = supabaseUser?.email || undefined;

  const isRecruit = is("recruit");
  const isAgent = is("agent");
  const isAdmin = is("admin");

  // Admin email - hardcoded for security
  const ADMIN_EMAIL = "nickneessen@thestandardhq.com";

  // Show loading state while checking approval status, auth, or permissions
  if (isLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <LogoSpinner size="xl" className="mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Admin bypass - if current user email matches admin email, always allow
  if (currentUserEmail === ADMIN_EMAIL) {
    return <TermsAcceptanceGate>{children}</TermsAcceptanceGate>;
  }

  // NEW: Recruit handling - recruits should only see their onboarding pipeline
  // Check if we're already on the pipeline page to avoid infinite redirect
  // CRITICAL: Use TanStack Router's location, not window.location, to stay in sync with router state
  const currentPath = location.pathname;
  const isOnPipelinePage = currentPath === "/recruiting/my-pipeline";

  // Only redirect if user is ONLY a recruit and not an agent
  // This ensures that users with agent roles are not redirected
  if (isRecruit && !isAgent && !isAdmin) {
    // If already on pipeline page, render children (the pipeline component)
    if (isOnPipelinePage) {
      return <TermsAcceptanceGate>{children}</TermsAcceptanceGate>;
    }
    // Otherwise, redirect recruits to their pipeline
    return <Navigate to="/recruiting/my-pipeline" replace />;
  }

  // Show pending approval screen (for non-recruits)
  if (isPending) {
    return <PendingApproval email={profile?.email ?? currentUserEmail} />;
  }

  // Show denied access screen
  if (isDenied) {
    return (
      <DeniedAccess
        email={profile?.email ?? currentUserEmail}
        reason={denialReason || undefined}
      />
    );
  }

  // Allow access if approved or admin
  if (isApproved) {
    return <TermsAcceptanceGate>{children}</TermsAcceptanceGate>;
  }

  // Fallback: show pending screen if status is unclear
  return <PendingApproval email={profile?.email ?? currentUserEmail} />;
};
