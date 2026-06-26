// supabase/functions/send-password-reset/index.ts
//
// Sends password-reset emails. Uses the app-owned account-setup token system
// (a real 7-day /set-password/{token} link) instead of a Supabase recovery link,
// whose real lifetime was the project OTP/email-link expiry (the 72h `expiresIn`
// is silently ignored) and which email scanners could burn on pre-click.
//
// The token flow has NO session, so the user lands on the set-password form and
// can never be dropped onto the dashboard (the historical recovery-flow bug).
//
// In local Supabase (no Mailgun) it returns the link directly so the browser can
// redirect without Mailpit.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  getImoBrandName,
  resolveImoSenderUserId,
  sendViaConnectedGmail,
} from "../_shared/connected-gmail.ts";
import { createOrRefreshSetupToken } from "../_shared/account-setup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  redirectTo?: string;
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Preserved verbatim: useResendInvite (recruiting) and the admin reset path branch
// on this exact "No auth account found" string to fall back to creating the account.
function noAuthAccountResponse(email: string) {
  return jsonResponse(
    {
      success: false,
      error: `No auth account found for ${email}. This user exists in user_profiles but NOT in auth.users. They need to be created properly via the Add User flow.`,
    },
    404,
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
    const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");
    const SITE_URL =
      Deno.env.get("SITE_URL") || "https://www.thestandardhq.com";
    const isLocalSupabaseEnv =
      SUPABASE_URL?.includes("127.0.0.1") ||
      SUPABASE_URL?.includes("localhost");

    // Always use the canonical www host for the prod link base.
    const normalizedSiteUrl = SITE_URL.replace(
      "://thestandardhq.com",
      "://www.thestandardhq.com",
    );

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[send-password-reset] Missing Supabase credentials");
      return jsonResponse(
        { success: false, error: "Server configuration error" },
        500,
      );
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    const body: PasswordResetRequest = await req.json();
    const { email, redirectTo } = body;

    if (!email) {
      return jsonResponse({ success: false, error: "Email is required" }, 400);
    }

    const effectiveRedirectTo =
      redirectTo || `${normalizedSiteUrl}/auth/callback`;
    const requestUrl = new URL(req.url);
    const isLocalRequest =
      isLocalSupabaseEnv ||
      requestUrl.hostname === "127.0.0.1" ||
      requestUrl.hostname === "localhost" ||
      effectiveRedirectTo.includes("127.0.0.1") ||
      effectiveRedirectTo.includes("localhost");

    // Look up the target user. The token system needs the user's id, and we must
    // confirm an auth.users row exists (a user_profiles-only record cannot set a
    // password) — preserving the "No auth account found" diagnostic callers rely on.
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("id, imo_id")
      .ilike("email", email.trim())
      .limit(1)
      .maybeSingle();

    if (!profile?.id) {
      return noAuthAccountResponse(email);
    }

    const { data: authUser, error: authUserError } =
      await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (authUserError || !authUser?.user) {
      return noAuthAccountResponse(email);
    }

    // SECURITY: derive the link base ourselves. In prod always use the canonical
    // site (never the attacker-suppliable redirectTo host, which would leak the
    // token to an arbitrary domain). Only in local dev point at the local origin
    // so the token (stored in the local DB) resolves.
    let linkBase = normalizedSiteUrl;
    if (isLocalRequest) {
      try {
        const u = new URL(effectiveRedirectTo);
        if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
          linkBase = u.origin;
        }
      } catch {
        // fall through to normalizedSiteUrl
      }
    }

    const setup = await createOrRefreshSetupToken(supabaseAdmin, {
      userId: profile.id,
      email,
      createdBy: null,
      enforceCap: false,
      baseUrl: linkBase,
    });

    const resetLink = setup.link;
    if (!resetLink) {
      console.error("[send-password-reset] Failed to create setup token");
      return jsonResponse(
        { success: false, error: "Failed to generate reset link" },
        500,
      );
    }

    // Local dev (no Mailgun): hand the link back for a browser redirect.
    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      if (!isLocalRequest) {
        console.error("[send-password-reset] Missing Mailgun credentials");
        return jsonResponse(
          { success: false, error: "Email service not configured" },
          500,
        );
      }
      return jsonResponse({
        success: true,
        directReset: true,
        recoveryUrl: resetLink,
        message:
          "Local password reset link generated. Redirect the browser to complete the reset.",
      });
    }

    // Brand + send (IMO connected Gmail primary, Mailgun fallback).
    const brandName = await getImoBrandName(supabaseAdmin, profile.imo_id);
    const senderUserId = await resolveImoSenderUserId(
      supabaseAdmin,
      profile.imo_id,
    );
    const subject = `Reset Your Password - ${brandName}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Reset Your Password</h1>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #52525b;">
                You requested a password reset for your account at ${brandName}. Click the button below to set a new password.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 8px 0 24px;">
                    <a href="${resetLink}" style="display: inline-block; padding: 12px 32px; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #18181b; text-decoration: none; border-radius: 6px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 12px; line-height: 1.5; color: #a1a1aa; word-break: break-all;">
                ${resetLink}
              </p>
              <p style="margin: 0 0 24px; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                This link expires in 7 days.
              </p>
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px 24px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                © ${new Date().getFullYear()} ${brandName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const plainText = `
Reset Your Password

You requested a password reset for your account at ${brandName}.

Click this link to set a new password:
${resetLink}

This link expires in 7 days.

If you didn't request this password reset, you can safely ignore this email.

© ${new Date().getFullYear()} ${brandName}
    `.trim();

    // Primary: the IMO's connected Gmail.
    if (senderUserId) {
      const gmailResult = await sendViaConnectedGmail(
        senderUserId,
        email,
        subject,
        emailHtml,
        plainText,
      );
      if (gmailResult.success) {
        return jsonResponse({
          success: true,
          message: "Password reset email sent",
          via: "gmail",
        });
      }
      console.warn(
        "[send-password-reset] Connected Gmail unavailable, falling back to Mailgun:",
        { error: gmailResult.error, code: gmailResult.code || null },
      );
    }

    // Fallback: Mailgun.
    const form = new FormData();
    form.append("from", `${brandName} <noreply@${MAILGUN_DOMAIN}>`);
    form.append("to", email);
    form.append("subject", subject);
    form.append("html", emailHtml);
    form.append("text", plainText);
    form.append("o:tracking", "no");

    const credentials = `api:${MAILGUN_API_KEY}`;
    const base64Credentials = btoa(
      String.fromCharCode(...new TextEncoder().encode(credentials)),
    );

    const response = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${base64Credentials}` },
        body: form,
      },
    );

    const responseText = await response.text();
    if (!response.ok) {
      console.error("[send-password-reset] Mailgun API error:", responseText);
      return jsonResponse(
        { success: false, error: "Failed to send email" },
        500,
      );
    }

    let mailgunData;
    try {
      mailgunData = JSON.parse(responseText);
    } catch {
      mailgunData = { id: "unknown" };
    }

    return jsonResponse({
      success: true,
      message: "Password reset email sent",
      mailgunId: mailgunData.id,
      via: "mailgun",
    });
  } catch (err) {
    console.error("[send-password-reset] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ success: false, error: errorMessage }, 500);
  }
});
