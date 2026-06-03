// File: supabase/functions/send-automated-email/index.ts
// Send Automated Email Edge Function
// Sends automated emails using Mailgun API
// This function handles both system-generated emails (workflows, notifications) AND
// marketing emails. Pass isMarketing: true for bulk/promotional sends to enable
// CAN-SPAM compliance: suppression gate, unsubscribe footer, List-Unsubscribe header.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import {
  appendComplianceFooter,
  buildListUnsubscribeHeader,
  isEmailSuppressed,
} from "../_shared/email-compliance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** Set true for marketing/bulk/promotional sends.
   *  Enables: suppression check (skip if suppressed), compliance footer,
   *  and List-Unsubscribe header. Never set for transactional mail. */
  isMarketing?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: SendEmailRequest = await req.json();
    const { to, subject, text, replyTo, isMarketing } = body;
    let { html } = body;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: to, subject, html",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Marketing-only: suppression gate + compliance footer ─────────────────
    if (isMarketing) {
      const adminSupabase = createSupabaseAdminClient();
      const suppressed = await isEmailSuppressed(adminSupabase, to);
      if (suppressed) {
        console.log(
          `[send-automated-email] Skipping suppressed address: ${to}`,
        );
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: "suppressed",
            message: "Recipient is suppressed; email not sent",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      // Append CAN-SPAM footer
      html = await appendComplianceFooter(html, to);
    }

    // Get Mailgun credentials
    const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
    const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");

    if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
      console.log("Mailgun credentials not configured, simulating email send");

      // For now, just log the email and return success
      // This allows the workflow to complete even without email service
      console.log("=== SIMULATED EMAIL ===");
      console.log("To:", to);
      console.log("Subject:", subject);
      console.log("Body (text):", text || "(no text version)");
      console.log("Body (HTML):", html.substring(0, 200) + "...");
      console.log("=======================");

      // Log to database for debugging
      const adminSupabase = createSupabaseAdminClient();
      try {
        await adminSupabase.from("email_logs").insert({
          to,
          subject,
          body_html: html,
          body_text: text,
          status: "simulated",
          provider: "none",
          created_at: new Date().toISOString(),
        });
      } catch (_err) {
        // Ignore if table doesn't exist
        console.log("Could not log to email_logs table");
      }

      return new Response(
        JSON.stringify({
          success: true,
          messageId: `simulated-${Date.now()}`,
          simulated: true,
          message: "Email simulated (no email service configured)",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Generate Message-ID for tracking
    const messageId = `<${crypto.randomUUID()}@${MAILGUN_DOMAIN}>`;

    // Build form data for Mailgun API
    const form = new FormData();
    form.append(
      "from",
      body.from || `The Standard HQ <noreply@${MAILGUN_DOMAIN}>`,
    );
    form.append("to", to);
    form.append("subject", subject);
    form.append("html", html);

    if (text) {
      form.append("text", text);
    }

    if (replyTo) {
      form.append("h:Reply-To", replyTo);
    }

    // Add Message-ID header
    form.append("h:Message-Id", messageId);

    // Marketing-only: List-Unsubscribe header (RFC 2369 / CAN-SPAM best practice)
    if (isMarketing) {
      const listUnsubscribe = await buildListUnsubscribeHeader(to);
      form.append("h:List-Unsubscribe", listUnsubscribe);
      form.append("h:List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
    }

    // Enable tracking for automated emails
    form.append("o:tracking", "yes");
    form.append("o:tracking-clicks", "yes");
    form.append("o:tracking-opens", "yes");

    // Tag for analytics
    form.append("o:tag", isMarketing ? "marketing" : "automated");

    console.log("Sending automated email via Mailgun:", {
      to,
      subject: subject.substring(0, 50),
    });

    // Send via Mailgun API
    const response = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
        },
        body: form,
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Mailgun API error:", data);
      throw new Error(data.message || "Failed to send email");
    }

    console.log("Automated email sent successfully:", data.id);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: messageId,
        mailgunId: data.id,
        message: "Email sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Send automated email error:", err);
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
