// supabase/functions/set-account-password/index.ts
//
// PUBLIC (deploy with --no-verify-jwt): the person setting their password is not
// logged in yet. Validates an app-owned account_setup_token, sets the auth user's
// password, and consumes the token. Replaces the fragile Supabase recovery link.
//
// Token validation is here (write path); the read-only page validation uses the
// get_account_setup_by_token RPC so email-scanner pre-clicks never consume a token.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z
  .object({
    token: z.string().uuid(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72),
  })
  .strict();

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(400, {
        success: false,
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }
    const { token, password } = parsed.data;

    // Look up the token (service role bypasses RLS).
    const { data: row, error: lookupError } = await supabaseAdmin
      .from("account_setup_tokens")
      .select("id, user_id, used_at, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (lookupError) {
      console.error("[set-account-password] lookup error:", lookupError);
      return jsonResponse(500, { success: false, error: "Lookup failed" });
    }
    if (!row) {
      return jsonResponse(404, {
        success: false,
        error: "invalid",
        message: "This link is invalid. Ask your team leader to resend it.",
      });
    }
    if (row.used_at) {
      return jsonResponse(409, {
        success: false,
        error: "already_used",
        message: "Your password has already been set. Please log in.",
      });
    }
    if (new Date(row.expires_at) < new Date()) {
      return jsonResponse(410, {
        success: false,
        error: "expired",
        message: "This link has expired. Ask your team leader to resend it.",
      });
    }

    // Set the password on the auth user.
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
        password,
      });

    if (updateError) {
      console.error(
        "[set-account-password] updateUserById error:",
        updateError,
      );
      return jsonResponse(500, {
        success: false,
        error: "Failed to set password",
        message: updateError.message,
      });
    }

    // Consume the token (only after the password is set, so a failure above is retryable).
    const { error: consumeError } = await supabaseAdmin
      .from("account_setup_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("used_at", null);

    if (consumeError) {
      // Non-fatal: the password is already set. Log and continue.
      console.error("[set-account-password] consume error:", consumeError);
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    console.error("[set-account-password] error:", error);
    return jsonResponse(400, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
