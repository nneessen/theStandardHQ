// src/hooks/subscription/useAiAccess.ts
// THE single client-side AI entitlement gate. Every AI surface — the Command
// Center assistant (Jarvis), call-recording AI analysis, AI Sales Scripts, and
// the Predictive Analytics section — gates on this one predicate so access stays
// consistent across the sidebar, routes, and page components.
//
// A user has AI access if ANY of:
//   1. super-admin (bypasses everything),
//   2. their IMO grants all features for free (Epic Life `free_all_features` —
//      i.e. the owner's personal team), or
//   3. they hold the `ai_assistant` ("AI Suite") add-on (active or manual_grant —
//      `getUserActiveAddons` already filters to those statuses, so a manual grant
//      is a no-Stripe way to comp anyone).
//
// The server mirrors this in supabase/functions/_shared/resolve-ai-access.ts —
// keep the two in sync. Email-marker ("epiclife") gating is NOT needed here:
// `free_all_features` already covers the Epic Life IMO; the email marker is only
// a server-side proxy for callers whose IMO can't be cheaply resolved.

import { useImo } from "@/contexts/ImoContext";
import { useImoAllFeaturesAccess } from "./useImoAllFeaturesAccess";
import { useUserActiveAddons } from "./useUserActiveAddons";

/** Name of the single AI add-on (matches subscription_addons.name). */
export const AI_ASSISTANT_ADDON_NAME = "ai_assistant";

export interface UseAiAccessResult {
  /** Whether the current user may use any AI feature. */
  hasAiAccess: boolean;
  /** Whether the underlying entitlement checks are still resolving. */
  isLoading: boolean;
}

/**
 * Single source of truth for whether the current user can access AI features.
 */
export function useAiAccess(): UseAiAccessResult {
  // All hooks called unconditionally (Rules of Hooks) before any branching.
  const { isSuperAdmin } = useImo();
  const { grantsAllFeatures, isLoading: imoLoading } =
    useImoAllFeaturesAccess();
  const { activeAddons, isLoading: addonsLoading } = useUserActiveAddons();

  // Super-admin short-circuit: immediate access, no loading wait (mirrors the
  // precedence in useFeatureAccess / useAnalyticsSectionAccess).
  if (isSuperAdmin) {
    return { hasAiAccess: true, isLoading: false };
  }

  const hasAiAddon = activeAddons.some(
    (a) => a.addon?.name === AI_ASSISTANT_ADDON_NAME,
  );

  return {
    hasAiAccess: grantsAllFeatures || hasAiAddon,
    isLoading: imoLoading || addonsLoading,
  };
}
