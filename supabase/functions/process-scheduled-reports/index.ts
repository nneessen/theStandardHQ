// Edge Function: Process Scheduled Reports
// Phase 9: Report Export Enhancement
// Triggered by external cron (Vercel/GitHub Actions) to process due scheduled reports

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  subQuarters,
} from "https://esm.sh/date-fns@3.3.1";
// EPIC_LIFE_IMO_ID was previously imported from _shared/slack-auth.ts, which has
// been removed with the rest of the Slack integration. It is not Slack-specific —
// it gates Epic Life out of scheduled reports — so it is inlined here.
const EPIC_LIFE_IMO_ID = "89514211-f2bd-4440-9527-90a472c5e622";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Types for scheduled reports
interface ScheduledReport {
  id: string;
  owner_id: string;
  imo_id: string | null;
  agency_id: string | null;
  schedule_name: string;
  report_type: string;
  report_config: {
    dateRangeMode?: "trailing" | "fixed";
    trailingMonths?: number;
    startDate?: string;
    endDate?: string;
  };
  frequency: "weekly" | "monthly" | "quarterly";
  day_of_week: number | null;
  day_of_month: number | null;
  preferred_time: string;
  recipients: Array<{ user_id: string; email: string; name: string }>;
  export_format: "pdf" | "csv";
  include_charts: boolean;
  include_insights: boolean;
  include_summary: boolean;
}

interface ProcessResult {
  scheduleId: string;
  scheduleName: string;
  success: boolean;
  recipientCount: number;
  error?: string;
  skipped?: boolean;
}

async function getEffectiveScheduleImoId(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  schedule: ScheduledReport,
): Promise<string | null> {
  if (schedule.imo_id) {
    return schedule.imo_id;
  }

  if (!schedule.agency_id) {
    return null;
  }

  const { data: agency } = await supabase
    .from("agencies")
    .select("imo_id")
    .eq("id", schedule.agency_id)
    .maybeSingle();

  return agency?.imo_id ?? null;
}

// Calculate report date range based on config and frequency
function calculateReportPeriod(
  config: ScheduledReport["report_config"],
  frequency: ScheduledReport["frequency"],
): { startDate: Date; endDate: Date } {
  const now = new Date();

  if (config.dateRangeMode === "fixed" && config.startDate && config.endDate) {
    return {
      startDate: new Date(config.startDate),
      endDate: new Date(config.endDate),
    };
  }

  // Trailing mode - calculate based on frequency
  const trailingMonths = config.trailingMonths ?? 12;

  // For reports, typically show data up to end of previous month/quarter
  let endDate: Date;
  let startDate: Date;

  switch (frequency) {
    case "weekly":
      // Weekly: last 4 weeks
      endDate = endOfMonth(subMonths(now, 1));
      startDate = startOfMonth(subMonths(now, 1));
      break;

    case "monthly":
      // Monthly: trailing months ending last complete month
      endDate = endOfMonth(subMonths(now, 1));
      startDate = startOfMonth(subMonths(now, trailingMonths));
      break;

    case "quarterly":
      // Quarterly: last complete quarter + trailing
      endDate = endOfMonth(subMonths(startOfQuarter(now), 1));
      startDate = startOfMonth(subQuarters(now, 4));
      break;

    default:
      endDate = endOfMonth(subMonths(now, 1));
      startDate = startOfMonth(subMonths(now, trailingMonths));
  }

  return { startDate, endDate };
}

// Generate report data based on type
async function generateReportData(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  schedule: ScheduledReport,
  period: { startDate: Date; endDate: Date },
): Promise<{
  title: string;
  data: Record<string, unknown>[] | Record<string, unknown>;
  headers?: string[];
}> {
  const startDateStr = format(period.startDate, "yyyy-MM-dd");
  const endDateStr = format(period.endDate, "yyyy-MM-dd");

  switch (schedule.report_type) {
    case "imo-performance": {
      const { data, error } = await supabase.rpc("get_imo_performance_report", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
      });
      if (error) throw error;
      return {
        title: "IMO Performance Report",
        data: data || [],
        headers: [
          "Month",
          "New Policies",
          "New Premium",
          "Commissions",
          "New Agents",
          "Lapsed",
          "Net Growth",
        ],
      };
    }

    case "agency-performance": {
      if (!schedule.agency_id)
        throw new Error("Agency ID required for agency performance report");
      const { data, error } = await supabase.rpc(
        "get_agency_performance_report",
        {
          p_agency_id: schedule.agency_id,
          p_start_date: startDateStr,
          p_end_date: endDateStr,
        },
      );
      if (error) throw error;
      return {
        title: "Agency Performance Report",
        data: data || [],
        headers: [
          "Month",
          "New Policies",
          "New Premium",
          "Commissions",
          "New Agents",
          "Lapsed",
          "Net Growth",
        ],
      };
    }

    case "team-comparison": {
      const { data, error } = await supabase.rpc("get_team_comparison_report", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
      });
      if (error) throw error;
      return {
        title: "Team Comparison Report",
        data: data || [],
        headers: [
          "Agency",
          "Owner",
          "Agents",
          "Policies",
          "Premium",
          "Commissions",
          "Retention",
        ],
      };
    }

    case "top-performers": {
      const { data, error } = await supabase.rpc("get_top_performers_report", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_limit: 20,
      });
      if (error) throw error;
      return {
        title: "Top Performers Report",
        data: data || [],
        headers: [
          "Rank",
          "Agent",
          "Agency",
          "Policies",
          "Premium",
          "Commissions",
        ],
      };
    }

    case "recruiting-summary": {
      if (schedule.imo_id) {
        const { data, error } = await supabase.rpc(
          "get_imo_recruiting_summary",
          {
            p_imo_id: schedule.imo_id,
          },
        );
        if (error) throw error;
        return {
          title: "IMO Recruiting Summary",
          data: data || {},
        };
      } else if (schedule.agency_id) {
        const { data, error } = await supabase.rpc(
          "get_agency_recruiting_summary",
          {
            p_agency_id: schedule.agency_id,
          },
        );
        if (error) throw error;
        return {
          title: "Agency Recruiting Summary",
          data: data || {},
        };
      }
      throw new Error("IMO or Agency ID required for recruiting summary");
    }

    case "override-summary": {
      if (schedule.imo_id) {
        const { data, error } = await supabase.rpc("get_imo_override_summary");
        if (error) throw error;
        return {
          title: "IMO Override Commission Summary",
          data: data || [],
        };
      } else if (schedule.agency_id) {
        const { data, error } = await supabase.rpc(
          "get_agency_override_summary",
          {
            p_agency_id: schedule.agency_id,
          },
        );
        if (error) throw error;
        return {
          title: "Agency Override Commission Summary",
          data: data || [],
        };
      }
      throw new Error("IMO or Agency ID required for override summary");
    }

    case "executive-dashboard": {
      // Combine multiple metrics for executive view
      const metrics: Record<string, unknown> = {};

      if (schedule.imo_id) {
        const { data } = await supabase.rpc("get_imo_dashboard_metrics");
        if (data?.[0]) metrics.dashboard = data[0];
      } else if (schedule.agency_id) {
        const { data } = await supabase.rpc("get_agency_dashboard_metrics", {
          p_agency_id: schedule.agency_id,
        });
        if (data?.[0]) metrics.dashboard = data[0];
      }

      return {
        title: "Executive Dashboard Summary",
        data: metrics,
      };
    }

    default:
      throw new Error(`Unsupported report type: ${schedule.report_type}`);
  }
}

// Format data as CSV
function formatAsCSV(
  data: Record<string, unknown>[] | Record<string, unknown>,
  headers?: string[],
): string {
  // Handle array of records
  if (Array.isArray(data)) {
    if (data.length === 0) return "No data available";

    const keys = headers || Object.keys(data[0]);
    const headerRow = keys.join(",");
    const dataRows = data.map((row) => {
      return keys
        .map((key) => {
          const value = (row as Record<string, unknown>)[key];
          if (value === null || value === undefined) return "";
          if (typeof value === "string" && value.includes(",")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          if (typeof value === "number") {
            return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
          }
          return String(value);
        })
        .join(",");
    });

    return [headerRow, ...dataRows].join("\n");
  }

  // Handle single object (metrics summary)
  const flattenObject = (
    obj: Record<string, unknown>,
    prefix = "",
  ): string[] => {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        lines.push(...flattenObject(value as Record<string, unknown>, fullKey));
      } else {
        lines.push(`${fullKey},${value}`);
      }
    }
    return lines;
  };

  return ["Metric,Value", ...flattenObject(data)].join("\n");
}

// Format data as HTML email
function formatAsHTML(
  title: string,
  data: Record<string, unknown>[] | Record<string, unknown>,
  period: { startDate: Date; endDate: Date },
  scheduleName: string,
  _headers?: string[],
): string {
  const periodStr = `${format(period.startDate, "MMM d, yyyy")} - ${format(period.endDate, "MMM d, yyyy")}`;

  let tableContent = "";

  if (Array.isArray(data)) {
    if (data.length === 0) {
      tableContent =
        '<p style="color: #666;">No data available for this period.</p>';
    } else {
      const keys = Object.keys(data[0]);
      tableContent = `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-family: Arial, sans-serif; font-size: 14px;">
          <thead>
            <tr style="background-color: #1e3a5f; color: white;">
              ${keys.map((k) => `<th style="padding: 12px; text-align: left; border: 1px solid #ddd;">${k.replace(/_/g, " ").toUpperCase()}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                (row, i) => `
              <tr style="background-color: ${i % 2 === 0 ? "#f8f9fa" : "white"};">
                ${keys
                  .map((k) => {
                    const val = (row as Record<string, unknown>)[k];
                    const formatted =
                      typeof val === "number"
                        ? val.toLocaleString("en-US", {
                            maximumFractionDigits: 2,
                          })
                        : String(val ?? "");
                    return `<td style="padding: 10px; border: 1px solid #ddd;">${formatted}</td>`;
                  })
                  .join("")}
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      `;
    }
  } else {
    // Render object as key-value pairs
    const renderObject = (obj: Record<string, unknown>, depth = 0): string => {
      const indent = depth * 20;
      return Object.entries(obj)
        .map(([key, value]) => {
          if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value)
          ) {
            return `
            <div style="margin-left: ${indent}px; margin-top: 10px;">
              <strong style="color: #1e3a5f;">${key.replace(/_/g, " ")}:</strong>
              ${renderObject(value as Record<string, unknown>, depth + 1)}
            </div>
          `;
          }
          const formatted =
            typeof value === "number"
              ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
              : String(value ?? "N/A");
          return `
          <div style="margin-left: ${indent}px; padding: 5px 0;">
            <span style="color: #666;">${key.replace(/_/g, " ")}:</span>
            <strong style="color: #1a202c;">${formatted}</strong>
          </div>
        `;
        })
        .join("");
    };
    tableContent = `<div style="padding: 10px;">${renderObject(data)}</div>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px;">
          <h1 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">${title}</h1>
          <p style="margin: 0; opacity: 0.9; font-size: 14px;">${scheduleName}</p>
          <p style="margin: 10px 0 0 0; opacity: 0.8; font-size: 12px;">Period: ${periodStr}</p>
        </div>

        <!-- Content -->
        <div style="padding: 20px;">
          ${tableContent}
        </div>

        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; color: #666; font-size: 12px;">
            This is an automated report from The Standard HQ.
            <br>
            Generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
          </p>
          <p style="margin: 10px 0 0 0; color: #999; font-size: 11px;">
            To manage your report schedules, visit the Reports section in your dashboard.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Send email via Mailgun
async function sendReportEmail(
  recipients: ScheduledReport["recipients"],
  subject: string,
  html: string,
  csvAttachment?: { filename: string; content: string },
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
  const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.log("[ScheduledReports] Mailgun not configured, simulating send");
    return { success: true, messageId: `simulated-${Date.now()}` };
  }

  const toAddresses = recipients.map((r) => r.email).join(", ");
  const form = new FormData();
  form.append("from", `The Standard HQ Reports <reports@${MAILGUN_DOMAIN}>`);
  form.append("to", toAddresses);
  form.append("subject", subject);
  form.append("html", html);

  // Add CSV attachment if provided
  if (csvAttachment) {
    const blob = new Blob([csvAttachment.content], { type: "text/csv" });
    form.append("attachment", blob, csvAttachment.filename);
  }

  // Tags for analytics
  form.append("o:tag", "scheduled-report");
  form.append("o:tracking", "yes");

  try {
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
      console.error("[ScheduledReports] Mailgun error:", data);
      return { success: false, error: data.message || "Failed to send email" };
    }

    return { success: true, messageId: data.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[ScheduledReports] Email send error:", error);
    return { success: false, error };
  }
}

// Process a single schedule
async function processSchedule(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  schedule: ScheduledReport,
): Promise<ProcessResult> {
  const result: ProcessResult = {
    scheduleId: schedule.id,
    scheduleName: schedule.schedule_name,
    success: false,
    recipientCount: schedule.recipients.length,
  };

  try {
    console.log(
      `[ScheduledReports] Processing schedule: ${schedule.schedule_name} (${schedule.id})`,
    );

    const effectiveImoId = await getEffectiveScheduleImoId(supabase, schedule);
    if (effectiveImoId === EPIC_LIFE_IMO_ID) {
      console.log(
        `[ScheduledReports] Skipping Epic Life schedule: ${schedule.schedule_name} (${schedule.id})`,
      );

      const { data: delivery, error: deliveryError } = await supabase
        .from("scheduled_report_deliveries")
        .insert({
          schedule_id: schedule.id,
          status: "processing",
          recipients_sent: schedule.recipients,
        })
        .select("id")
        .single();

      if (deliveryError) {
        throw new Error(
          `Failed to create skipped delivery record: ${deliveryError.message}`,
        );
      }

      await supabase.rpc("complete_scheduled_delivery", {
        p_schedule_id: schedule.id,
        p_delivery_id: delivery.id,
        p_success: true,
        p_error_message: "Skipped: Epic Life scheduled reports are disabled",
      });

      result.success = true;
      result.skipped = true;
      result.error = "Epic Life scheduled reports are disabled";
      return result;
    }

    // Calculate report period
    const period = calculateReportPeriod(
      schedule.report_config,
      schedule.frequency,
    );
    console.log(
      `[ScheduledReports] Report period: ${format(period.startDate, "yyyy-MM-dd")} to ${format(period.endDate, "yyyy-MM-dd")}`,
    );

    // Create delivery record
    const { data: delivery, error: deliveryError } = await supabase
      .from("scheduled_report_deliveries")
      .insert({
        schedule_id: schedule.id,
        status: "processing",
        recipients_sent: schedule.recipients,
        report_period_start: format(period.startDate, "yyyy-MM-dd"),
        report_period_end: format(period.endDate, "yyyy-MM-dd"),
      })
      .select("id")
      .single();

    if (deliveryError) {
      throw new Error(
        `Failed to create delivery record: ${deliveryError.message}`,
      );
    }

    // Generate report data
    const reportData = await generateReportData(supabase, schedule, period);
    console.log(`[ScheduledReports] Generated report: ${reportData.title}`);

    // Format based on export type
    const csv = formatAsCSV(reportData.data, reportData.headers);
    const html = formatAsHTML(
      reportData.title,
      reportData.data,
      period,
      schedule.schedule_name,
      reportData.headers,
    );

    // Send email
    const subject = `${reportData.title} - ${schedule.schedule_name}`;
    const emailResult = await sendReportEmail(
      schedule.recipients,
      subject,
      html,
      schedule.export_format === "csv"
        ? {
            filename: `${schedule.report_type}_${format(new Date(), "yyyy-MM-dd")}.csv`,
            content: csv,
          }
        : undefined,
    );

    if (!emailResult.success) {
      throw new Error(emailResult.error || "Failed to send email");
    }

    // Mark delivery complete
    await supabase.rpc("complete_scheduled_delivery", {
      p_schedule_id: schedule.id,
      p_delivery_id: delivery.id,
      p_success: true,
      p_mailgun_message_id: emailResult.messageId,
    });

    result.success = true;
    console.log(
      `[ScheduledReports] Successfully processed schedule: ${schedule.schedule_name}`,
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    result.error = error;
    console.error(
      `[ScheduledReports] Failed to process schedule ${schedule.schedule_name}:`,
      error,
    );

    // Try to mark delivery as failed
    try {
      const { data: delivery } = await supabase
        .from("scheduled_report_deliveries")
        .select("id")
        .eq("schedule_id", schedule.id)
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (delivery) {
        await supabase.rpc("complete_scheduled_delivery", {
          p_schedule_id: schedule.id,
          p_delivery_id: delivery.id,
          p_success: false,
          p_error_message: error,
        });
      }
    } catch (updateErr) {
      console.error(
        "[ScheduledReports] Failed to update delivery status:",
        updateErr,
      );
    }
  }

  return result;
}

// Main handler
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate request - check for service role key or cron secret
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const token = authHeader?.replace("Bearer ", "");

    const isServiceRole = token === serviceRoleKey;
    const isCronSecret = cronSecret && token === cronSecret;

    if (!isServiceRole && !isCronSecret) {
      console.log("[ScheduledReports] Unauthorized request");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createSupabaseAdminClient();

    // Get due schedules
    const { data: dueSchedules, error: fetchError } = await supabase.rpc(
      "get_due_scheduled_reports",
    );

    if (fetchError) {
      console.error(
        "[ScheduledReports] Failed to fetch due schedules:",
        fetchError,
      );
      throw fetchError;
    }

    if (!dueSchedules || dueSchedules.length === 0) {
      console.log("[ScheduledReports] No schedules due for processing");
      return new Response(
        JSON.stringify({ message: "No schedules due", processed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[ScheduledReports] Processing ${dueSchedules.length} due schedule(s)`,
    );

    // Process each schedule
    const results: ProcessResult[] = [];
    for (const schedule of dueSchedules) {
      const result = await processSchedule(
        supabase,
        schedule as ScheduledReport,
      );
      results.push(result);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(
      `[ScheduledReports] Completed: ${successful} successful, ${failed} failed`,
    );

    return new Response(
      JSON.stringify({
        message: "Processing complete",
        processed: results.length,
        successful,
        failed,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[ScheduledReports] Error:", error);

    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
