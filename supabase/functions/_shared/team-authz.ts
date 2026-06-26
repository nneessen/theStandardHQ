// supabase/functions/_shared/team-authz.ts
//
// Shared authorization for team-management edge functions (resend-account-setup,
// set-member-access). A team leader may act on a member ONLY if that member is in
// their downline; admins/super-admins may act on anyone in their own IMO. This is
// the security core of the self-service resend/disable features — never let a
// caller act on an arbitrary account.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// deno-lint-ignore no-explicit-any
type SupabaseAdminClient = any;

export function makeAdminClient(): SupabaseAdminClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Resolve the calling user from the Bearer token. */
export async function getCallerUserId(
  req: Request,
  admin: SupabaseAdminClient,
): Promise<{ ok: true; userId: string } | { ok: false; status: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401 };
  }
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(authHeader.slice(7));
  if (error || !user) return { ok: false, status: 401 };
  return { ok: true, userId: user.id };
}

interface CallerProfile {
  id: string;
  imo_id: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  hierarchy_path: string | null;
}
interface TargetProfile {
  id: string;
  email: string | null;
  imo_id: string | null;
  upline_id: string | null;
  hierarchy_path: string | null;
  access_disabled_at: string | null;
}

export interface TeamAuthzResult {
  ok: boolean;
  status?: number;
  error?: string;
  caller?: CallerProfile;
  target?: TargetProfile;
}

/**
 * Authorize the caller to act on the target user.
 * Allowed when: caller is admin/super-admin in the SAME imo, OR caller is an
 * ancestor of the target in the hierarchy (caller.id appears as a segment of the
 * target's hierarchy_path) OR is the target's direct upline. Self-action is denied.
 */
export async function authorizeTeamAction(
  admin: SupabaseAdminClient,
  callerUserId: string,
  targetUserId: string,
): Promise<TeamAuthzResult> {
  if (callerUserId === targetUserId) {
    return {
      ok: false,
      status: 403,
      error: "You cannot do this to your own account.",
    };
  }

  const { data: caller } = await admin
    .from("user_profiles")
    .select("id, imo_id, is_admin, is_super_admin, hierarchy_path")
    .eq("id", callerUserId)
    .maybeSingle();
  if (!caller) return { ok: false, status: 403, error: "Caller not found" };

  const { data: target } = await admin
    .from("user_profiles")
    .select("id, email, imo_id, upline_id, hierarchy_path, access_disabled_at")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target) return { ok: false, status: 404, error: "Member not found" };

  const sameImo = !!caller.imo_id && caller.imo_id === target.imo_id;

  // Admins / super-admins may manage anyone in their own IMO.
  if ((caller.is_admin || caller.is_super_admin) && sameImo) {
    return { ok: true, caller, target };
  }

  // Upline chain: the caller's id must appear as a segment of the target's
  // hierarchy_path (i.e. the caller is an ancestor), or be the direct upline.
  const segments = (target.hierarchy_path ?? "").split(".").filter(Boolean);
  const isAncestor = segments.includes(callerUserId);
  const isDirectUpline = target.upline_id === callerUserId;

  if (sameImo && (isAncestor || isDirectUpline)) {
    return { ok: true, caller, target };
  }

  return {
    ok: false,
    status: 403,
    error: "You can only manage members of your own team.",
  };
}
