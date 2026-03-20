// supabase/functions/send-password-reset/index.ts
// Sends password reset emails via Mailgun in hosted environments.
// In local Supabase, it returns a direct recovery link so the browser can enter
// the password reset flow without relying on Mailpit.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

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

function buildGenerateLinkErrorResponse(
  linkError: { message?: string; code?: string },
  email: string,
) {
  console.error("[send-password-reset] Failed to generate link:", linkError);

  const errorCode = linkError.code;
  const isUserNotFound =
    errorCode === "user_not_found" ||
    linkError.message?.includes("User not found") ||
    linkError.message?.includes("not found");

  if (isUserNotFound) {
    return jsonResponse(
      {
        success: false,
        error: `No auth account found for ${email}. This user exists in user_profiles but NOT in auth.users. They need to be created properly via the Add User flow.`,
      },
      404,
    );
  }

  return jsonResponse(
    { success: false, error: linkError.message || "Failed to generate link" },
    400,
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get credentials
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
    const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");
    const SITE_URL =
      Deno.env.get("SITE_URL") || "https://www.thestandardhq.com";
    const isLocalSupabaseEnv =
      SUPABASE_URL?.includes("127.0.0.1") ||
      SUPABASE_URL?.includes("localhost");

    // Normalize to canonical URL (always use www for consistency)
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
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const body: PasswordResetRequest = await req.json();
    const { email, redirectTo } = body;

    if (!email) {
      return jsonResponse({ success: false, error: "Email is required" }, 400);
    }

    // Determine the redirect URL - use provided or default to normalized site URL
    const effectiveRedirectTo =
      redirectTo || `${normalizedSiteUrl}/auth/callback`;
    const requestUrl = new URL(req.url);
    const isLocalRequest =
      isLocalSupabaseEnv ||
      requestUrl.hostname === "127.0.0.1" ||
      requestUrl.hostname === "localhost" ||
      effectiveRedirectTo.includes("127.0.0.1") ||
      effectiveRedirectTo.includes("localhost");

    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      if (!isLocalRequest) {
        console.error("[send-password-reset] Missing Mailgun credentials");
        return jsonResponse(
          {
            success: false,
            error: "Email service not configured",
          },
          500,
        );
      }

      const { data: localLinkData, error: localLinkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: effectiveRedirectTo,
            expiresIn: 3600,
          },
        });

      if (localLinkError) {
        return buildGenerateLinkErrorResponse(localLinkError, email);
      }

      const recoveryUrl = localLinkData?.properties?.action_link;

      if (!recoveryUrl) {
        console.error(
          "[send-password-reset] No local recovery action link in response",
        );
        return jsonResponse(
          {
            success: false,
            error: "Failed to generate local reset link",
          },
          500,
        );
      }

      return jsonResponse({
        success: true,
        directReset: true,
        recoveryUrl,
        message:
          "Local password reset link generated. Redirect the browser to complete the reset.",
      });
    }

    // Generate password reset link using Supabase Admin SDK
    // Use /auth/callback as redirect - it's whitelisted and handles recovery type
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: email,
        options: {
          redirectTo: effectiveRedirectTo,
          expiresIn: 259200, // 72 hours in seconds
        },
      });

    if (linkError) {
      return buildGenerateLinkErrorResponse(linkError, email);
    }

    if (!linkData?.properties?.action_link) {
      console.error("[send-password-reset] No action link in response");
      return jsonResponse(
        {
          success: false,
          error: "Failed to generate reset link",
        },
        500,
      );
    }

    const resetLink = linkData.properties.action_link;

    // Build the email HTML
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
                You requested a password reset for your account at The Standard HQ. Click the button below to set a new password.
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
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px 24px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                © ${new Date().getFullYear()} The Standard HQ. All rights reserved.
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

You requested a password reset for your account at The Standard HQ.

Click this link to set a new password:
${resetLink}

If you didn't request this password reset, you can safely ignore this email.

© ${new Date().getFullYear()} The Standard HQ
    `.trim();

    // Send via Mailgun API
    const form = new FormData();
    form.append("from", `The Standard HQ <noreply@${MAILGUN_DOMAIN}>`);
    form.append("to", email);
    form.append("subject", "Reset Your Password - The Standard HQ");
    form.append("html", emailHtml);
    form.append("text", plainText);
    form.append("o:tracking", "no"); // Don't track password reset emails for privacy

    const mailgunUrl = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`;

    const credentials = `api:${MAILGUN_API_KEY}`;
    const encoder = new TextEncoder();
    const credentialsBytes = encoder.encode(credentials);
    const base64Credentials = btoa(String.fromCharCode(...credentialsBytes));

    const response = await fetch(mailgunUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${base64Credentials}`,
      },
      body: form,
    });

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
    });
  } catch (err) {
    console.error("[send-password-reset] Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    return jsonResponse({ success: false, error: errorMessage }, 500);
  }
});
