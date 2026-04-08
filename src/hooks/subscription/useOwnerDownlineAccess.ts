// src/hooks/subscription/useOwnerDownlineAccess.ts
// Hook to check if the current user is in the owner's downline hierarchy

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/base/supabase";

/**
 * Owner emails - users whose direct downlines get full feature access
 * (excludes admin features like Admin page, Training Hub)
 * IMPORTANT: Store in lowercase for case-insensitive comparison
 */
export const OWNER_EMAILS = ["nickneessen@thestandardhq.com"];

/** The Standard agency ID — used for gating internal-only tools */
export const THE_STANDARD_AGENCY_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

// Lowercase version for case-insensitive comparisons
const OWNER_EMAILS_LOWER = OWNER_EMAILS.map((e) => e.toLowerCase());

/**
 * Check if an email is an owner email (case-insensitive)
 */
function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return OWNER_EMAILS_LOWER.includes(email.toLowerCase());
}

/**
 * Features that direct downlines of owners get access to
 * (Team-tier subscription features)
 */
export const OWNER_DOWNLINE_GRANTED_FEATURES = [
  "expenses",
  "targets_basic",
  "targets_full",
  "reports_view",
  "reports_export",
  "email",
  "sms",
  "hierarchy",
  "recruiting",
  "overrides",
  "downline_reports",
  "team_analytics",
  "training",
  "close_ai_builder",
  "close_kpi",
] as const;

export type OwnerDownlineGrantedFeature =
  (typeof OWNER_DOWNLINE_GRANTED_FEATURES)[number];

interface UseOwnerDownlineAccessResult {
  /** Whether the current user is a direct downline of an owner */
  isDirectDownlineOfOwner: boolean;
  /** Whether the check is still loading */
  isLoading: boolean;
  /** Error if the check failed */
  error: Error | null;
}

/**
 * Hook to check if the current user is a direct downline of an owner.
 *
 * Direct downlines of owners (nickneessen@thestandardhq.com) get access to
 * Team-tier subscription features without needing a paid subscription.
 *
 * Admin features (Admin page, Training Hub) remain locked.
 *
 * @returns Object with isDirectDownlineOfOwner, isLoading, and error
 */
export function useOwnerDownlineAccess(): UseOwnerDownlineAccessResult {
  const { user } = useAuth();
  const userId = user?.id;
  const userEmail = user?.email;

  // If user is an owner themselves, they're not considered a "downline"
  // (owners have full access via ADMIN_EMAILS anyway)
  const isOwner = isOwnerEmail(userEmail);

  const { data, isLoading, error } = useQuery({
    queryKey: ["owner-downline-access", userId],
    queryFn: async () => {
      if (!userId || isOwner) {
        return { isDirectDownline: false };
      }

      // Use database function (SECURITY DEFINER bypasses RLS)
      const { data, error } = await supabase.rpc(
        "is_direct_downline_of_owner",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        console.error("[useOwnerDownlineAccess] RPC error:", error);
        return { isDirectDownline: false };
      }

      return { isDirectDownline: !!data };
    },
    enabled: !!userId && !isOwner,
    staleTime: 10 * 60 * 1000, // 10 minutes - this rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  return {
    isDirectDownlineOfOwner: data?.isDirectDownline ?? false,
    isLoading: isOwner ? false : isLoading,
    error: error as Error | null,
  };
}

/**
 * Check if a feature is granted to direct downlines of owners
 */
export function isOwnerDownlineGrantedFeature(
  feature: string,
): feature is OwnerDownlineGrantedFeature {
  return OWNER_DOWNLINE_GRANTED_FEATURES.includes(
    feature as OwnerDownlineGrantedFeature,
  );
}
