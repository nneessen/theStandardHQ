// supabase/functions/resend-account-setup/index.ts
//
// Self-service: a team leader regenerates and re-sends the "set your password"
// link for a member of THEIR team (or an admin for anyone in their IMO). Replaces
// the owner-only path where everyone had to ask Nick to resend.
//
// Authorized by ../_shared/team-authz (downline / admin-same-IMO). Token rotation
// + resend cap (5) live in upsert_account_setup_token via createOrRefreshSetupToken.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "npm:zod@3.23.8";
import {
  authorizeTeamAction,
  getCallerUserId,
  makeAdminClient,
} from "../_shared/team-authz.ts";
import {
  createOrRefreshSetupToken,
  sendSetupEmail,
} from "../_shared/account-setup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({ user_id: z.string().uuid() }).strict();

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
    const { user_id } = parsed.data;

    const authz = await authorizeTeamAction(admin, caller.userId, user_id);
    if (!authz.ok || !authz.target) {
      return jsonResponse(authz.status ?? 403, {
        success: false,
        error: authz.error ?? "Forbidden",
      });
    }

    const email = authz.target.email;
    if (!email) {
      return jsonResponse(400, {
        success: false,
        error: "This member has no email on file.",
      });
    }

    // A profile can exist without an auth user (e.g. an accepted lead never
    // onboarded). The setup link only works once the auth user exists, so signal
    // that case distinctly — the caller falls back to creating the account.
    const { data: authUser, error: getUserError } =
      await admin.auth.admin.getUserById(user_id);
    if (getUserError || !authUser?.user) {
      return jsonResponse(404, {
        success: false,
        error: "no_auth_user",
        message: "This member doesn't have an account yet.",
      });
    }

    const setup = await createOrRefreshSetupToken(admin, {
      userId: user_id,
      email,
      createdBy: caller.userId,
      enforceCap: true,
    });

    if (setup.capped) {
      return jsonResponse(429, {
        success: false,
        error: "resend_limit",
        message:
          "This setup link has been resent the maximum number of times. Contact an admin.",
      });
    }

    const sendResult = await sendSetupEmail(admin, {
      senderUserId: caller.userId,
      toEmail: email,
      imoId: authz.target.imo_id,
      setupLink: setup.link!,
    });

    return jsonResponse(200, {
      success: true,
      emailSent: sendResult.sent,
      emailVia: sendResult.via,
    });
  } catch (error) {
    console.error("[resend-account-setup] error:", error);
    return jsonResponse(400, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
