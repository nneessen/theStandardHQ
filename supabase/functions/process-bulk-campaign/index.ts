// Process Bulk Campaign Edge Function
// Reads pending recipients for a campaign, renders HTML per-recipient with variable
// substitution, sends via send-automated-email (Mailgun), and updates statuses.
// Requires super-admin authentication. Processes in batches of 50.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "../_shared/supabase-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 50;

interface ProcessBulkCampaignRequest {
  campaign_id: string;
  subject: string;
  html: string;
}

function replaceVariables(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Replace {{key}} with value, handling optional whitespace inside braces
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    result = result.replace(pattern, value || "");
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const adminSupabase = createSupabaseAdminClient();
  const startTime = Date.now();

  // Capture campaign_id early so error handler can mark it failed
  let campaignId: string | null = null;

  try {
    // ── Auth: verify caller is a super admin ─────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userClient = createSupabaseClient(authHeader);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify super-admin status
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_super_admin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: super admin required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Parse request ────────────────────────────────────────────────────
    const body: ProcessBulkCampaignRequest = await req.json();
    const { campaign_id, subject, html } = body;
    campaignId = campaign_id;

    if (!campaign_id || !subject || !html) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: campaign_id, subject, html",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `Processing bulk campaign ${campaign_id} (caller: ${user.email})...`,
    );

    // Mark campaign as sending
    await adminSupabase
      .from("bulk_email_campaigns")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", campaign_id);

    // Get pending recipients (batch limited)
    const { data: recipients, error: fetchError } = await adminSupabase
      .from("bulk_email_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch recipients: ${fetchError.message}`);
    }

    if (!recipients || recipients.length === 0) {
      console.log("No pending recipients to process");

      await adminSupabase
        .from("bulk_email_campaigns")
        .update({
          status: "sent",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign_id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "No pending recipients",
          processed: 0,
          remaining: 0,
          durationMs: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if there are more recipients beyond this batch
    const { count: totalPending } = await adminSupabase
      .from("bulk_email_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    console.log(
      `Processing batch of ${recipients.length} (${totalPending} total pending)`,
    );

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        // Build per-recipient variables from the JSONB variables column
        const variables: Record<string, string> =
          typeof recipient.variables === "object" && recipient.variables
            ? (recipient.variables as Record<string, string>)
            : {};

        // Supplement with row-level fields
        variables.email = recipient.email_address;
        if (recipient.first_name) variables.first_name = recipient.first_name;
        if (recipient.last_name) variables.last_name = recipient.last_name;

        // Substitute variables in subject and HTML
        const personalizedSubject = replaceVariables(subject, variables);
        const personalizedHtml = replaceVariables(html, variables);

        // Send via send-automated-email edge function
        const { error: sendError } = await adminSupabase.functions.invoke(
          "send-automated-email",
          {
            body: {
              to: recipient.email_address,
              subject: personalizedSubject,
              html: personalizedHtml,
            },
          },
        );

        if (sendError) {
          throw sendError;
        }

        // Mark recipient as sent
        await adminSupabase
          .from("bulk_email_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        sentCount++;
        console.log(
          `Sent to ${recipient.email_address} (${sentCount}/${recipients.length})`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `Failed to send to ${recipient.email_address}:`,
          errorMessage,
        );

        await adminSupabase
          .from("bulk_email_recipients")
          .update({
            status: "failed",
            error_message: errorMessage,
          })
          .eq("id", recipient.id);

        failedCount++;
      }
    }

    // Update campaign counters
    // Fetch actual totals from DB to avoid drift if multiple batches run
    const { count: totalSent } = await adminSupabase
      .from("bulk_email_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("status", "sent");

    const { count: totalFailed } = await adminSupabase
      .from("bulk_email_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("status", "failed");

    const { count: remainingPending } = await adminSupabase
      .from("bulk_email_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    const remaining = remainingPending || 0;

    // Only mark complete if no recipients are still pending
    const finalStatus =
      remaining > 0 ? "sending" : (totalSent || 0) === 0 ? "failed" : "sent";

    const campaignUpdate: Record<string, unknown> = {
      status: finalStatus,
      sent_count: totalSent || 0,
      failed_count: totalFailed || 0,
      updated_at: new Date().toISOString(),
    };
    if (finalStatus === "sent" || finalStatus === "failed") {
      campaignUpdate.completed_at = new Date().toISOString();
    }

    await adminSupabase
      .from("bulk_email_campaigns")
      .update(campaignUpdate)
      .eq("id", campaign_id);

    console.log(
      `Batch complete: ${sentCount} sent, ${failedCount} failed, ${remaining} remaining (${Date.now() - startTime}ms)`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: recipients.length,
        sentCount,
        failedCount,
        remaining,
        durationMs: Date.now() - startTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Process bulk campaign error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // Mark campaign as failed if we have the ID
    if (campaignId) {
      try {
        await adminSupabase
          .from("bulk_email_campaigns")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaignId);
      } catch {
        // Ignore cleanup errors
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
