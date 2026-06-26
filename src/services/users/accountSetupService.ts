// src/services/users/accountSetupService.ts
//
// Client for the app-controlled account-setup + team-access features:
//  - validateSetupToken / setAccountPassword: the unauthenticated /set-password page
//  - resendAccountSetup: self-service resend of a team member's setup link
//  - setMemberAccess: reversible disable / re-enable of a team member's sign-in
//
// Replaces the fragile Supabase recovery-link onboarding. See
// supabase/functions/{set-account-password,resend-account-setup,set-member-access}.

import { supabase } from "../base/supabase";

export interface SetupTokenValidation {
  valid: boolean;
  email?: string;
  first_name?: string | null;
  error?: string;
  message?: string;
}

export interface EdgeResult {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * supabase-js puts a non-2xx edge response in `error.context` (a Response), so the
 * specific message is otherwise lost. This unwraps it into a uniform shape.
 */
async function invokeEdge(
  name: string,
  body: Record<string, unknown>,
): Promise<EdgeResult> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FunctionsHttpError shape
    const ctx = (error as any).context;
    let parsed: { error?: string; message?: string } | null = null;
    if (ctx && typeof ctx.json === "function") {
      parsed = await ctx.json().catch(() => null);
    }
    return {
      success: false,
      error: parsed?.error || error.message,
      message: parsed?.message,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- edge JSON body
  const d = (data ?? {}) as any;
  return {
    success: d.success !== false,
    error: d.error,
    message: d.message,
  };
}

/** Read-only token validation for the public /set-password page (never consumes the token). */
export async function validateSetupToken(
  token: string,
): Promise<SetupTokenValidation> {
  // Cast: get_account_setup_by_token is added by migration 20260626142357; the
  // generated database.types.ts is regenerated from prod after that migration ships.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "get_account_setup_by_token",
    { p_token: token },
  );

  if (error) {
    return {
      valid: false,
      error: "validation_failed",
      message: "We couldn't validate this link. Please try again.",
    };
  }
  return (data ?? { valid: false }) as unknown as SetupTokenValidation;
}

/** Set the password for a freshly-created account and consume the token. */
export async function setAccountPassword(
  token: string,
  password: string,
): Promise<EdgeResult> {
  return invokeEdge("set-account-password", { token, password });
}

/** Resend a setup link to a member of the caller's team (authorized server-side). */
export async function resendAccountSetup(userId: string): Promise<EdgeResult> {
  return invokeEdge("resend-account-setup", { user_id: userId });
}

/** Reversibly disable or re-enable a team member's sign-in (authorized server-side). */
export async function setMemberAccess(
  userId: string,
  action: "disable" | "enable",
  reason?: string,
): Promise<EdgeResult> {
  return invokeEdge("set-member-access", { user_id: userId, action, reason });
}
