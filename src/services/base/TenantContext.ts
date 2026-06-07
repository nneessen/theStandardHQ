// src/services/base/TenantContext.ts
// Utility for getting the current user's tenant context (imo_id, agency_id)

import { supabase } from "./supabase";

export interface TenantContext {
  userId: string;
  imoId: string | null;
  agencyId: string | null;
}

/**
 * Get the current user's tenant context from their profile.
 * Returns the EFFECTIVE imo_id and agency_id for multi-tenant data isolation.
 *
 * This is a faithful mirror of the database RLS helper `get_effective_imo_id()`,
 * so the application layer never disagrees with what RLS will actually return:
 *   - super-admin  → their acting_imo_id (the IMO they have switched to in the
 *                    sidebar selector; `null` only in the explicit "All IMOs" mode)
 *   - everyone else → their real home imo_id (acting context is ignored)
 *
 * Keeping these two layers in lockstep is what prevents cross-IMO bleed-over:
 * a super-admin viewing Epic Life must have the app-layer default tenant resolve
 * to Epic Life too, not silently fall back to their home IMO (FFG).
 *
 * @throws Error if user is not authenticated or profile not found
 */
export async function getCurrentTenantContext(): Promise<TenantContext> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User not authenticated");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("imo_id, agency_id, is_super_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(`Failed to fetch user profile: ${profileError.message}`);
  }

  const homeImoId = profile?.imo_id ?? null;
  const isSuperAdmin = profile?.is_super_admin === true;

  // Read the super-admin "acting IMO" from auth metadata — the same value the
  // SQL helper get_effective_imo_id() reads from raw_user_meta_data. supabase-js
  // surfaces it as user.user_metadata. Empty string is normalised to null.
  const actingImoId = isSuperAdmin
    ? (user.user_metadata?.acting_imo_id as string | undefined) || null
    : null;

  const imoId = isSuperAdmin ? actingImoId : homeImoId;

  // Agency context only applies when the effective IMO is the user's own IMO.
  // A super-admin acting as another tenant has no agency there.
  const agencyId = imoId === homeImoId ? (profile?.agency_id ?? null) : null;

  return {
    userId: user.id,
    imoId,
    agencyId,
  };
}

/**
 * Get tenant context, returning null values instead of throwing on error.
 * Useful for optional tenant context injection where missing data is acceptable.
 */
export async function getTenantContextSafe(): Promise<TenantContext | null> {
  try {
    return await getCurrentTenantContext();
  } catch {
    return null;
  }
}

/**
 * Extract tenant fields from user profile for DB insertion.
 * Returns an object with imo_id and agency_id ready to spread into DB data.
 */
export async function getTenantFields(): Promise<{
  imo_id: string | null;
  agency_id: string | null;
}> {
  const context = await getCurrentTenantContext();
  return {
    imo_id: context.imoId,
    agency_id: context.agencyId,
  };
}
