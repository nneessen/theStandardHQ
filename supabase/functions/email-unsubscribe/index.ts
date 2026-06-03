// CAN-SPAM Unsubscribe Handler
// GET /email-unsubscribe?email=<addr>&token=<hmac>
// verify_jwt = false (link is hit directly from an email client)
//
// 1. Validates the HMAC token (UNSUBSCRIBE_SECRET).
// 2. Calls add_suppression('email', normalizedEmail, 'unsubscribe') via service-role client.
// 3. Returns a simple HTML confirmation page.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import {
  normalizeEmail,
  verifyUnsubscribe,
} from "../_shared/email-compliance.ts";

serve(async (req) => {
  // Only GET is meaningful here; OPTIONS is irrelevant for a link target but
  // guard it anyway to avoid confusing 405s from automated crawlers.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const rawEmail = url.searchParams.get("email") ?? "";
  const token = url.searchParams.get("token") ?? "";

  if (!rawEmail || !token) {
    return htmlResponse(
      400,
      "Bad Request",
      "Missing email or token parameter.",
    );
  }

  // Normalise before verification — must match what signUnsubscribe signed.
  const email = normalizeEmail(rawEmail);

  const valid = await verifyUnsubscribe(email, token);
  if (!valid) {
    return htmlResponse(
      400,
      "Invalid Link",
      "This unsubscribe link is invalid or has expired.",
    );
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.rpc("add_suppression", {
      p_contact_type: "email",
      p_contact_value: email,
      p_reason: "unsubscribe",
    });

    if (error) {
      console.error(
        "[email-unsubscribe] add_suppression error:",
        error.message,
      );
      return htmlResponse(
        500,
        "Error",
        "We encountered an error processing your request. Please try again.",
      );
    }

    console.log(`[email-unsubscribe] Suppressed ${email}`);

    return htmlResponse(
      200,
      "Unsubscribed",
      `You have been unsubscribed. The address <strong>${escapeHtml(email)}</strong> will no longer receive marketing email from The Standard HQ.`,
    );
  } catch (err) {
    console.error("[email-unsubscribe] Unexpected error:", err);
    return htmlResponse(
      500,
      "Error",
      "An unexpected error occurred. Please try again.",
    );
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlResponse(
  status: number,
  title: string,
  message: string,
): Response {
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} — The Standard HQ</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}
    .card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:40px;max-width:480px;width:90%;text-align:center}
    h1{font-size:1.25rem;margin:0 0 12px;color:#111827}
    p{color:#6b7280;font-size:0.95rem;margin:0}
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
