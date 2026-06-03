// File: /home/nneessen/projects/commissionTracker/supabase/functions/inbound-email/index.ts
// Inbound Email Webhook - Handles incoming emails from Mailgun

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Allowed MIME types for attachments (security: prevent executable uploads)
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

interface _MailgunWebhookPayload {
  // Sender info
  sender: string;
  from: string;
  // Recipient info
  recipient: string;
  // Email content
  subject: string;
  "body-plain"?: string;
  "body-html"?: string;
  "stripped-text"?: string;
  "stripped-html"?: string;
  // Threading headers
  "Message-Id"?: string;
  "In-Reply-To"?: string;
  References?: string;
  // Metadata
  timestamp: string;
  token: string;
  signature: string;
  // Attachments info
  "attachment-count"?: string;
  "content-id-map"?: string;
}

// Sanitize HTML to prevent XSS attacks
// Removes script tags, event handlers, and dangerous attributes
function sanitizeHtml(html: string): string {
  if (!html) return "";

  return (
    html
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove style tags and their content (can contain expressions)
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      // Remove all event handlers (onclick, onerror, onload, etc.)
      .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\s*on\w+\s*=\s*[^\s>]+/gi, "")
      // Remove javascript: URLs
      .replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"')
      .replace(/src\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, "")
      // Remove data: URLs in src attributes (can contain scripts)
      .replace(/src\s*=\s*["']?\s*data:[^"'\s>]*/gi, "")
      // Remove expression() in styles (IE XSS vector)
      .replace(/expression\s*\([^)]*\)/gi, "")
      // Remove behavior: in styles (IE XSS vector)
      .replace(/behavior\s*:\s*[^;}"']*/gi, "")
      // Remove -moz-binding (Firefox XSS vector)
      .replace(/-moz-binding\s*:\s*[^;}"']*/gi, "")
      // Remove iframe tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/<iframe[^>]*>/gi, "")
      // Remove object/embed tags
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
      .replace(/<embed[^>]*>/gi, "")
      // Remove form tags (prevent phishing)
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
      // Remove base tags (can hijack relative URLs)
      .replace(/<base[^>]*>/gi, "")
  );
}

// Validate email address format (prevent injection)
function isValidEmail(email: string): boolean {
  // Basic email validation - alphanumeric, dots, hyphens, underscores, plus
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Verify Mailgun webhook signature
async function verifyWebhookSignature(
  timestamp: string,
  token: string,
  signature: string,
  signingKey: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(timestamp + token);
  const keyData = encoder.encode(signingKey);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, data);
  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison (XOR-accumulate) — replaces the prior `===`
  // which short-circuits on the first mismatched byte and leaks how many
  // leading bytes match (timing oracle).  Length mismatch is a fast-fail;
  // leaking the digest length (always 64 hex chars) is acceptable.
  if (computedSignature.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < computedSignature.length; i++) {
    result |= computedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

// Extract email address from "Name <email@domain.com>" format
function extractEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : emailString.toLowerCase().trim();
}

// Extract name from "Name <email@domain.com>" format
function extractName(emailString: string): string {
  const match = emailString.match(/^([^<]+)</);
  return match ? match[1].trim().replace(/"/g, "") : "";
}

// Strip HTML to plain text
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Generate subject hash for thread matching
function generateSubjectHash(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^(re:|fwd:|fw:)\s*/gi, "")
    .trim()
    .slice(0, 255);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get environment variables
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const MAILGUN_WEBHOOK_SIGNING_KEY = Deno.env.get(
      "MAILGUN_WEBHOOK_SIGNING_KEY",
    );

    // Create admin Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse form data from Mailgun webhook
    const formData = await req.formData();
    const payload: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        payload[key] = value;
      }
    }

    // Log webhook receipt (no PII in logs)
    console.log("Received inbound email webhook:", {
      hasFrom: !!payload.from,
      hasRecipient: !!payload.recipient,
      hasSubject: !!payload.subject,
      messageId: payload["Message-Id"]?.slice(0, 20) + "...",
      hasInReplyTo: !!payload["In-Reply-To"],
    });

    // SECURITY: Verify webhook signature (REQUIRED in production)
    if (!MAILGUN_WEBHOOK_SIGNING_KEY) {
      console.error(
        "MAILGUN_WEBHOOK_SIGNING_KEY not configured - rejecting webhook",
      );
      return new Response(
        JSON.stringify({ error: "Webhook signing key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isValid = await verifyWebhookSignature(
      payload.timestamp,
      payload.token,
      payload.signature,
      MAILGUN_WEBHOOK_SIGNING_KEY,
    );

    if (!isValid) {
      console.error("Invalid webhook signature - possible forgery attempt");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check timestamp freshness (prevent replay attacks - reject if older than 5 minutes)
    const webhookTimestamp = parseInt(payload.timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTimestamp - webhookTimestamp) > 300) {
      console.error("Webhook timestamp too old - possible replay attack");
      return new Response(
        JSON.stringify({ error: "Webhook timestamp expired" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Extract email details
    const senderEmail = extractEmailAddress(payload.from || payload.sender);
    const _senderName = extractName(payload.from || payload.sender);
    const recipientEmail = extractEmailAddress(payload.recipient);
    const subject = (payload.subject || "(No Subject)").slice(0, 500); // Limit subject length
    const rawBodyHtml = payload["body-html"] || payload["stripped-html"] || "";
    const bodyHtml = sanitizeHtml(rawBodyHtml); // SECURITY: Sanitize HTML
    const bodyText =
      payload["body-plain"] ||
      payload["stripped-text"] ||
      stripHtml(rawBodyHtml);
    const messageIdHeader = payload["Message-Id"] || "";
    const inReplyToHeader = payload["In-Reply-To"] || "";
    const referencesHeader = payload["References"] || "";
    const attachmentCount = parseInt(payload["attachment-count"] || "0", 10);

    // SECURITY: Validate email addresses
    if (senderEmail && !isValidEmail(senderEmail)) {
      console.error("Invalid sender email format");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid sender email" }),
        {
          status: 200, // Return 200 to prevent retries
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // IDEMPOTENCY: Check if this message was already processed
    if (messageIdHeader) {
      const { data: existingEmail } = await supabase
        .from("user_emails")
        .select("id")
        .eq("message_id_header", messageIdHeader)
        .single();

      if (existingEmail) {
        console.log(
          "Duplicate webhook - message already processed:",
          messageIdHeader,
        );
        return new Response(
          JSON.stringify({
            success: true,
            emailId: existingEmail.id,
            duplicate: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Find the user this email belongs to
    // Strategy: Look up which user sent the original email in this thread
    let recipientUserId: string | null = null;
    let threadId: string | null = null;

    // Try to find thread by In-Reply-To header (most reliable)
    if (inReplyToHeader) {
      const { data: parentEmail } = await supabase
        .from("user_emails")
        .select("user_id, thread_id, sender_id")
        .eq("message_id_header", inReplyToHeader)
        .single();

      if (parentEmail) {
        // The reply should go to whoever sent the original email
        recipientUserId = parentEmail.sender_id || parentEmail.user_id;
        threadId = parentEmail.thread_id;
        console.log("Found thread via In-Reply-To:", {
          threadId,
          recipientUserId,
        });
      }
    }

    // Try References header if In-Reply-To didn't work
    if (!threadId && referencesHeader) {
      const references = referencesHeader.split(/\s+/).filter(Boolean);
      for (const ref of references.reverse()) {
        // Check most recent first
        const { data: refEmail } = await supabase
          .from("user_emails")
          .select("user_id, thread_id, sender_id")
          .eq("message_id_header", ref)
          .single();

        if (refEmail) {
          recipientUserId = refEmail.sender_id || refEmail.user_id;
          threadId = refEmail.thread_id;
          console.log("Found thread via References:", {
            threadId,
            recipientUserId,
          });
          break;
        }
      }
    }

    // Try subject matching as fallback
    if (!threadId) {
      const subjectHash = generateSubjectHash(subject);
      const { data: matchingThread } = await supabase
        .from("email_threads")
        .select("id, user_id")
        .eq("subject_hash", subjectHash)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .single();

      if (matchingThread) {
        threadId = matchingThread.id;
        recipientUserId = matchingThread.user_id;
        console.log("Found thread via subject match:", {
          threadId,
          recipientUserId,
        });
      }
    }

    // If still no user found, try to match by sender email in contacts
    if (!recipientUserId) {
      // Look for any user who has communicated with this sender
      const { data: previousEmail } = await supabase
        .from("user_emails")
        .select("user_id, sender_id")
        .or(`to_addresses.cs.{${senderEmail}},from_address.eq.${senderEmail}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (previousEmail) {
        recipientUserId = previousEmail.sender_id || previousEmail.user_id;
        console.log("Found user via sender history:", { recipientUserId });
      }
    }

    // If we still can't find a user, log and reject
    if (!recipientUserId) {
      console.error("Could not determine recipient user for inbound email:", {
        from: senderEmail,
        to: recipientEmail,
        subject,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Could not determine recipient user",
        }),
        {
          status: 200, // Return 200 to prevent Mailgun retries
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create new thread if needed
    if (!threadId) {
      const { data: newThread, error: threadError } = await supabase
        .from("email_threads")
        .insert({
          user_id: recipientUserId,
          subject,
          subject_hash: generateSubjectHash(subject),
          snippet: bodyText.slice(0, 200),
          message_count: 1,
          unread_count: 1,
          last_message_at: new Date().toISOString(),
          participant_emails: [senderEmail],
          is_starred: false,
          is_archived: false,
          labels: [],
        })
        .select()
        .single();

      if (threadError) {
        console.error("Error creating thread:", threadError);
        throw threadError;
      }

      threadId = newThread.id;
      console.log("Created new thread:", threadId);
    } else {
      // Update existing thread
      const { data: existingThread } = await supabase
        .from("email_threads")
        .select("message_count, unread_count, participant_emails")
        .eq("id", threadId)
        .single();

      const participantEmails = existingThread?.participant_emails || [];
      if (!participantEmails.includes(senderEmail)) {
        participantEmails.push(senderEmail);
      }

      await supabase
        .from("email_threads")
        .update({
          snippet: bodyText.slice(0, 200),
          last_message_at: new Date().toISOString(),
          message_count: (existingThread?.message_count || 0) + 1,
          unread_count: (existingThread?.unread_count || 0) + 1,
          participant_emails: participantEmails,
        })
        .eq("id", threadId);

      console.log("Updated existing thread:", threadId);
    }

    // Parse references into array
    const referencesArray = referencesHeader
      ? referencesHeader.split(/\s+/).filter(Boolean)
      : [];

    // Store the email
    const { data: emailRecord, error: emailError } = await supabase
      .from("user_emails")
      .insert({
        user_id: recipientUserId,
        sender_id: null, // External sender, no internal user
        thread_id: threadId,
        from_address: payload.from || senderEmail,
        to_addresses: [recipientEmail],
        cc_addresses: payload.Cc
          ? payload.Cc.split(",").map((e: string) => e.trim())
          : [],
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        is_incoming: true,
        is_read: false,
        status: "received",
        message_id_header: messageIdHeader,
        in_reply_to_header: inReplyToHeader || null,
        references_header: referencesArray.length > 0 ? referencesArray : null,
        has_attachments: attachmentCount > 0,
        attachment_count: attachmentCount,
        provider: "mailgun",
        provider_message_id: payload.token,
        source: "inbound",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (emailError) {
      console.error("Error storing email:", emailError);
      throw emailError;
    }

    console.log("Stored inbound email:", emailRecord.id);

    // Handle attachments (if any)
    if (attachmentCount > 0) {
      // Mailgun sends attachments as form fields named attachment-1, attachment-2, etc.
      for (let i = 1; i <= attachmentCount; i++) {
        const attachmentKey = `attachment-${i}`;
        const attachment = formData.get(attachmentKey);

        if (attachment instanceof File) {
          try {
            const fileName = attachment.name;
            const fileType = attachment.type;
            const fileSize = attachment.size;

            // SECURITY: Validate MIME type (prevent executable uploads)
            if (!ALLOWED_ATTACHMENT_TYPES.has(fileType)) {
              console.warn(
                `Rejected attachment with disallowed MIME type: ${fileType}`,
              );
              continue;
            }

            // SECURITY: Limit file size (10MB max)
            const MAX_FILE_SIZE = 10 * 1024 * 1024;
            if (fileSize > MAX_FILE_SIZE) {
              console.warn(
                `Rejected attachment exceeding size limit: ${fileSize} bytes`,
              );
              continue;
            }

            // SECURITY: Sanitize filename (prevent path traversal)
            const sanitizedFileName = fileName
              .replace(/[^a-zA-Z0-9._-]/g, "_")
              .slice(0, 255);

            const storagePath = `email-attachments/${recipientUserId}/${emailRecord.id}/${sanitizedFileName}`;

            // Upload to Supabase Storage
            const arrayBuffer = await attachment.arrayBuffer();
            const { error: uploadError } = await supabase.storage
              .from("attachments")
              .upload(storagePath, arrayBuffer, {
                contentType: fileType,
              });

            if (uploadError) {
              console.error("Error uploading attachment:", uploadError);
              continue;
            }

            // Store attachment metadata
            await supabase.from("user_email_attachments").insert({
              email_id: emailRecord.id,
              file_name: sanitizedFileName,
              file_type: fileType,
              file_size: fileSize,
              storage_path: storagePath,
            });

            console.log("Stored attachment successfully");
          } catch (attachmentError) {
            console.error("Error processing attachment:", attachmentError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailRecord.id,
        threadId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Inbound email webhook error:", err);
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
