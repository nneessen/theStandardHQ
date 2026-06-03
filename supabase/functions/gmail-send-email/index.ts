// supabase/functions/gmail-send-email/index.ts
// Send email via Gmail API using user's connected Gmail account
// Decrypts access token, builds RFC 2822 MIME message, sends via Gmail API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { decrypt } from "../_shared/encryption.ts";
import { getCorsHeaders, corsResponse } from "../_shared/cors.ts";

interface SendGmailRequest {
  userId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  // Threading
  threadId?: string; // Internal thread ID
  gmailThreadId?: string; // Gmail thread ID for replies
  messageIdHeader?: string; // Our generated Message-ID
  inReplyTo?: string; // Message-ID of email being replied to
  references?: string[]; // Chain of Message-IDs
}

interface GmailSendResponse {
  id: string; // Gmail message ID
  threadId: string; // Gmail thread ID
  labelIds: string[];
}

interface GmailIntegration {
  id: string;
  user_id: string;
  gmail_address: string;
  gmail_name: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  connection_status: string;
  is_active: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return corsResponse(req);
  }

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    console.log("[gmail-send-email] Function invoked");

    // Get environment variables
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[gmail-send-email] Missing Supabase credentials");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("[gmail-send-email] Missing Google OAuth credentials");
      return new Response(
        JSON.stringify({ success: false, error: "Gmail OAuth not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const body: SendGmailRequest = await req.json();
    console.log("[gmail-send-email] Request:", {
      userId: body.userId,
      to: body.to,
      subject: body.subject?.substring(0, 30),
      hasHtml: !!body.html,
      gmailThreadId: body.gmailThreadId,
    });

    const {
      userId,
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      replyTo,
      gmailThreadId,
      messageIdHeader,
      inReplyTo,
      references,
    } = body;

    // Validate required fields
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing userId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // =========================================================================
    // AUTHORIZATION — dual gate
    // (a) Internal edge-to-edge callers (e.g. process-workflow) pass the
    //     service-role key as a Bearer token — trusted, may send as any user.
    // (b) Otherwise require a valid user JWT and FORCE caller.id === body.userId
    //     so a user can only ever send email as themselves (no impersonation).
    // =========================================================================
    const authHeader = req.headers.get("Authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!bearer) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isServiceRole = bearer === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceRole) {
      // User-JWT path: verify the token and require it match body.userId.
      const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: authData, error: authErr } =
        await authClient.auth.getUser(bearer);

      if (authErr || !authData?.user) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid or expired token" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (authData.user.id !== userId) {
        console.error(
          "[gmail-send-email] Forbidden: caller may only send as themselves",
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "Forbidden: you may only send email as yourself",
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    if (!to || to.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'to' recipients" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!subject) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'subject'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!html) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'html' body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // =========================================================================
    // Step 1: Get Gmail integration for this user
    // =========================================================================
    const { data: integration, error: integrationError } = await supabase
      .from("gmail_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .single();

    if (integrationError || !integration) {
      console.error(
        "[gmail-send-email] No active Gmail integration:",
        integrationError,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "Gmail not connected",
          code: "NOT_CONNECTED",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const gmailIntegration = integration as GmailIntegration;
    console.log(
      `[gmail-send-email] Found integration for: ${gmailIntegration.gmail_address}`,
    );

    // =========================================================================
    // Step 2: Decrypt access token and check expiry
    // =========================================================================
    let accessToken: string;
    try {
      accessToken = await decrypt(gmailIntegration.access_token_encrypted);
    } catch (decryptError) {
      console.error(
        "[gmail-send-email] Failed to decrypt token:",
        decryptError,
      );

      // Mark integration as error state
      await supabase
        .from("gmail_integrations")
        .update({
          connection_status: "error",
          last_error: "Failed to decrypt access token",
          last_error_at: new Date().toISOString(),
        })
        .eq("id", gmailIntegration.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Gmail token decryption failed",
          code: "TOKEN_ERROR",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if token is expired (with 1 minute buffer)
    const tokenExpiry = new Date(gmailIntegration.token_expires_at);
    if (tokenExpiry.getTime() < Date.now() + 60000) {
      console.log(
        "[gmail-send-email] Token expired or expiring soon, refreshing...",
      );

      // Attempt to refresh the token
      const refreshResult = await refreshAccessToken(
        supabase as unknown as ReturnType<typeof createClient>,
        gmailIntegration,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
      );

      if (!refreshResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Gmail token expired. Please reconnect.",
            code: "TOKEN_EXPIRED",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      accessToken = refreshResult.accessToken;
    }

    // =========================================================================
    // Step 3: Build RFC 2822 MIME message
    // =========================================================================
    const fromAddress = gmailIntegration.gmail_name
      ? `${gmailIntegration.gmail_name} <${gmailIntegration.gmail_address}>`
      : gmailIntegration.gmail_address;

    // Generate Message-ID if not provided
    const finalMessageId =
      messageIdHeader || `<${crypto.randomUUID()}@gmail.com>`;

    // Build MIME message
    const mimeMessage = buildMimeMessage({
      from: fromAddress,
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      replyTo: replyTo || gmailIntegration.gmail_address,
      messageId: finalMessageId,
      inReplyTo,
      references,
    });

    // Base64url encode for Gmail API
    const encodedMessage = base64UrlEncode(mimeMessage);

    // =========================================================================
    // Step 4: Send via Gmail API
    // =========================================================================
    console.log("[gmail-send-email] Sending via Gmail API...");

    const sendUrl =
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    const sendBody: { raw: string; threadId?: string } = {
      raw: encodedMessage,
    };

    // If replying to a Gmail thread, include threadId
    if (gmailThreadId) {
      sendBody.threadId = gmailThreadId;
    }

    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBody),
    });

    const responseText = await sendResponse.text();
    console.log(
      "[gmail-send-email] Gmail API response status:",
      sendResponse.status,
    );

    if (!sendResponse.ok) {
      console.error("[gmail-send-email] Gmail API error:", responseText);

      // Check for specific error types
      if (sendResponse.status === 401) {
        // Token invalid - mark integration for reconnection
        await supabase
          .from("gmail_integrations")
          .update({
            connection_status: "expired",
            last_error: "Access token rejected by Gmail",
            last_error_at: new Date().toISOString(),
          })
          .eq("id", gmailIntegration.id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Gmail authentication failed. Please reconnect.",
            code: "AUTH_FAILED",
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `Gmail API error: ${sendResponse.status}`,
          details: responseText.substring(0, 200),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const gmailResponse: GmailSendResponse = JSON.parse(responseText);
    console.log("[gmail-send-email] Email sent successfully:", {
      gmailMessageId: gmailResponse.id,
      gmailThreadId: gmailResponse.threadId,
    });

    // Update API call tracking
    await supabase
      .from("gmail_integrations")
      .update({
        api_calls_today:
          (gmailIntegration as unknown as { api_calls_today: number })
            .api_calls_today + 1,
      })
      .eq("id", gmailIntegration.id);

    // Log the send operation
    await supabase.from("gmail_sync_log").insert({
      integration_id: gmailIntegration.id,
      sync_type: "send",
      messages_synced: 1,
      status: "success",
    });

    return new Response(
      JSON.stringify({
        success: true,
        messageId: finalMessageId,
        gmailMessageId: gmailResponse.id,
        gmailThreadId: gmailResponse.threadId,
        provider: "gmail",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[gmail-send-email] Unexpected error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// =========================================================================
// Helper: Build RFC 2822 MIME message
// =========================================================================
interface MimeMessageParams {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
}

function buildMimeMessage(params: MimeMessageParams): string {
  const {
    from,
    to,
    cc,
    bcc: _bcc, // BCC not included in MIME headers by design, Gmail handles via envelope
    subject,
    html,
    text,
    replyTo,
    messageId,
    inReplyTo,
    references,
  } = params;

  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  const plainText = text || stripHtml(html);

  // Build headers
  const headers: string[] = [
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    `Subject: ${encodeSubject(subject)}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
  ];

  if (cc && cc.length > 0) {
    headers.push(`Cc: ${cc.join(", ")}`);
  }

  // Note: BCC handled by Gmail via envelope, not in MIME headers

  if (replyTo) {
    headers.push(`Reply-To: ${replyTo}`);
  }

  if (inReplyTo) {
    headers.push(`In-Reply-To: ${inReplyTo}`);
  }

  if (references && references.length > 0) {
    headers.push(`References: ${references.join(" ")}`);
  }

  // Multipart alternative for HTML + plain text
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  // Build message body
  const bodyParts: string[] = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    encodeQuotedPrintable(plainText),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    encodeQuotedPrintable(html),
    ``,
    `--${boundary}--`,
  ];

  return headers.join("\r\n") + "\r\n\r\n" + bodyParts.join("\r\n");
}

// =========================================================================
// Helper: Encode subject line (RFC 2047 for non-ASCII)
// =========================================================================
function encodeSubject(subject: string): string {
  // Check if subject has non-ASCII characters (outside printable ASCII range)
  // eslint-disable-next-line no-control-regex
  const hasNonAscii = /[^\u0000-\u007F]/.test(subject);

  if (hasNonAscii) {
    // Use base64 encoding for non-ASCII subjects
    const encoder = new TextEncoder();
    const bytes = encoder.encode(subject);
    const base64 = btoa(String.fromCharCode(...bytes));
    return `=?UTF-8?B?${base64}?=`;
  }

  return subject;
}

// =========================================================================
// Helper: Quoted-printable encoding
// =========================================================================
function encodeQuotedPrintable(text: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  let line = "";
  let result = "";

  for (const byte of bytes) {
    let encoded: string;

    if (byte === 13 || byte === 10) {
      // CR/LF: flush current line and emit the line break
      result += line + String.fromCharCode(byte);
      line = "";
      continue;
    } else if (byte === 9) {
      // Tab: keep as-is
      encoded = "\t";
    } else if (byte >= 33 && byte <= 126 && byte !== 61) {
      // Printable ASCII (except '=')
      encoded = String.fromCharCode(byte);
    } else if (byte === 32) {
      // Space
      encoded = " ";
    } else {
      // Everything else: encode as =XX
      encoded = "=" + byte.toString(16).toUpperCase().padStart(2, "0");
    }

    // Soft line break at 76 chars per RFC 2045
    if (line.length + encoded.length > 75) {
      result += line + "=\r\n";
      line = "";
    }

    line += encoded;
  }

  result += line;
  return result;
}

// =========================================================================
// Helper: Base64URL encoding (Gmail API requirement)
// =========================================================================
function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const base64 = btoa(String.fromCharCode(...bytes));
  // Convert to base64url (URL-safe base64)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// =========================================================================
// Helper: Strip HTML tags for plain text version
// =========================================================================

/**
 * Safely decode a numeric HTML entity to a character
 * SECURITY: Filters out control characters and bidi override characters
 * that could be used for text spoofing or injection attacks
 */
function safeDecodeEntity(codePoint: number): string {
  // Block ASCII control characters (except tab, newline, carriage return)
  if (
    codePoint < 32 &&
    codePoint !== 9 &&
    codePoint !== 10 &&
    codePoint !== 13
  ) {
    return "";
  }
  // Block DEL character
  if (codePoint === 127) {
    return "";
  }
  // Block Unicode bidirectional override characters (text spoofing)
  // LRE, RLE, PDF, LRO, RLO
  if (codePoint >= 0x202a && codePoint <= 0x202e) {
    return "";
  }
  // Block Unicode bidirectional isolate characters
  // LRI, RLI, FSI, PDI
  if (codePoint >= 0x2066 && codePoint <= 0x2069) {
    return "";
  }
  // Block zero-width characters that could be used for spoofing
  if (
    codePoint === 0x200b || // Zero-width space
    codePoint === 0x200c || // Zero-width non-joiner
    codePoint === 0x200d || // Zero-width joiner
    codePoint === 0xfeff // Zero-width no-break space (BOM)
  ) {
    return "";
  }
  // Block invalid Unicode (surrogate pairs when used directly)
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
    return "";
  }
  // Block code points beyond valid Unicode range
  if (codePoint > 0x10ffff) {
    return "";
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return ""; // Invalid code point
  }
}

function stripHtml(html: string): string {
  return (
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      // Named entities (order matters: &amp; must be decoded last to handle double-encoding)
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#8217;/g, "'") // Right single quotation mark (')
      .replace(/&#8216;/g, "'") // Left single quotation mark (')
      .replace(/&rsquo;/g, "'")
      .replace(/&lsquo;/g, "'")
      .replace(/&#8220;/g, '"') // Left double quotation mark (")
      .replace(/&#8221;/g, '"') // Right double quotation mark (")
      .replace(/&ldquo;/g, '"')
      .replace(/&rdquo;/g, '"')
      // Decode remaining numeric entities with validation
      .replace(/&#(\d+);/g, (_, dec) => safeDecodeEntity(parseInt(dec, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        safeDecodeEntity(parseInt(hex, 16)),
      )
      // Decode &amp; last to handle double-encoded entities like &amp;#39;
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// =========================================================================
// Helper: Refresh access token using refresh token
// =========================================================================
interface RefreshResult {
  success: boolean;
  accessToken: string;
}

async function refreshAccessToken(
  supabase: ReturnType<typeof createClient>,
  integration: GmailIntegration,
  clientId: string,
  clientSecret: string,
): Promise<RefreshResult> {
  try {
    // Decrypt refresh token
    const refreshToken = await decrypt(integration.refresh_token_encrypted);

    // Exchange refresh token for new access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error(
        "[gmail-send-email] Token refresh failed:",
        tokenData.error,
      );

      // Mark integration as expired
      await supabase
        .from("gmail_integrations")
        .update({
          connection_status: "expired",
          last_error: `Token refresh failed: ${tokenData.error || "No access token"}`,
          last_error_at: new Date().toISOString(),
        })
        .eq("id", integration.id);

      return { success: false, accessToken: "" };
    }

    // Import encrypt function dynamically to avoid circular issues
    const { encrypt } = await import("../_shared/encryption.ts");

    // Encrypt and store new access token
    const encryptedAccessToken = await encrypt(tokenData.access_token);
    const tokenExpiresAt = new Date(
      Date.now() + (tokenData.expires_in || 3600) * 1000,
    );

    await supabase
      .from("gmail_integrations")
      .update({
        access_token_encrypted: encryptedAccessToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        last_refresh_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    console.log("[gmail-send-email] Token refreshed successfully");
    return { success: true, accessToken: tokenData.access_token };
  } catch (err) {
    console.error("[gmail-send-email] Token refresh error:", err);
    return { success: false, accessToken: "" };
  }
}
