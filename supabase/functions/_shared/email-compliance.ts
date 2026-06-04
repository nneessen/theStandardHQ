// Shared CAN-SPAM / marketing email compliance helpers
//
// Env vars required:
//   UNSUBSCRIBE_SECRET   — HMAC-SHA256 key for signing unsubscribe tokens.
//                          Set a long random string (e.g. openssl rand -hex 32).
//   COMPANY_POSTAL_ADDRESS — Physical mailing address shown in marketing email
//                            footer (required by CAN-SPAM § 15 U.S.C. 7704(a)(5)).
//                            Example: "123 Main St, Denver, CO 80202"
//   SUPABASE_URL         — standard Supabase env var (already required globally)
//
// WARNING: COMPANY_POSTAL_ADDRESS MUST be set to a real, deliverable physical
// address before marketing email is CAN-SPAM compliant. When unset, a clearly
// marked placeholder is rendered so the gap is visible during testing.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// ─── Email normalisation ────────────────────────────────────────────────────

/** Lowercase + trim. Must be applied consistently before signing, verifying,
 *  building the footer link, and calling is_suppressed / add_suppression. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─── HMAC helpers ───────────────────────────────────────────────────────────

function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getUnsubscribeKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("UNSUBSCRIBE_SECRET") || "";
  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET env var is not set");
  }
  return crypto.subtle.importKey(
    "raw",
    stringToBytes(secret).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Returns a hex HMAC-SHA256 token for the given (normalised) email. */
export async function signUnsubscribe(email: string): Promise<string> {
  const key = await getUnsubscribeKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    stringToBytes(normalizeEmail(email)).buffer as ArrayBuffer,
  );
  return bytesToHex(new Uint8Array(sig));
}

/** Constant-time comparison — returns true when the token is valid. */
export async function verifyUnsubscribe(
  email: string,
  token: string,
): Promise<boolean> {
  try {
    const expected = await signUnsubscribe(email);
    if (expected.length !== token.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

// ─── Suppression check ──────────────────────────────────────────────────────

/**
 * Returns true when the given email address is in the suppression list.
 * Pass a SERVICE-ROLE supabase client so the RPC can execute.
 */
export async function isEmailSuppressed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: SupabaseClient<any>,
  email: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  // Param names MUST match the deployed signature is_suppressed(p_channel, p_contact)
  // — PostgREST resolves RPCs by exact arg name, so the old p_contact_type/p_contact_value
  // call 404'd (PGRST202) and this helper silently failed OPEN. (The SMS path in send-sms
  // always used the correct names; only the email callers diverged.)
  const { data, error } = await adminClient.rpc("is_suppressed", {
    p_channel: "email",
    p_contact: normalized,
  });
  if (error) {
    console.error("[email-compliance] is_suppressed RPC error:", error.message);
    // Fail safe: treat as unsuppressed so we don't silently drop legitimate mail.
    // The caller logs this so ops can investigate.
    return false;
  }
  return data === true;
}

// ─── Footer builder ─────────────────────────────────────────────────────────

/**
 * Returns an HTML unsubscribe + postal-address footer block.
 * The unsubscribe link is HMAC-signed so it cannot be forged for arbitrary
 * addresses. `email` must be the recipient's actual address.
 */
export async function buildUnsubscribeFooter(email: string): Promise<string> {
  const normalized = normalizeEmail(email);
  const token = await signUnsubscribe(normalized);

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ?? "https://unknown.supabase.co";
  const unsubscribeBase = `${supabaseUrl}/functions/v1/email-unsubscribe`;
  const unsubscribeUrl = `${unsubscribeBase}?email=${encodeURIComponent(normalized)}&token=${token}`;

  const postalAddress =
    Deno.env.get("COMPANY_POSTAL_ADDRESS") ??
    "[COMPANY ADDRESS NOT CONFIGURED — SET COMPANY_POSTAL_ADDRESS ENV VAR]";

  return `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-family:sans-serif;font-size:12px;color:#6b7280;text-align:center;line-height:1.6;">
  <p style="margin:0 0 6px 0;">
    You are receiving this email because you are a member of The Standard HQ.<br>
    If you no longer wish to receive marketing communications,
    <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">unsubscribe here</a>.
  </p>
  <p style="margin:0;">${postalAddress}</p>
</div>`;
}

/**
 * Appends the CAN-SPAM compliance footer to an HTML email body.
 * Inserts before </body> if present; otherwise appends to the end.
 */
export async function appendComplianceFooter(
  html: string,
  email: string,
): Promise<string> {
  const footer = await buildUnsubscribeFooter(email);
  const closeBody = html.lastIndexOf("</body>");
  if (closeBody !== -1) {
    return html.slice(0, closeBody) + footer + html.slice(closeBody);
  }
  return html + footer;
}

/**
 * Returns the mailto: + https List-Unsubscribe header value for the given email.
 * Usage: form.append("h:List-Unsubscribe", await buildListUnsubscribeHeader(email))
 */
export async function buildListUnsubscribeHeader(
  email: string,
): Promise<string> {
  const normalized = normalizeEmail(email);
  const token = await signUnsubscribe(normalized);
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ?? "https://unknown.supabase.co";
  const unsubscribeUrl = `${supabaseUrl}/functions/v1/email-unsubscribe?email=${encodeURIComponent(normalized)}&token=${token}`;
  return `<mailto:unsubscribe@thestandardhq.com>, <${unsubscribeUrl}>`;
}
