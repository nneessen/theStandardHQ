// Shared authorization for the Jarvis voice endpoints (STT + TTS). Both are
// independently HTTP-callable, so each must gate access on its own — UI gating is
// not sufficient. Mirrors the orchestrator's Epic-Life boundary.

import { createSupabaseClient } from "./supabase-client.ts";
import { canAccessAssistant } from "../assistant-orchestrator/core/access.ts";

export interface VoiceCaller {
  userId: string;
  email: string | null;
}

export type VoiceAuthResult =
  | { ok: true; caller: VoiceCaller }
  | { ok: false; status: number; error: string };

/**
 * Authenticate the caller from the Authorization header and enforce the
 * command-center access gate (super-admins always; otherwise Epic Life only).
 */
export async function authorizeVoiceCaller(
  req: Request,
): Promise<VoiceAuthResult> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return { ok: false, status: 401, error: "Missing Authorization header" };
  }

  const db = createSupabaseClient(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error } = await db.auth.getUser(token);
  if (error || !userData?.user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const { data: gateProfile } = await db
    .from("user_profiles")
    .select("is_super_admin")
    .eq("id", userData.user.id)
    .single();

  if (
    !canAccessAssistant({
      email: userData.user.email,
      isSuperAdmin: gateProfile?.is_super_admin === true,
    })
  ) {
    return {
      ok: false,
      status: 403,
      error: "The command center isn't available for your account.",
    };
  }

  return {
    ok: true,
    caller: { userId: userData.user.id, email: userData.user.email ?? null },
  };
}
