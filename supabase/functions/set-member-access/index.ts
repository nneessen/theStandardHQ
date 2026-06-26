// supabase/functions/set-member-access/index.ts
//
// Self-service offboarding: a team leader REVERSIBLY blocks/unblocks a team
// member's sign-in (Supabase auth ban). Their data, hierarchy position, and
// commission rollups are preserved — only login is cut. The access_disabled_*
// columns are a UI/state mirror; the auth ban is the real enforcement.
//
// Authorized by ../_shared/team-authz (downline / admin-same-IMO).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "npm:zod@3.23.8";
import {
  authorizeTeamAction,
  getCallerUserId,
  makeAdminClient,
} from "../_shared/team-authz.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ~100 years; Supabase treats a long ban as effectively permanent until reversed.
const BAN_DURATION = "876600h";

const requestSchema = z
  .object({
    user_id: z.string().uuid(),
    action: z.enum(["disable", "enable"]),
    reason: z.string().max(500).optional(),
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
    const admin = makeAdminClient();

    const caller = await getCallerUserId(req, admin);
    if (!caller.ok) {
      return jsonResponse(caller.status, {
        success: false,
        error: "Unauthorized",
      });
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(400, { success: false, error: "Invalid request" });
    }
    const { user_id, action, reason } = parsed.data;

    const authz = await authorizeTeamAction(admin, caller.userId, user_id);
    if (!authz.ok) {
      return jsonResponse(authz.status ?? 403, {
        success: false,
        error: authz.error ?? "Forbidden",
      });
    }

    const disabling = action === "disable";

    // 1) Flip the auth ban (the real enforcement).
    const { error: banError } = await admin.auth.admin.updateUserById(user_id, {
      ban_duration: disabling ? BAN_DURATION : "none",
    });
    if (banError) {
      console.error("[set-member-access] ban error:", banError);
      return jsonResponse(500, {
        success: false,
        error: "Failed to update sign-in access",
        message: banError.message,
      });
    }

    // 2) Mirror the state onto user_profiles for the team UI (no hierarchy impact).
    const { error: profileError } = await admin
      .from("user_profiles")
      .update(
        disabling
          ? {
              access_disabled_at: new Date().toISOString(),
              access_disabled_by: caller.userId,
              access_disabled_reason: reason ?? null,
            }
          : {
              access_disabled_at: null,
              access_disabled_by: null,
              access_disabled_reason: null,
            },
      )
      .eq("id", user_id);

    if (profileError) {
      // The ban already succeeded; surface but don't claim total failure.
      console.error("[set-member-access] profile mirror error:", profileError);
      return jsonResponse(207, {
        success: true,
        warning: "Access updated, but the status flag did not save.",
      });
    }

    return jsonResponse(200, { success: true, disabled: disabling });
  } catch (error) {
    console.error("[set-member-access] error:", error);
    return jsonResponse(400, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
