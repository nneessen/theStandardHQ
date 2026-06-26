// supabase/functions/_shared/account-setup.ts
//
// Shared helpers for the app-controlled "set your password" onboarding link.
//
// Replaces the old Supabase recovery link (auth.admin.generateLink type:recovery),
// whose real lifetime was governed by the project OTP/email-link expiry (NOT the
// 72h `expiresIn` the code passed — that option is silently ignored) and which was
// single-use, so email scanners pre-clicking it burned the token. The app-owned
// token (account_setup_tokens) has a real 7-day expiry and read-only validation.
//
// Used by create-auth-user (initial link) and resend-account-setup (resend).

import { getImoBrandName, sendViaConnectedGmail } from "./connected-gmail.ts";

// The edge functions use the service-role client without generated Deno DB types.
// deno-lint-ignore no-explicit-any
type SupabaseAdminClient = any;

const SETUP_LINK_EXPIRY_COPY = "7 days";

/** Build the "Welcome — Set Your Password" email (HTML + text). */
export function buildSetupEmail(
  setupLink: string,
  brandName: string,
): { subject: string; html: string; text: string } {
  const subject = `Welcome - Set Your Password | ${brandName}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome - Set Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 32px 24px;">
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #18181b;">Welcome to ${brandName}!</h1>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #52525b;">
                Your account has been created. Click the button below to set your password and get started.
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.5; color: #dc2626; font-weight: 500;">
                ⚠️ This link expires in ${SETUP_LINK_EXPIRY_COPY}. Please set your password soon.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding: 8px 0 24px;">
                    <a href="${setupLink}" style="display: inline-block; padding: 12px 32px; font-size: 14px; font-weight: 600; color: #ffffff; background-color: #18181b; text-decoration: none; border-radius: 6px;">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: #71717a;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 12px; line-height: 1.5; color: #a1a1aa; word-break: break-all;">
                ${setupLink}
              </p>
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px 24px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                ${brandName}. All rights reserved.
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

  const text = `
Welcome to ${brandName}!

Your account has been created. Click this link to set your password:
${setupLink}

IMPORTANT: This link expires in ${SETUP_LINK_EXPIRY_COPY}. Please set your password soon.

If you didn't expect this email, you can safely ignore it.

${brandName}
  `.trim();

  return { subject, html, text };
}

/**
 * Create or rotate the user's setup token and return the /set-password link.
 * - enforceCap=false for the initial create (create-auth-user).
 * - enforceCap=true for resends (caps at 5, like resend_recruit_invitation).
 * Returns { capped: true } when the resend cap is hit.
 */
export async function createOrRefreshSetupToken(
  admin: SupabaseAdminClient,
  opts: {
    userId: string;
    email: string;
    createdBy?: string | null;
    enforceCap?: boolean;
  },
): Promise<{ capped: boolean; link?: string; resendCount?: number }> {
  const siteUrl = Deno.env.get("SITE_URL") || "https://www.thestandardhq.com";
  const { data, error } = await admin.rpc("upsert_account_setup_token", {
    p_user_id: opts.userId,
    p_email: opts.email,
    p_created_by: opts.createdBy ?? null,
    p_enforce_cap: opts.enforceCap ?? false,
  });

  if (error) throw error;
  if (data?.capped) {
    return { capped: true, resendCount: data.resend_count };
  }
  return {
    capped: false,
    link: `${siteUrl}/set-password/${data.token}`,
    resendCount: data.resend_count,
  };
}

async function sendViaMailgun(
  to: string,
  subject: string,
  html: string,
  text: string,
  brandName: string,
  mailgunApiKey: string,
  mailgunDomain: string,
): Promise<boolean> {
  try {
    const form = new FormData();
    form.append("from", `${brandName} <noreply@${mailgunDomain}>`);
    form.append("to", to);
    form.append("subject", subject);
    form.append("html", html);
    form.append("text", text);
    form.append("o:tracking", "no");

    const credentials = `api:${mailgunApiKey}`;
    const encoder = new TextEncoder();
    const base64Credentials = btoa(
      String.fromCharCode(...encoder.encode(credentials)),
    );

    const response = await fetch(
      `https://api.mailgun.net/v3/${mailgunDomain}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${base64Credentials}` },
        body: form,
      },
    );

    if (!response.ok) {
      console.error(
        "[account-setup] Mailgun error:",
        response.status,
        await response.text(),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[account-setup] Mailgun send error:", err);
    return false;
  }
}

/**
 * Send the setup email: primary = the acting user's connected Gmail (real person),
 * fallback = Mailgun. Mirrors the create-auth-user delivery path.
 */
export async function sendSetupEmail(
  admin: SupabaseAdminClient,
  opts: {
    senderUserId: string;
    toEmail: string;
    imoId: string | null | undefined;
    setupLink: string;
  },
): Promise<{ sent: boolean; via: "gmail" | "mailgun" | null }> {
  const brandName = await getImoBrandName(admin, opts.imoId);
  const { subject, html, text } = buildSetupEmail(opts.setupLink, brandName);

  const gmail = await sendViaConnectedGmail(
    opts.senderUserId,
    opts.toEmail,
    subject,
    html,
    text,
  );
  if (gmail.success) return { sent: true, via: "gmail" };

  const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
  const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.error(
      "[account-setup] Gmail unavailable and Mailgun not configured; email not sent",
    );
    return { sent: false, via: null };
  }

  const ok = await sendViaMailgun(
    opts.toEmail,
    subject,
    html,
    text,
    brandName,
    MAILGUN_API_KEY,
    MAILGUN_DOMAIN,
  );
  return { sent: ok, via: ok ? "mailgun" : null };
}
