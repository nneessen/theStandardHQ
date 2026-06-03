// supabase/functions/sms-inbound-webhook/index.ts
// Twilio inbound SMS webhook — handles TCPA opt-out/in keywords and records
// them in the shared suppression list via RPC.
//
// NOTE: Twilio's Messaging Service "Advanced Opt-Out" also handles STOP at the
// carrier level; this webhook *additionally* records it in our own suppression
// table so that the send-sms pre-send gate and audit trail stay consistent.
//
// Required env vars:
//   SUPABASE_URL               — set automatically by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY  — set automatically by Supabase runtime
//   TWILIO_AUTH_TOKEN          — existing secret; used to verify signature
//   SMS_WEBHOOK_URL            — the public URL of THIS function (e.g.
//                                https://<project>.supabase.co/functions/v1/sms-inbound-webhook).
//                                Twilio signs the request using this URL, so it
//                                must match exactly what Twilio posts to. Set it
//                                in your Supabase project secrets.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// ---------------------------------------------------------------------------
// TwiML helpers
// ---------------------------------------------------------------------------

function twimlResponse(messageBody: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(messageBody)}</Message></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function twimlEmpty(): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// Twilio signature verification (HMAC-SHA1 over URL + sorted POST params)
// Spec: https://www.twilio.com/docs/usage/webhooks/webhooks-security
// ---------------------------------------------------------------------------

async function verifyTwilioSignature(
  authToken: string,
  webhookUrl: string,
  params: Record<string, string>,
  signature: string,
): Promise<boolean> {
  // Build the signed string: URL + sorted key=value pairs concatenated
  const sortedKeys = Object.keys(params).sort();
  let signedString = webhookUrl;
  for (const key of sortedKeys) {
    signedString += key + params[key];
  }

  const enc = new TextEncoder();
  const keyBytes = enc.encode(authToken);
  const msgBytes = enc.encode(signedString);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );

  const sigBytes = await crypto.subtle.sign("HMAC", cryptoKey, msgBytes);
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));

  return expected === signature;
}

// ---------------------------------------------------------------------------
// Keyword classification
// ---------------------------------------------------------------------------

type SmsKeyword = "stop" | "start" | "help" | "unknown";

const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
  "OPTOUT",
]);
const START_KEYWORDS = new Set(["START", "UNSTOP", "YES"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

function classifyKeyword(body: string): SmsKeyword {
  const first = body.trim().toUpperCase().split(/\s+/)[0] ?? "";
  if (STOP_KEYWORDS.has(first)) return "stop";
  if (START_KEYWORDS.has(first)) return "start";
  if (HELP_KEYWORDS.has(first)) return "help";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const SMS_WEBHOOK_URL = Deno.env.get("SMS_WEBHOOK_URL");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!TWILIO_AUTH_TOKEN || !SMS_WEBHOOK_URL) {
    console.error(
      "[sms-inbound-webhook] Missing required env vars: TWILIO_AUTH_TOKEN or SMS_WEBHOOK_URL",
    );
    return new Response("Internal Server Error", { status: 500 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[sms-inbound-webhook] Missing Supabase env vars");
    return new Response("Internal Server Error", { status: 500 });
  }

  // Parse the URL-encoded body
  const rawBody = await req.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(rawBody).entries()) {
    params[k] = v;
  }

  // Verify Twilio signature
  const twilioSignature = req.headers.get("X-Twilio-Signature") ?? "";
  const valid = await verifyTwilioSignature(
    TWILIO_AUTH_TOKEN,
    SMS_WEBHOOK_URL,
    params,
    twilioSignature,
  );

  if (!valid) {
    console.warn(
      "[sms-inbound-webhook] Invalid Twilio signature — rejecting request",
    );
    return new Response("Forbidden", { status: 403 });
  }

  const fromNumber = params["From"] ?? "";
  const body = params["Body"] ?? "";
  const messageSid = params["MessageSid"] ?? "";
  const accountSid = params["AccountSid"] ?? "";

  console.log("[sms-inbound-webhook] Verified inbound SMS:", {
    from: fromNumber,
    messageSid,
    accountSid,
    bodyPreview: body.substring(0, 30),
  });

  if (!fromNumber) {
    console.error("[sms-inbound-webhook] Missing From field in Twilio payload");
    return twimlEmpty();
  }

  const keyword = classifyKeyword(body);

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (keyword === "stop") {
    const { error } = await supabaseAdmin.rpc("add_suppression", {
      p_channel: "sms",
      p_contact: fromNumber,
      p_reason: "stop",
      p_imo_id: null,
      p_user_id: null,
      p_metadata: {
        source: "twilio_inbound",
        keyword: body.trim().toUpperCase().split(/\s+/)[0],
        message_sid: messageSid,
      },
    });

    if (error) {
      console.error(
        "[sms-inbound-webhook] add_suppression RPC error:",
        error.message,
      );
      // Still reply to the sender even if DB write failed
    } else {
      console.log(
        "[sms-inbound-webhook] Suppression recorded for:",
        fromNumber,
      );
    }

    return twimlResponse(
      "You have been unsubscribed and will receive no further texts from us. Reply START to opt back in.",
    );
  }

  if (keyword === "start") {
    const { error } = await supabaseAdmin.rpc("remove_suppression", {
      p_channel: "sms",
      p_contact: fromNumber,
    });

    if (error) {
      console.error(
        "[sms-inbound-webhook] remove_suppression RPC error:",
        error.message,
      );
    } else {
      console.log("[sms-inbound-webhook] Suppression removed for:", fromNumber);
    }

    return twimlResponse(
      "You have been re-subscribed and will receive texts from us again. Reply STOP at any time to unsubscribe.",
    );
  }

  if (keyword === "help") {
    return twimlResponse(
      "The Standard HQ: Reply STOP to unsubscribe from all texts, START to re-subscribe, or HELP for this message. For support contact nick@thestandardhq.com.",
    );
  }

  // Any other message — acknowledge receipt but do not auto-reply
  console.log("[sms-inbound-webhook] Non-keyword message, no-op:", {
    fromNumber,
    messageSid,
  });
  return twimlEmpty();
});
