// supabase/functions/process-automation-reminders/index.ts
// Edge Function: Process Pipeline Automation Reminders
// Handles phase_stall and item_deadline_approaching triggers
// Triggered by external cron (daily)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import { replaceTemplateVariables } from "../_shared/templateVariables.ts";
import { isEmailSuppressed } from "../_shared/email-compliance.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StalePhaseRecord {
  recruit_id: string;
  phase_id: string;
  days_in_phase: number;
  automation_delay_days: number;
}

interface DeadlineItemRecord {
  recruit_id: string;
  checklist_item_id: string;
  days_until_deadline: number;
  automation_delay_days: number;
}

interface PasswordReminderUserRecord {
  user_id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

interface ProcessResult {
  phaseStallTriggered: number;
  deadlineApproachingTriggered: number;
  passwordReminderTriggered: number;
  errors: string[];
}

// Execute a single automation (copied from pipelineAutomationService logic)
async function executeAutomation(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  automation: {
    id: string;
    trigger_type: string;
    communication_type: string;
    recipients: Array<{ type: string; emails?: string[] }>;
    email_subject: string | null;
    email_body_html: string | null;
    notification_title: string | null;
    notification_message: string | null;
    sms_message: string | null;
  },
  recruitId: string,
  context: Record<string, string>,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already triggered today (deduplication)
    const today = new Date().toISOString().split("T")[0];
    const { data: existingLog } = await supabase
      .from("pipeline_automation_logs")
      .select("id")
      .eq("automation_id", automation.id)
      .eq("recruit_id", recruitId)
      .gte("triggered_at", `${today}T00:00:00Z`)
      .single();

    if (existingLog) {
      console.log(
        `[AutomationReminders] Already triggered today: ${automation.id} for ${recruitId}`,
      );
      return { success: true }; // Skip but don't error
    }

    // Create log entry
    const { data: log, error: logError } = await supabase
      .from("pipeline_automation_logs")
      .insert({
        automation_id: automation.id,
        recruit_id: recruitId,
        status: "pending",
        metadata: { trigger: automation.trigger_type, context },
      })
      .select("id")
      .single();

    if (logError) {
      // Handle race condition - unique constraint violation
      if (
        logError.message.includes("unique_daily_automation") ||
        logError.message.includes("duplicate key")
      ) {
        return { success: true };
      }
      throw logError;
    }

    // Resolve recipients
    const emails: string[] = [];
    const userIds: string[] = [];
    const phoneNumbers: string[] = [];

    // Get recruit info
    const { data: recruit } = await supabase
      .from("user_profiles")
      .select("id, email, phone, upline_id, key_contacts")
      .eq("id", recruitId)
      .single();

    if (!recruit) {
      throw new Error(`Recruit ${recruitId} not found`);
    }

    // Collect user IDs for batch fetch
    const userIdsToFetch: string[] = [];
    const recipientTypes = new Set(automation.recipients.map((r) => r.type));

    if (recipientTypes.has("upline") && recruit.upline_id) {
      userIdsToFetch.push(recruit.upline_id);
    }

    const contacts = recruit.key_contacts as Record<string, string> | null;
    if (recipientTypes.has("trainer") && contacts?.trainer_id) {
      userIdsToFetch.push(contacts.trainer_id);
    }
    if (
      recipientTypes.has("contracting_manager") &&
      contacts?.contracting_manager_id
    ) {
      userIdsToFetch.push(contacts.contracting_manager_id);
    }

    // Batch fetch users
    const userMap = new Map<
      string,
      { id: string; email: string; phone: string | null }
    >();
    if (userIdsToFetch.length > 0) {
      const { data: users } = await supabase
        .from("user_profiles")
        .select("id, email, phone")
        .in("id", userIdsToFetch);

      if (users) {
        users.forEach((u) =>
          userMap.set(u.id, { id: u.id, email: u.email, phone: u.phone }),
        );
      }
    }

    // Resolve each recipient
    for (const recipient of automation.recipients) {
      switch (recipient.type) {
        case "recruit":
          if (recruit.email) emails.push(recruit.email);
          if (recruit.phone) phoneNumbers.push(recruit.phone);
          userIds.push(recruitId);
          break;
        case "upline":
          if (recruit.upline_id) {
            const upline = userMap.get(recruit.upline_id);
            if (upline) {
              if (upline.email) emails.push(upline.email);
              if (upline.phone) phoneNumbers.push(upline.phone);
              userIds.push(upline.id);
            }
          }
          break;
        case "trainer":
          if (contacts?.trainer_id) {
            const trainer = userMap.get(contacts.trainer_id);
            if (trainer) {
              if (trainer.email) emails.push(trainer.email);
              if (trainer.phone) phoneNumbers.push(trainer.phone);
              userIds.push(trainer.id);
            }
          }
          break;
        case "contracting_manager":
          if (contacts?.contracting_manager_id) {
            const manager = userMap.get(contacts.contracting_manager_id);
            if (manager) {
              if (manager.email) emails.push(manager.email);
              if (manager.phone) phoneNumbers.push(manager.phone);
              userIds.push(manager.id);
            }
          }
          break;
        case "custom_email":
          if (recipient.emails) emails.push(...recipient.emails);
          break;
      }
    }

    // Variable substitution — uses shared module
    const substituteVars = (template: string): string =>
      replaceTemplateVariables(template, context);

    // Determine what to send
    const commType = automation.communication_type || "both";
    const shouldSendEmail = ["email", "both", "all"].includes(commType);
    const shouldSendNotification = ["notification", "both", "all"].includes(
      commType,
    );
    const shouldSendSms = ["sms", "all"].includes(commType);

    // Send Email via Mailgun — skip suppressed recipients (CAN-SPAM/consent).
    if (shouldSendEmail && emails.length > 0 && automation.email_subject) {
      const MAILGUN_API_KEY = Deno.env.get("MAILGUN_API_KEY");
      const MAILGUN_DOMAIN = Deno.env.get("MAILGUN_DOMAIN");

      const allowedEmails: string[] = [];
      for (const addr of [...new Set(emails)]) {
        if (!(await isEmailSuppressed(supabase, addr)))
          allowedEmails.push(addr);
      }

      if (MAILGUN_API_KEY && MAILGUN_DOMAIN && allowedEmails.length > 0) {
        const emailBody = substituteVars(automation.email_body_html || "");
        const emailSubject = substituteVars(automation.email_subject);

        const form = new FormData();
        form.append(
          "from",
          `The Standard HQ <notifications@${MAILGUN_DOMAIN}>`,
        );
        form.append("to", allowedEmails.join(", "));
        form.append("subject", emailSubject);
        form.append("html", emailBody);

        await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
          },
          body: form,
        });
      }
    }

    // Send In-App Notifications
    if (
      shouldSendNotification &&
      userIds.length > 0 &&
      automation.notification_title
    ) {
      const notificationMessage = substituteVars(
        automation.notification_message || "",
      );
      const notificationTitle = substituteVars(automation.notification_title);

      for (const userId of [...new Set(userIds)]) {
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "pipeline_automation",
          title: notificationTitle,
          message: notificationMessage,
          metadata: {
            automationId: automation.id,
            recruitId,
            trigger: automation.trigger_type,
          },
        });
      }
    }

    // Send SMS via Twilio
    if (shouldSendSms && phoneNumbers.length > 0 && automation.sms_message) {
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
      const MY_TWILIO_NUMBER = Deno.env.get("MY_TWILIO_NUMBER");

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && MY_TWILIO_NUMBER) {
        const smsMessage = substituteVars(automation.sms_message);

        for (const phone of [...new Set(phoneNumbers)]) {
          // Skip numbers that have opted out of SMS.
          const { data: smsSuppressed } = await supabase.rpc("is_suppressed", {
            p_channel: "sms",
            p_contact: phone,
          });
          if (smsSuppressed === true) continue;

          const form = new URLSearchParams();
          form.append("To", phone);
          form.append("From", MY_TWILIO_NUMBER);
          form.append("Body", smsMessage);

          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: form,
            },
          );
        }
      }
    }

    // Update log to sent
    await supabase
      .from("pipeline_automation_logs")
      .update({
        status: "sent",
        metadata: {
          trigger: automation.trigger_type,
          context,
          recipientEmails: [...new Set(emails)],
          recipientPhones: [...new Set(phoneNumbers)],
          recipientUserIds: [...new Set(userIds)],
        },
      })
      .eq("id", log.id);

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(
      `[AutomationReminders] Error executing automation ${automation.id}:`,
      error,
    );
    return { success: false, error };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate request
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const token = authHeader?.replace("Bearer ", "");

    const isServiceRole = token === serviceRoleKey;
    const isCronSecret = cronSecret && token === cronSecret;

    if (!isServiceRole && !isCronSecret) {
      console.log("[AutomationReminders] Unauthorized request");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createSupabaseAdminClient();
    const result: ProcessResult = {
      phaseStallTriggered: 0,
      deadlineApproachingTriggered: 0,
      passwordReminderTriggered: 0,
      errors: [],
    };

    console.log("[AutomationReminders] Starting automation reminder check...");

    // ========================================
    // 1. Process Phase Stall Automations
    // ========================================
    // Find recruits in phases longer than the automation's delay_days setting
    const { data: stalePhases, error: staleError } = await supabase.rpc(
      "get_stale_phase_recruits",
    );

    if (staleError) {
      console.error(
        "[AutomationReminders] Error fetching stale phases:",
        staleError,
      );
      result.errors.push(`Stale phases query failed: ${staleError.message}`);
    } else if (stalePhases && stalePhases.length > 0) {
      console.log(
        `[AutomationReminders] Found ${stalePhases.length} stale phase records`,
      );

      for (const record of stalePhases as StalePhaseRecord[]) {
        // Get phase_stall automations for this phase
        const { data: automations } = await supabase
          .from("pipeline_automations")
          .select("*")
          .eq("phase_id", record.phase_id)
          .eq("trigger_type", "phase_stall")
          .eq("is_active", true)
          .lte("delay_days", record.days_in_phase);

        if (automations && automations.length > 0) {
          // Get recruit and phase info for context
          const [recruitResult, phaseResult] = await Promise.all([
            supabase
              .from("user_profiles")
              .select("first_name, last_name, email, phone, upline_id")
              .eq("id", record.recruit_id)
              .single(),
            supabase
              .from("pipeline_phases")
              .select("phase_name")
              .eq("id", record.phase_id)
              .single(),
          ]);

          const recruit = recruitResult.data;
          const phase = phaseResult.data;

          // Get upline info if available
          let uplineName = "";
          let uplineEmail = "";
          let uplinePhone = "";
          if (recruit?.upline_id) {
            const { data: upline } = await supabase
              .from("user_profiles")
              .select("first_name, last_name, email, phone")
              .eq("id", recruit.upline_id)
              .single();
            if (upline) {
              uplineName = `${upline.first_name} ${upline.last_name}`;
              uplineEmail = upline.email;
              uplinePhone = upline.phone || "";
            }
          }

          const context = {
            recruit_name: recruit
              ? `${recruit.first_name} ${recruit.last_name}`
              : "Recruit",
            recruit_first_name: recruit?.first_name || "Recruit",
            recruit_email: recruit?.email || "",
            recruit_phone: recruit?.phone || "",
            phase_name: phase?.phase_name || "",
            days_in_phase: String(record.days_in_phase),
            upline_name: uplineName,
            upline_email: uplineEmail,
            upline_phone: uplinePhone,
            portal_link: `${Deno.env.get("VITE_APP_URL") || ""}/recruiting/recruit/${record.recruit_id}`,
          };

          for (const automation of automations) {
            const execResult = await executeAutomation(
              supabase,
              automation,
              record.recruit_id,
              context,
            );
            if (execResult.success) {
              result.phaseStallTriggered++;
            } else if (execResult.error) {
              result.errors.push(execResult.error);
            }
          }
        }
      }
    }

    // ========================================
    // 2. Process Item Deadline Approaching Automations
    // ========================================
    // Find checklist items with deadlines approaching
    const { data: deadlineItems, error: deadlineError } = await supabase.rpc(
      "get_approaching_deadline_items",
    );

    if (deadlineError) {
      console.error(
        "[AutomationReminders] Error fetching deadline items:",
        deadlineError,
      );
      result.errors.push(
        `Deadline items query failed: ${deadlineError.message}`,
      );
    } else if (deadlineItems && deadlineItems.length > 0) {
      console.log(
        `[AutomationReminders] Found ${deadlineItems.length} deadline approaching records`,
      );

      for (const record of deadlineItems as DeadlineItemRecord[]) {
        // Get item_deadline_approaching automations for this item
        const { data: automations } = await supabase
          .from("pipeline_automations")
          .select("*")
          .eq("checklist_item_id", record.checklist_item_id)
          .eq("trigger_type", "item_deadline_approaching")
          .eq("is_active", true)
          .gte("delay_days", record.days_until_deadline);

        if (automations && automations.length > 0) {
          // Get recruit and item info for context
          const [recruitResult, itemResult] = await Promise.all([
            supabase
              .from("user_profiles")
              .select("first_name, last_name, email, phone, upline_id")
              .eq("id", record.recruit_id)
              .single(),
            supabase
              .from("phase_checklist_items")
              .select("item_name, phase:phase_id(phase_name)")
              .eq("id", record.checklist_item_id)
              .single(),
          ]);

          const recruit = recruitResult.data;
          const item = itemResult.data;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const phaseName = (item?.phase as any)?.phase_name || "";

          // Get upline info
          let uplineName = "";
          let uplineEmail = "";
          let uplinePhone = "";
          if (recruit?.upline_id) {
            const { data: upline } = await supabase
              .from("user_profiles")
              .select("first_name, last_name, email, phone")
              .eq("id", recruit.upline_id)
              .single();
            if (upline) {
              uplineName = `${upline.first_name} ${upline.last_name}`;
              uplineEmail = upline.email;
              uplinePhone = upline.phone || "";
            }
          }

          const context = {
            recruit_name: recruit
              ? `${recruit.first_name} ${recruit.last_name}`
              : "Recruit",
            recruit_first_name: recruit?.first_name || "Recruit",
            recruit_email: recruit?.email || "",
            recruit_phone: recruit?.phone || "",
            phase_name: phaseName,
            item_name: item?.item_name || "",
            days_until_deadline: String(record.days_until_deadline),
            upline_name: uplineName,
            upline_email: uplineEmail,
            upline_phone: uplinePhone,
            portal_link: `${Deno.env.get("VITE_APP_URL") || ""}/recruiting/recruit/${record.recruit_id}`,
          };

          for (const automation of automations) {
            const execResult = await executeAutomation(
              supabase,
              automation,
              record.recruit_id,
              context,
            );
            if (execResult.success) {
              result.deadlineApproachingTriggered++;
            } else if (execResult.error) {
              result.errors.push(execResult.error);
            }
          }
        }
      }
    }

    // ========================================
    // 3. Process Password Set Reminder Automations
    // ========================================
    // Find users who haven't set their password and are approaching link expiration
    // IMPORTANT: Process per-IMO to ensure tenant isolation
    const passwordTriggerTypes = [
      { type: "password_not_set_24h", hours: 48 }, // 24h before expiry (72-48=24)
      { type: "password_not_set_12h", hours: 60 }, // 12h before expiry (72-60=12)
    ];

    for (const trigger of passwordTriggerTypes) {
      // Get all IMOs that have active automations for this trigger type
      const { data: imosWithAutomations, error: imosError } =
        await supabase.rpc("get_imos_with_system_automations", {
          p_trigger_type: trigger.type,
        });

      if (imosError) {
        console.error(
          `[AutomationReminders] Error fetching IMOs for ${trigger.type}:`,
          imosError,
        );
        result.errors.push(
          `IMO query failed for ${trigger.type}: ${imosError.message}`,
        );
        continue;
      }

      if (!imosWithAutomations || imosWithAutomations.length === 0) {
        console.log(
          `[AutomationReminders] No IMOs with active ${trigger.type} automations`,
        );
        continue;
      }

      console.log(
        `[AutomationReminders] Found ${imosWithAutomations.length} IMOs with active ${trigger.type} automations`,
      );

      // Process each IMO separately for tenant isolation
      for (const imo of imosWithAutomations as {
        imo_id: string;
        imo_name: string;
      }[]) {
        // Get active automations for this trigger type AND this IMO
        const { data: automations, error: automationsError } =
          await supabase.rpc("get_active_system_automations", {
            p_trigger_type: trigger.type,
            p_imo_id: imo.imo_id,
          });

        if (automationsError || !automations || automations.length === 0) {
          continue;
        }

        console.log(
          `[AutomationReminders] Processing ${automations.length} ${trigger.type} automations for IMO: ${imo.imo_name}`,
        );

        // Get users needing reminder for this time window AND this IMO
        const { data: users, error: usersError } = await supabase.rpc(
          "get_password_reminder_users",
          { hours_since_creation: trigger.hours, filter_imo_id: imo.imo_id },
        );

        if (usersError) {
          console.error(
            `[AutomationReminders] Error fetching users for ${trigger.type} in IMO ${imo.imo_name}:`,
            usersError,
          );
          result.errors.push(
            `Password reminder query failed for ${trigger.type} in IMO ${imo.imo_name}: ${usersError.message}`,
          );
          continue;
        }

        if (!users || users.length === 0) {
          console.log(
            `[AutomationReminders] No users found for ${trigger.type} reminder in IMO: ${imo.imo_name}`,
          );
          continue;
        }

        console.log(
          `[AutomationReminders] Found ${users.length} users for ${trigger.type} reminder in IMO: ${imo.imo_name}`,
        );

        // Calculate hours remaining until link expires
        const hoursRemaining = 72 - trigger.hours;

        for (const user of users as PasswordReminderUserRecord[]) {
          // Build context for this user
          const context = {
            user_name:
              `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              "User",
            user_first_name: user.first_name || "User",
            user_last_name: user.last_name || "",
            user_email: user.email || "",
            hours_remaining: String(hoursRemaining),
            portal_link:
              Deno.env.get("VITE_APP_URL") || "https://www.thestandardhq.com",
          };

          for (const automation of automations) {
            // For password reminders, recipients should target the user directly
            // Override recipients to always be the user
            const passwordAutomation = {
              ...automation,
              recipients: [{ type: "recruit" }], // "recruit" maps to the user in executeAutomation
            };

            const execResult = await executeAutomation(
              supabase,
              passwordAutomation,
              user.user_id, // Using user_id as the "recruit_id" for logging
              context,
            );

            if (execResult.success) {
              result.passwordReminderTriggered++;
            } else if (execResult.error) {
              result.errors.push(execResult.error);
            }
          }
        }
      }
    }

    console.log(
      `[AutomationReminders] Complete: ${result.phaseStallTriggered} phase_stall, ${result.deadlineApproachingTriggered} deadline_approaching, ${result.passwordReminderTriggered} password_reminder, ${result.errors.length} errors`,
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[AutomationReminders] Fatal error:", error);

    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
