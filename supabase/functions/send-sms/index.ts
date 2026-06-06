// supabase/functions/send-sms/index.ts
// Send SMS Edge Function - Sends SMS messages via Twilio API
// AUTH: Requires valid authenticated session or service_role key match.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendSmsRequest {
  to: string; // Phone number (will be normalized to E.164)
  message: string; // SMS body content
  // Optional metadata for logging
  recruitId?: string;
  automationId?: string;
  trigger?: string;
}

interface SendSmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  // Twilio's real failure details, surfaced so callers/humans can act (was previously masked).
  errorCode?: number;
  errorMessage?: string;
}

interface TwilioMessageResponse {
  sid: string;
  status: string;
  // Twilio's REST error JSON uses `code` + `message` (NOT error_code/error_message — those names
  // are wrong and were always undefined, which is why real failures came back as an opaque string).
  // Kept the old optional fields for safety, but `code`/`message` are the ones Twilio actually sends.
  code?: number;
  message?: string;
  error_code?: number;
  error_message?: string;
}

const ALLOWED_KEYS = new Set([
  "to",
  "message",
  "recruitId",
  "automationId",
  "trigger",
]);

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;

  const cleaned = phone.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    if (cleaned.length >= 11 && cleaned.length <= 15) {
      return cleaned;
    }
    return null;
  }

  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  return null;
}

/**
 * Validate E.164 phone number format
 */
function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[send-sms] Function invoked");

    // Build a service-role admin client early — needed for both auth verification
    // and the TCPA suppression check before sending.
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error",
        } as SendSmsResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );

    // ========== AUTH CHECK ==========
    // Two valid callers:
    // 1. service_role: edge-to-edge calls (e.g. slack-policy-notification) — verify by exact key match
    // 2. authenticated user: any logged-in user (staff, agents, recruits) — verify via getUser()
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized",
        } as SendSmsResponse),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const bearerToken = authHeader.slice(7);

    if (bearerToken === SUPABASE_SERVICE_ROLE_KEY) {
      // Exact match against the known service_role key — trusted server-to-server call
      console.log("[send-sms] Auth: service_role verified");
    } else {
      // Must be a valid authenticated user session
      // getUser() verifies the JWT signature server-side against Supabase's signing key
      const { data: userData, error: userError } =
        await supabaseAdmin.auth.getUser(bearerToken);
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Unauthorized",
          } as SendSmsResponse),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      console.log("[send-sms] Auth: user verified, id:", userData.user.id);
    }
    // ========== END AUTH CHECK ==========

    // Get Twilio credentials
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER =
      Deno.env.get("MY_TWILIO_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER");

    console.log("[send-sms] Env check:", {
      hasAccountSid: !!TWILIO_ACCOUNT_SID,
      hasAuthToken: !!TWILIO_AUTH_TOKEN,
      hasPhoneNumber: !!TWILIO_PHONE_NUMBER,
    });

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.error("[send-sms] Missing Twilio credentials");
      return new Response(
        JSON.stringify({
          success: false,
          error: "SMS service not configured",
        } as SendSmsResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normalize the Twilio phone number (from number)
    const fromNumber = normalizePhoneNumber(TWILIO_PHONE_NUMBER);
    if (!fromNumber) {
      console.error("[send-sms] Invalid Twilio phone number configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid SMS service configuration",
        } as SendSmsResponse),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body: SendSmsRequest = await req.json();

    // Reject unknown keys
    const unknownKeys = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k));
    if (unknownKeys.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unknown fields in request",
        } as SendSmsResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[send-sms] Request received:", {
      hasRecipient: !!body.to,
      messageLength: body.message?.length,
      trigger: body.trigger,
    });

    const { to, message, trigger } = body;

    // Validate required fields
    if (!to) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing 'to' phone number",
        } as SendSmsResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!message || message.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing 'message' body",
        } as SendSmsResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normalize the recipient phone number
    const toNumber = normalizePhoneNumber(to);
    if (!toNumber || !isValidE164(toNumber)) {
      console.error("[send-sms] Invalid phone number format");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid phone number format",
        } as SendSmsResponse),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ========== TCPA SUPPRESSION GATE ==========
    // Check suppression list BEFORE sending. Fail-open on RPC errors (infra faults
    // should not block all SMS), but fail-closed when suppressed=true.
    {
      const { data: suppressed, error: suppressionError } =
        await supabaseAdmin.rpc("is_suppressed", {
          p_channel: "sms",
          p_contact: toNumber,
        });

      if (suppressionError) {
        // Infra fault — log and fail-open (continue to send)
        console.warn(
          "[send-sms] Suppression check RPC error (fail-open):",
          suppressionError.message,
        );
      } else if (suppressed === true) {
        console.log(
          "[send-sms] Recipient is suppressed (TCPA opt-out), blocking send:",
          { toNumber },
        );
        return new Response(
          JSON.stringify({
            success: false,
            suppressed: true,
            error: "Recipient has opted out of SMS (STOP)",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }
    // ========== END SUPPRESSION GATE ==========

    // Build Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("To", toNumber);
    formData.append("From", fromNumber);
    formData.append("Body", message);

    const statusCallbackUrl = Deno.env.get("TWILIO_STATUS_CALLBACK_URL");
    if (statusCallbackUrl) {
      formData.append("StatusCallback", statusCallbackUrl);
    }

    console.log("[send-sms] Sending to Twilio:", {
      hasRecipient: true,
      messagePreview: message.substring(0, 50),
    });

    // Send via Twilio API
    const credentials = `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`;
    const encoder = new TextEncoder();
    const credentialsBytes = encoder.encode(credentials);
    const base64Credentials = btoa(String.fromCharCode(...credentialsBytes));

    let response: Response;
    let data: TwilioMessageResponse;

    try {
      response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${base64Credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const responseText = await response.text();
      console.log("[send-sms] Twilio response:", {
        status: response.status,
        statusText: response.statusText,
      });

      try {
        data = JSON.parse(responseText);
      } catch {
        // Twilio returns JSON even for errors, so a non-JSON/empty body means something upstream
        // (empty response, an HTML gateway/error page, a credential or transport problem). Surface
        // the raw HTTP status + body so the failure is diagnosable instead of an opaque string.
        console.error("[send-sms] Twilio response not JSON:", {
          status: response.status,
          bodyPreview: responseText.slice(0, 300),
        });
        return new Response(
          JSON.stringify({
            success: false,
            error: "SMS service error",
            twilioStatus: response.status,
            twilioBody: responseText.slice(0, 300),
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } catch (fetchError) {
      console.error("[send-sms] Fetch to Twilio failed:", fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to connect to SMS service",
        } as SendSmsResponse),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Surface the REAL Twilio failure instead of masking it. Twilio returns a numeric error_code
    // + human error_message (e.g. 21610 = recipient previously texted STOP, 21614 = not an
    // SMS-capable number, 30034 = unregistered A2P 10DLC, 21408 = region not enabled). Callers and
    // humans need the code to act — hiding it behind a generic string is what made this delivery
    // failure undiagnosable. Backward compatible: success/error are unchanged; the details are added.
    const twilioCode = data.code ?? data.error_code;
    const twilioMessage = data.message ?? data.error_message;
    if (!response.ok || twilioCode) {
      console.error("[send-sms] Twilio API error:", {
        status: response.status,
        errorCode: twilioCode,
        errorMessage: twilioMessage,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "SMS service error",
          errorCode: twilioCode,
          errorMessage: twilioMessage,
        } as SendSmsResponse),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[send-sms] SMS sent successfully:", {
      sid: data.sid,
      status: data.status,
      hasRecipient: true,
      trigger,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: data.sid } as SendSmsResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[send-sms] Unexpected error:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Something went wrong",
      } as SendSmsResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
