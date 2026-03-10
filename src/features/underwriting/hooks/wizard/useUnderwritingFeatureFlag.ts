// src/features/underwriting/hooks/useUnderwritingFeatureFlag.ts

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useUwWizardAddonAccess } from "@/hooks/admin";
import { useSubscription } from "@/hooks/subscription";
import { supabase } from "@/services/base/supabase";

export type AccessSource =
  | "super_admin"
  | "manual_grant"
  | "team_owner"
  | "team_seat"
  | "purchased"
  | "none";

/**
 * Check if user has a team seat assignment (agent seated by a team owner)
 */
function useTeamSeatCheck(userId: string | undefined, skip: boolean) {
  return useQuery<boolean, Error>({
    queryKey: ["team-seat-check", userId],
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from("team_uw_wizard_seats")
        .select("id")
        .eq("agent_id", userId)
        .limit(1);

      if (error) return false;
      return (data?.length || 0) > 0;
    },
    enabled: !!userId && !skip,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to check if the underwriting wizard feature is enabled for the current user.
 * Access is granted if:
 * 1. User is a super admin (always has access), OR
 * 2. User has uw_wizard_enabled = true (manual override), OR
 * 3. User is on Team plan (team owner), OR
 * 4. User has a team seat assignment, OR
 * 5. User has purchased the UW Wizard add-on
 */
export function useUnderwritingFeatureFlag() {
  const { user, loading: userLoading } = useAuth();

  // Super admins always have access
  const isSuperAdmin = user?.is_super_admin === true;

  // User-level flag (manual override)
  const hasManualAccess = user?.uw_wizard_enabled === true;

  // Check if user is on Team plan (owner gets UW Wizard built-in)
  const { subscription } = useSubscription();
  const isTeamOwner =
    subscription?.plan?.name === "team" &&
    ["active", "trialing"].includes(subscription?.status || "");

  const skipTeamSeatAndAddon = isSuperAdmin || hasManualAccess || isTeamOwner;

  // Check if user is a team seat recipient
  const { data: hasTeamSeat, isLoading: teamSeatLoading } = useTeamSeatCheck(
    user?.id,
    skipTeamSeatAndAddon,
  );

  const skipAddon = skipTeamSeatAndAddon || hasTeamSeat === true;

  // Check for purchased add-on (only if not already granted)
  const { data: hasAddonAccess, isLoading: addonLoading } =
    useUwWizardAddonAccess(!skipAddon ? user?.id : undefined);

  const isLoading =
    userLoading ||
    (!!user?.id && !skipTeamSeatAndAddon && teamSeatLoading) ||
    (!!user?.id && !skipAddon && addonLoading);

  const isEnabled =
    isSuperAdmin ||
    hasManualAccess ||
    isTeamOwner ||
    hasTeamSeat === true ||
    hasAddonAccess === true;

  // Determine access source for UI display
  let accessSource: AccessSource = "none";
  if (isSuperAdmin) accessSource = "super_admin";
  else if (hasManualAccess) accessSource = "manual_grant";
  else if (isTeamOwner) accessSource = "team_owner";
  else if (hasTeamSeat) accessSource = "team_seat";
  else if (hasAddonAccess) accessSource = "purchased";

  return {
    isEnabled,
    isLoading,
    error: null,
    canAccess: isEnabled,
    accessSource,
  };
}

/**
 * Hook to check if the current user can manage underwriting settings (guides, decision trees)
 * Only IMO admins and super admins can manage these
 */
export function useCanManageUnderwriting() {
  const { user, loading: isLoading } = useAuth();

  // Check if user is IMO admin or super admin
  const isSuperAdmin = user?.is_super_admin === true;
  const isImoAdmin = user?.is_admin === true;

  return {
    canManage: isSuperAdmin || isImoAdmin,
    isLoading,
    isSuperAdmin,
    isImoAdmin,
  };
}
