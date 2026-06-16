// Process Workflow Edge Function
// Executes workflow actions sequentially with delays and error handling
// Uses Resend API for sending emails via send-automated-email edge function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import {
  replaceTemplateVariables as sharedReplaceTemplateVariables,
  initEmptyVariables,
  type TemplateRenderMode,
} from "../_shared/templateVariables.ts";
import { assertSafeWebhookUrl } from "../_shared/webhookUrl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WorkflowAction {
  type: string;
  order: number;
  config: Record<string, unknown>;
  delayMinutes?: number;
}

interface ProcessWorkflowRequest {
  runId: string;
  workflowId: string;
  isTest?: boolean;
}

interface ActionResult {
  actionId: string;
  actionType: string;
  status: "success" | "failed" | "skipped";
  result?: unknown;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  const adminSupabase = createSupabaseAdminClient();

  try {
    // =====================================================================
    // AUTHORIZATION — dual gate.
    // (a) Edge-to-edge callers (trigger-workflow-event, process-pending-
    //     workflows) pass the service-role key → trusted, no tenant scoping.
    // (b) The browser also invokes this directly for manual + test runs
    //     (workflowService.ts invokeWorkflowProcessor at lines 231 & 390),
    //     carrying a USER JWT — so a pure service-role gate would break those
    //     live paths. For the user-JWT path we verify the token and require
    //     the workflow's imo_id match the caller's imo_id (tenant ownership),
    //     so a user can't drive the admin client against another tenant's
    //     workflow/run by guessing ids.
    // =====================================================================
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    )!;
    const authHeader = req.headers.get("Authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!bearer) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isServiceRole = bearer === SUPABASE_SERVICE_ROLE_KEY;
    // null means "no tenant scoping" (service-role); otherwise the caller's imo.
    let callerImoId: string | null = null;

    if (!isServiceRole) {
      const { data: authData, error: authErr } =
        await adminSupabase.auth.getUser(bearer);

      if (authErr || !authData?.user) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: callerProfile } = await adminSupabase
        .from("user_profiles")
        .select("imo_id")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!callerProfile?.imo_id) {
        return new Response(
          JSON.stringify({ error: "Forbidden: caller has no IMO" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      callerImoId = callerProfile.imo_id;
    }

    const body: ProcessWorkflowRequest = await req.json();
    const { runId, workflowId, isTest } = body;

    if (!runId || !workflowId) {
      return new Response(
        JSON.stringify({ error: "Missing runId or workflowId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `Processing workflow ${workflowId}, run ${runId}, isTest: ${isTest}`,
    );

    // Get workflow details
    const { data: workflow, error: workflowError } = await adminSupabase
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .single();

    if (workflowError || !workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Tenant-ownership enforcement for the user-JWT path: the caller may only
    // process workflows belonging to their own IMO. Service-role callers
    // (callerImoId === null) bypass this.
    if (callerImoId !== null && workflow.imo_id !== callerImoId) {
      return new Response(
        JSON.stringify({ error: "Forbidden: workflow belongs to another IMO" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get workflow run context
    const { data: run, error: runError } = await adminSupabase
      .from("workflow_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (runError || !run) {
      throw new Error(`Workflow run not found: ${runId}`);
    }

    // Cancellation: a run can be cancelled before/between steps (e.g. a nurture
    // sequence stopped when the policy lapses). Honor it and stop.
    if (run.cancelled) {
      await adminSupabase
        .from("workflow_runs")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", runId);
      return new Response(
        JSON.stringify({ success: true, runId, cancelled: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Execute the actions SNAPSHOTTED onto the run at enqueue time (so a run that
    // started months ago is unaffected by later edits to the workflow). Falls
    // back to the live workflow actions for legacy/direct-invocation runs.
    const allActions: WorkflowAction[] = (
      (run.actions_snapshot as WorkflowAction[] | null) ||
      workflow.actions ||
      []
    )
      .slice()
      .sort((a: WorkflowAction, b: WorkflowAction) => a.order - b.order);
    // Resume point for runs re-queued after a `wait` step (0 on first run).
    const startIndex = (run.resume_action_index as number) || 0;

    // Cooldown + conditions are evaluated ONCE, on the genuine FIRST attempt of a
    // run — never on a delayed resume (startIndex > 0) NOR on a reaper-requeued
    // retry (attempts > 1). Gating only on startIndex===0 would let a run that was
    // reaped mid-send (so it never advanced past action 0) re-enter this gate; if a
    // sibling run completed in the death window, cooldown would wrongly mark the
    // half-sent run 'skipped' and abandon its unsent recipients. dequeue increments
    // attempts on each claim, so attempts<=1 == first real execution.
    if (!isTest && startIndex === 0 && ((run.attempts as number) ?? 0) <= 1) {
      if (workflow.cooldown_minutes) {
        const cutoff = new Date(
          Date.now() - workflow.cooldown_minutes * 60000,
        ).toISOString();
        const { data: recent } = await adminSupabase
          .from("workflow_runs")
          .select("id")
          .eq("workflow_id", workflowId)
          .eq("status", "completed")
          .gte("completed_at", cutoff)
          .neq("id", runId)
          .limit(1);
        if (recent && recent.length > 0) {
          await adminSupabase
            .from("workflow_runs")
            .update({
              status: "skipped",
              completed_at: new Date().toISOString(),
              error_message: "Cooldown active",
            })
            .eq("id", runId);
          return new Response(
            JSON.stringify({ success: true, runId, skipped: "cooldown" }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      const conditions =
        (workflow.conditions as Array<{
          field: string;
          operator: string;
          value: unknown;
        }> | null) || [];
      if (
        conditions.length > 0 &&
        !evaluateConditions(
          conditions,
          (run.context as Record<string, unknown>) || {},
        )
      ) {
        await adminSupabase
          .from("workflow_runs")
          .update({
            status: "skipped",
            completed_at: new Date().toISOString(),
            error_message: "Conditions not met",
          })
          .eq("id", runId);
        return new Response(
          JSON.stringify({ success: true, runId, skipped: "conditions" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Accumulate across delayed resumes.
    const actionsExecuted: ActionResult[] =
      (run.actions_executed as ActionResult[] | null) || [];
    let emailsSent = (run.emails_sent as number) || 0;
    let actionsCompleted = (run.actions_completed as number) || 0;
    let actionsFailed = (run.actions_failed as number) || 0;

    for (let i = startIndex; i < allActions.length; i++) {
      const action = allActions[i];

      // Real delay: a `wait` step re-queues the run to resume at the NEXT action
      // after scheduled_at (the worker picks it up when due). Works for any
      // horizon — minutes to years — with zero held resources.
      const waitMinutes =
        action.type === "wait"
          ? Number(action.config?.waitMinutes ?? action.delayMinutes ?? 0)
          : 0;
      if (!isTest && waitMinutes > 0) {
        const resumeAt = new Date(
          Date.now() + waitMinutes * 60000,
        ).toISOString();
        await adminSupabase
          .from("workflow_runs")
          .update({
            status: "pending",
            scheduled_at: resumeAt,
            resume_action_index: i + 1,
            actions_executed: actionsExecuted,
            emails_sent: emailsSent,
            actions_completed: actionsCompleted,
            actions_failed: actionsFailed,
          })
          .eq("id", runId);
        return new Response(
          JSON.stringify({
            success: true,
            runId,
            deferredUntil: resumeAt,
            resumeIndex: i + 1,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (isTest && action.type === "wait") {
        continue; // delays are a no-op in test runs
      }

      try {
        const result = await executeAction(
          action,
          run.context,
          workflow,
          isTest ?? false,
          adminSupabase,
          runId,
        );
        actionsExecuted.push({
          actionId: `action-${action.order}`,
          actionType: action.type,
          status: "success",
          result,
        });
        actionsCompleted++;

        if (action.type === "send_email") {
          emailsSent++;
        }
      } catch (actionError) {
        const errorMessage =
          actionError instanceof Error ? actionError.message : "Unknown error";
        console.error(`Action ${action.order} failed:`, errorMessage);

        actionsExecuted.push({
          actionId: `action-${action.order}`,
          actionType: action.type,
          status: "failed",
          error: errorMessage,
        });
        actionsFailed++;

        // Continue with other actions unless it's a critical failure
      }

      // Persist forward progress after EACH action so a reaper-requeued resume
      // restarts at the NEXT action (resume_action_index = i+1) instead of index 0
      // — without this, a reaped run re-fires every prior action's side effect
      // (a second webhook POST, a duplicate notification). Reset attempts: a run
      // that is making progress is not a poison pill, so it shouldn't accumulate
      // toward the dead-letter cap; only an action that never completes does.
      if (!isTest) {
        await adminSupabase
          .from("workflow_runs")
          .update({
            resume_action_index: i + 1,
            actions_executed: actionsExecuted,
            emails_sent: emailsSent,
            actions_completed: actionsCompleted,
            actions_failed: actionsFailed,
            attempts: 0,
          })
          .eq("id", runId);
      }
    }

    // Update workflow run with results
    const durationMs = Date.now() - startTime;
    await adminSupabase
      .from("workflow_runs")
      .update({
        status: actionsFailed > 0 ? "failed" : "completed",
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        actions_executed: actionsExecuted,
        emails_sent: emailsSent,
        actions_completed: actionsCompleted,
        actions_failed: actionsFailed,
      })
      .eq("id", runId);

    return new Response(
      JSON.stringify({
        success: true,
        runId,
        actionsExecuted: actionsExecuted.length,
        actionsCompleted,
        actionsFailed,
        durationMs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Process workflow error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    // Try to update the run as failed
    try {
      const body: ProcessWorkflowRequest = await req.clone().json();
      if (body.runId) {
        await adminSupabase
          .from("workflow_runs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            error_message: errorMessage,
          })
          .eq("id", body.runId);
      }
    } catch {
      // Ignore update errors
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

/**
 * Idempotency ledger helpers (migration 20260616152822). A run that stays
 * 'running' past the reaper TTL is re-queued, which re-runs the per-recipient
 * send loop from the top. claimSend records a claim row for
 * (run, action, channel, recipient) and returns true ONLY if THIS call created
 * it — a reaped retry (or a racing second worker) gets false and MUST skip, so a
 * re-queued run never double-sends. releaseSend frees a claim after a FAILED send
 * so that recipient stays retriable. Both fail-open to delivery on infra error: a
 * missed dedupe is far rarer and less harmful than dropping a legitimate send.
 */
async function claimSend(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  runId: string | undefined,
  actionOrder: number,
  channel: "email" | "sms",
  recipient: string,
): Promise<boolean> {
  if (!runId) return true; // no run context (legacy direct invoke) — can't dedupe
  const { data, error } = await supabase.rpc("claim_workflow_send", {
    p_run_id: runId,
    p_action_order: actionOrder,
    p_channel: channel,
    p_recipient: recipient,
  });
  if (error) {
    console.error("[claimSend] error (failing open to send):", error.message);
    return true;
  }
  return data === true;
}

async function releaseSend(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  runId: string | undefined,
  actionOrder: number,
  channel: "email" | "sms",
  recipient: string,
): Promise<void> {
  if (!runId) return;
  await supabase
    .from("workflow_send_log")
    .delete()
    .eq("run_id", runId)
    .eq("action_order", actionOrder)
    .eq("channel", channel)
    .eq("recipient", recipient);
}

/**
 * Pre-filter recipients a prior attempt of THIS run+action already claimed, BEFORE
 * the rate-limit check + send loop. Critical on a reaper re-run: without it the
 * rate-limit check re-counts already-delivered recipients (recorded in
 * workflow_email_tracking) against the limit and can throw, which would drop the
 * genuinely-unsent recipients and fail the run. Returns the still-unclaimed set +
 * how many were already handled. Fails OPEN (treats all as unclaimed) on error —
 * the in-loop claimSend is the per-recipient backstop.
 */
async function filterUnclaimedRecipients(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  runId: string | undefined,
  actionOrder: number,
  channel: "email" | "sms",
  recipients: string[],
): Promise<{ remaining: string[]; alreadyDone: number }> {
  if (!runId) return { remaining: recipients, alreadyDone: 0 };
  const { data, error } = await supabase
    .from("workflow_send_log")
    .select("recipient")
    .eq("run_id", runId)
    .eq("action_order", actionOrder)
    .eq("channel", channel);
  if (error || !data) {
    console.error(
      "[filterUnclaimedRecipients] error (failing open):",
      error?.message,
    );
    return { remaining: recipients, alreadyDone: 0 };
  }
  const done = new Set(data.map((r) => r.recipient as string));
  const remaining = recipients.filter((r) => !done.has(r));
  return { remaining, alreadyDone: recipients.length - remaining.length };
}

/**
 * Execute a single workflow action
 */
async function executeAction(
  action: WorkflowAction,
  context: Record<string, unknown>,
  _workflow: Record<string, unknown>,
  isTest: boolean,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  runId: string | undefined,
): Promise<unknown> {
  console.log(`Executing action: ${action.type}`, action.config);

  switch (action.type) {
    case "send_email":
      return await executeSendEmail(action, context, isTest, supabase, runId);

    case "send_sms":
      return await executeSendSms(
        action,
        context,
        isTest,
        supabase,
        _workflow,
        runId,
      );

    case "create_notification":
      return await executeCreateNotification(action, context, isTest, supabase);

    case "wait":
      // For immediate execution, we just log the wait
      // Real delays would need a scheduling system
      console.log(`Wait action: ${action.config.waitMinutes || 0} minutes`);
      return { waited: action.config.waitMinutes || 0 };

    case "webhook":
      return await executeWebhook(action, context, isTest);

    case "update_field":
      return await executeUpdateField(
        action,
        context,
        isTest,
        supabase,
        _workflow,
      );

    default:
      // Throw (not silent-skip) so an unimplemented/typo'd action type fails the
      // run loudly instead of reporting success without doing anything.
      throw new Error(`Unsupported action type: ${action.type}`);
  }
}

/**
 * Send email action - uses Resend API via send-automated-email edge function
 */
async function executeSendEmail(
  action: WorkflowAction,
  context: Record<string, unknown>,
  isTest: boolean,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  runId: string | undefined,
): Promise<unknown> {
  console.log(
    "executeSendEmail called with action config:",
    JSON.stringify(action.config),
  );

  const templateId = action.config.templateId as string;
  if (!templateId) {
    throw new Error(
      "No template ID specified for send_email action - config was: " +
        JSON.stringify(action.config),
    );
  }

  // Get the workflow owner's user ID
  const workflowOwnerId = context.triggeredBy as string;
  if (!workflowOwnerId) {
    throw new Error(
      "No workflow owner ID in context - cannot send email without user",
    );
  }

  // Get workflow owner's full profile
  const { data: ownerProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", workflowOwnerId)
    .single();

  if (profileError || !ownerProfile) {
    throw new Error("Workflow owner profile not found");
  }

  // Get template
  const { data: template, error: templateError } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (templateError || !template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Determine recipients based on action configuration
  let recipientEmails: string[] = [];
  const recipientType =
    (action.config.recipientType as string) || "trigger_user";

  console.log("Determining recipients - type:", recipientType, "context:", {
    recipientEmail: context.recipientEmail,
    recipientId: context.recipientId,
    triggeredByEmail: context.triggeredByEmail,
    triggeredBy: context.triggeredBy,
  });

  switch (recipientType) {
    case "trigger_user":
      if (context.recipientEmail) {
        recipientEmails = [context.recipientEmail as string];
      }
      break;

    case "specific_email":
      if (action.config.recipientEmail) {
        recipientEmails = [action.config.recipientEmail as string];
      }
      break;

    case "current_user":
      if (context.triggeredByEmail) {
        recipientEmails = [context.triggeredByEmail as string];
      }
      break;

    case "manager":
    case "direct_upline":
      if (context.recipientId) {
        // Scope the source user to the workflow owner's IMO so a crafted
        // cross-IMO recipientId can't pivot to another tenant's upline.
        const { data: userWithUpline } = await supabase
          .from("user_profiles")
          .select("upline_id")
          .eq("id", context.recipientId)
          .eq("imo_id", ownerProfile.imo_id)
          .single();

        if (userWithUpline?.upline_id) {
          const { data: manager } = await supabase
            .from("user_profiles")
            .select("id, email")
            .eq("id", userWithUpline.upline_id)
            .eq("imo_id", ownerProfile.imo_id)
            .single();

          if (manager?.email) {
            recipientEmails = [manager.email];
          }
        }
      }
      break;

    case "all_trainers": {
      // SECURITY: this runs on the service-role admin client which BYPASSES RLS,
      // so the IMO filter is mandatory — without it this returns every tenant's
      // trainers (cross-tenant email blast).
      const { data: trainers } = await supabase
        .from("user_profiles")
        .select("id, email")
        .contains("roles", ["trainer"])
        .eq("imo_id", ownerProfile.imo_id)
        .is("archived_at", null);

      if (trainers && trainers.length > 0) {
        recipientEmails = trainers.map((t) => t.email);
      }
      break;
    }

    case "all_agents": {
      // SECURITY: admin client bypasses RLS — scope to the owner's IMO or this
      // blasts every tenant's licensed agents.
      const { data: agents, error: agentsError } = await supabase
        .from("user_profiles")
        .select("id, email")
        .eq("agent_status", "licensed")
        .eq("imo_id", ownerProfile.imo_id)
        .is("archived_at", null);

      console.log("Fetching all licensed agents, found:", agents?.length || 0);
      if (agentsError) {
        console.error("Error fetching agents:", agentsError);
      }

      if (agents && agents.length > 0) {
        recipientEmails = agents.map((a) => a.email);
      }
      break;
    }
  }

  if (recipientEmails.length === 0) {
    throw new Error(`No recipients found for type: ${recipientType}`);
  }

  // Idempotency pre-filter (BEFORE the rate-limit check): drop recipients a prior
  // attempt of this run+action already claimed. On a reaper re-run this prevents
  // the rate-limit check from re-counting already-delivered recipients (which
  // would throw and drop the still-unsent ones). If none remain, the action
  // already delivered — return success without re-sending.
  let emailAlreadyDone = 0;
  const emailPrefilter = await filterUnclaimedRecipients(
    supabase,
    runId,
    action.order,
    "email",
    recipientEmails,
  );
  emailAlreadyDone = emailPrefilter.alreadyDone;
  if (emailPrefilter.remaining.length === 0) {
    return {
      sent: true,
      templateId,
      sentCount: 0,
      skippedCount: emailAlreadyDone,
      note: "all recipients already delivered (idempotent re-run)",
    };
  }
  recipientEmails = emailPrefilter.remaining;

  // Rate limit check - prevent runaway email costs
  const workflowId = (context.workflowId as string) || "";
  const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc(
    "check_workflow_email_rate_limit",
    {
      p_user_id: ownerProfile.id,
      p_workflow_id: workflowId,
      p_recipient_email: recipientEmails[0],
      p_recipient_count: recipientEmails.length,
    },
  );

  if (rateLimitError) {
    console.error("Rate limit check error:", rateLimitError);
  } else if (rateLimitCheck && !rateLimitCheck.allowed) {
    const reason = rateLimitCheck.reason;
    let errorMessage = "Rate limit exceeded";

    switch (reason) {
      case "daily_limit_exceeded":
        errorMessage = `Daily email limit reached (${rateLimitCheck.limit} emails/day). ${rateLimitCheck.remaining} remaining.`;
        break;
      case "workflow_hourly_limit_exceeded":
        errorMessage = `This workflow has sent too many emails in the past hour (limit: ${rateLimitCheck.limit}). Please wait before sending more.`;
        break;
      case "recipient_daily_limit_exceeded":
        errorMessage = `${rateLimitCheck.recipient} has already received ${rateLimitCheck.limit} emails today from workflows.`;
        break;
      case "max_recipients_exceeded":
        errorMessage = `Too many recipients (${rateLimitCheck.requested}). Maximum allowed: ${rateLimitCheck.limit}`;
        break;
    }

    console.log("Rate limit blocked:", rateLimitCheck);
    throw new Error(errorMessage);
  }

  // Build template variables for replacement
  const templateVariables = await buildTemplateVariables(
    context,
    ownerProfile,
    supabase,
  );

  if (isTest) {
    return {
      action: "send_email",
      template: template.name,
      subject: replaceTemplateVariables(
        template.subject,
        templateVariables,
        "subject",
      ),
      recipientType,
      wouldSendTo: recipientEmails,
      sender: "noreply@updates.thestandardhq.com",
      isTest: true,
    };
  }

  // Check if workflow owner has Gmail connected — Gmail always takes priority
  const { data: gmailIntegration } = await supabase
    .from("gmail_integrations")
    .select("id")
    .eq("user_id", ownerProfile.id)
    .eq("is_active", true)
    .eq("connection_status", "connected")
    .maybeSingle();

  const useGmail = !!gmailIntegration;
  const provider = useGmail ? "gmail" : "resend";
  console.log(`Email provider for user ${ownerProfile.id}: ${provider}`);

  // Process template variables once (same for all recipients)
  const processedSubject = replaceTemplateVariables(
    template.subject,
    templateVariables,
    "subject",
  );
  const processedBodyHtml = replaceTemplateVariables(
    template.body_html,
    templateVariables,
    "html",
  );
  const processedBodyText = replaceTemplateVariables(
    template.body_text || "",
    templateVariables,
    "text",
  );

  const sentEmails: string[] = [];
  const failedEmails: string[] = [];
  const skippedEmails: string[] = []; // already delivered by a prior (reaped) attempt

  for (const recipientEmail of recipientEmails) {
    // Idempotency: claim this recipient before sending. A reaped re-run (or a
    // racing second worker) that finds the recipient already claimed skips it,
    // so a re-queued run never double-sends.
    const claimed = await claimSend(
      supabase,
      runId,
      action.order,
      "email",
      recipientEmail,
    );
    if (!claimed) {
      console.log(
        "Skipping already-sent recipient (idempotent):",
        recipientEmail,
      );
      skippedEmails.push(recipientEmail);
      continue;
    }
    try {
      console.log(
        "Sending to:",
        recipientEmail,
        "Subject:",
        processedSubject,
        "via:",
        provider,
      );

      if (useGmail) {
        // Send via gmail-send-email edge function
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Gmail send",
          );
        }

        const gmailResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/gmail-send-email`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: ownerProfile.id,
              to: [recipientEmail],
              subject: processedSubject,
              html: processedBodyHtml,
              text: processedBodyText || undefined,
            }),
          },
        );

        const gmailData = await gmailResponse.json();

        if (!gmailData.success) {
          throw new Error(gmailData.error || "Gmail send failed");
        }

        sentEmails.push(recipientEmail);

        // gmail-send-email handles its own logging and quota tracking,
        // but we still record for workflow rate limiting
        {
          const { error: rateErr } = await supabase.rpc(
            "record_workflow_email",
            {
              p_workflow_id: workflowId,
              p_user_id: ownerProfile.id,
              p_recipient_email: recipientEmail,
              p_recipient_type: recipientType,
              p_success: true,
              p_error_message: null,
            },
          );
          if (rateErr) {
            console.log("Rate tracking record failed (non-critical):", rateErr);
          }
        }
      } else {
        // Fallback: Send via Mailgun using the send-email edge function
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY",
        );

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Mailgun send",
          );
        }

        const ownerName =
          [ownerProfile.first_name, ownerProfile.last_name]
            .filter(Boolean)
            .join(" ") || "The Standard HQ";
        const fromAddress = `${ownerName} <noreply@updates.thestandardhq.com>`;

        const mailgunResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/send-email`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: [recipientEmail],
              subject: processedSubject,
              html: processedBodyHtml,
              text: processedBodyText || undefined,
              from: fromAddress,
              replyTo: ownerProfile.email,
            }),
          },
        );

        const mailgunData = await mailgunResponse.json();

        if (!mailgunData.success) {
          throw new Error(mailgunData.error || "Mailgun send failed");
        }

        sentEmails.push(recipientEmail);

        // Record in user_emails table
        await supabase.from("user_emails").insert({
          user_id: ownerProfile.id,
          sender_id: ownerProfile.id,
          subject: processedSubject,
          body_html: processedBodyHtml,
          body_text: processedBodyText,
          status: "sent",
          sent_at: new Date().toISOString(),
          provider: "mailgun",
          provider_message_id: mailgunData.mailgunId || mailgunData.messageId,
          is_incoming: false,
          from_address: "noreply@updates.thestandardhq.com",
          to_addresses: [recipientEmail],
        });

        // Record for rate limiting tracking
        {
          const { error: rateErr2 } = await supabase.rpc(
            "record_workflow_email",
            {
              p_workflow_id: workflowId,
              p_user_id: ownerProfile.id,
              p_recipient_email: recipientEmail,
              p_recipient_type: recipientType,
              p_success: true,
              p_error_message: null,
            },
          );
          if (rateErr2) {
            console.log(
              "Rate tracking record failed (non-critical):",
              rateErr2,
            );
          }
        }

        // Increment email quota
        const today = new Date().toISOString().split("T")[0];
        const { data: existingQuota } = await supabase
          .from("email_quota_tracking")
          .select("id, emails_sent")
          .eq("user_id", ownerProfile.id)
          .eq("date", today)
          .eq("provider", "mailgun")
          .single();

        if (existingQuota) {
          await supabase
            .from("email_quota_tracking")
            .update({ emails_sent: existingQuota.emails_sent + 1 })
            .eq("id", existingQuota.id);
        } else {
          await supabase.from("email_quota_tracking").insert({
            user_id: ownerProfile.id,
            date: today,
            provider: "mailgun",
            emails_sent: 1,
          });
        }
      }
    } catch (sendError) {
      console.error(`Failed to send to ${recipientEmail}:`, sendError);
      failedEmails.push(recipientEmail);
      // Release the claim so this failed recipient stays retriable on a re-run.
      await releaseSend(supabase, runId, action.order, "email", recipientEmail);

      // Record failed email for tracking
      {
        const { error: rateErr3 } = await supabase.rpc(
          "record_workflow_email",
          {
            p_workflow_id: workflowId,
            p_user_id: ownerProfile.id,
            p_recipient_email: recipientEmail,
            p_recipient_type: recipientType,
            p_success: false,
            p_error_message:
              sendError instanceof Error ? sendError.message : "Unknown error",
          },
        );
        if (rateErr3) {
          console.log("Rate tracking record failed (non-critical):", rateErr3);
        }
      }
    }
  }

  // Only a genuine total failure throws. If every recipient was SKIPPED (already
  // delivered by a prior attempt) the action already succeeded — do not throw.
  if (sentEmails.length === 0 && skippedEmails.length === 0) {
    throw new Error(
      `Failed to send to all recipients: ${failedEmails.join(", ")}`,
    );
  }

  return {
    sent: true,
    templateId,
    sentCount: sentEmails.length,
    skippedCount: skippedEmails.length + emailAlreadyDone,
    failedCount: failedEmails.length,
    sentTo: sentEmails,
    skippedTo: skippedEmails.length > 0 ? skippedEmails : undefined,
    failedTo: failedEmails.length > 0 ? failedEmails : undefined,
    provider,
  };
}

// Hard cap on recipients per SMS action — a safety rail against runaway Twilio
// spend from a mis-scoped all_agents send. (A per-IMO daily SMS budget is a
// follow-up; send-sms itself enforces TCPA opt-out via is_suppressed.)
const MAX_SMS_RECIPIENTS = 100;

/**
 * Send SMS action — renders action.config.message and delivers via the send-sms
 * edge function (which normalizes to E.164 and enforces is_suppressed opt-out).
 * Recipient PHONES are resolved tenant-scoped to the workflow owner's IMO.
 */
async function executeSendSms(
  action: WorkflowAction,
  context: Record<string, unknown>,
  isTest: boolean,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  workflow: Record<string, unknown>,
  runId: string | undefined,
): Promise<unknown> {
  const messageTemplate = action.config.message as string;
  if (!messageTemplate) {
    throw new Error("No message specified for send_sms action");
  }

  const workflowOwnerId = context.triggeredBy as string;
  if (!workflowOwnerId) {
    throw new Error("No workflow owner ID in context — cannot send SMS");
  }

  const { data: ownerProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", workflowOwnerId)
    .single();
  if (profileError || !ownerProfile) {
    throw new Error("Workflow owner profile not found");
  }
  const ownerImoId = ownerProfile.imo_id;

  // Resolve recipient phone numbers (tenant-scoped). Mirrors the email path but
  // selects `phone` and drops rows without one.
  let phones: string[] = [];
  const recipientType =
    (action.config.recipientType as string) || "trigger_user";

  switch (recipientType) {
    case "trigger_user":
      if (context.recipientPhone) {
        phones = [context.recipientPhone as string];
      } else if (context.recipientId) {
        const { data } = await supabase
          .from("user_profiles")
          .select("phone")
          .eq("id", context.recipientId)
          .eq("imo_id", ownerImoId)
          .single();
        if (data?.phone) phones = [data.phone];
      }
      break;

    case "specific_phone":
      if (action.config.recipientPhone) {
        phones = [action.config.recipientPhone as string];
      }
      break;

    case "current_user":
      if (ownerProfile.phone) phones = [ownerProfile.phone];
      break;

    case "manager":
    case "direct_upline":
      if (context.recipientId) {
        const { data: userWithUpline } = await supabase
          .from("user_profiles")
          .select("upline_id")
          .eq("id", context.recipientId)
          .eq("imo_id", ownerImoId)
          .single();
        if (userWithUpline?.upline_id) {
          const { data: manager } = await supabase
            .from("user_profiles")
            .select("phone")
            .eq("id", userWithUpline.upline_id)
            .eq("imo_id", ownerImoId)
            .single();
          if (manager?.phone) phones = [manager.phone];
        }
      }
      break;

    case "all_agents": {
      // SECURITY: admin client bypasses RLS — scope to the owner's IMO.
      const { data: agents } = await supabase
        .from("user_profiles")
        .select("phone")
        .eq("agent_status", "licensed")
        .eq("imo_id", ownerImoId)
        .is("archived_at", null)
        .not("phone", "is", null);
      if (agents) phones = agents.map((a) => a.phone).filter(Boolean);
      break;
    }

    case "all_trainers": {
      const { data: trainers } = await supabase
        .from("user_profiles")
        .select("phone")
        .contains("roles", ["trainer"])
        .eq("imo_id", ownerImoId)
        .is("archived_at", null)
        .not("phone", "is", null);
      if (trainers) phones = trainers.map((t) => t.phone).filter(Boolean);
      break;
    }
  }

  // De-dupe + drop empties, then cap.
  phones = [...new Set(phones.filter((p) => p && p.trim().length > 0))];
  if (phones.length === 0) {
    throw new Error(
      `No phone numbers found for recipient type: ${recipientType}`,
    );
  }
  // Idempotency pre-filter: drop numbers a prior attempt already claimed so a
  // reaped re-run doesn't re-text them or burn the recipient cap on them.
  let smsAlreadyDone = 0;
  const smsPrefilter = await filterUnclaimedRecipients(
    supabase,
    runId,
    action.order,
    "sms",
    phones,
  );
  smsAlreadyDone = smsPrefilter.alreadyDone;
  if (smsPrefilter.remaining.length === 0) {
    return {
      sent: true,
      sentCount: 0,
      skippedCount: smsAlreadyDone,
      note: "all recipients already delivered (idempotent re-run)",
    };
  }
  phones = smsPrefilter.remaining;
  if (phones.length > MAX_SMS_RECIPIENTS) {
    console.warn(
      `[send_sms] capping ${phones.length} recipients to ${MAX_SMS_RECIPIENTS}`,
    );
    phones = phones.slice(0, MAX_SMS_RECIPIENTS);
  }

  // Render the message (plain text — strip nothing, no HTML).
  const variables = await buildTemplateVariables(
    context,
    ownerProfile,
    supabase,
  );
  const message = replaceTemplateVariables(messageTemplate, variables, "text");

  if (isTest) {
    return {
      action: "send_sms",
      message,
      recipientType,
      wouldSendTo: phones,
      isTest: true,
    };
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL/SERVICE_ROLE_KEY for send_sms");
  }
  const workflowId = (context.workflowId as string) || (workflow.id as string);

  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const to of phones) {
    // Idempotency: claim this number before sending. A reaped re-run that finds
    // it already claimed skips it, so a re-queued run never double-texts.
    const claimed = await claimSend(supabase, runId, action.order, "sms", to);
    if (!claimed) {
      console.log(
        "[send_sms] skipping already-sent recipient (idempotent):",
        to,
      );
      skipped.push(to);
      continue;
    }
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          message,
          trigger: "workflow",
          automationId: workflowId,
        }),
      });
      const data = await resp.json();
      if (data.suppressed) {
        // recipient opted out (STOP) — terminal, not a failure. Keep the claim so
        // a re-run doesn't pointlessly re-hit send-sms for an opted-out number.
        skipped.push(to);
      } else if (data.success) {
        sent.push(to);
      } else {
        console.error(`[send_sms] failed for ${to}:`, data.error);
        failed.push(to);
        // Release so this failed number stays retriable on a re-run.
        await releaseSend(supabase, runId, action.order, "sms", to);
      }
    } catch (err) {
      console.error(`[send_sms] error for ${to}:`, err);
      failed.push(to);
      await releaseSend(supabase, runId, action.order, "sms", to);
    }
  }

  if (sent.length === 0 && skipped.length === 0) {
    throw new Error(
      `Failed to send SMS to all recipients: ${failed.join(", ")}`,
    );
  }

  return {
    sent: true,
    sentCount: sent.length,
    skippedCount: skipped.length + smsAlreadyDone,
    failedCount: failed.length,
    skippedTo: skipped.length > 0 ? skipped : undefined,
    failedTo: failed.length > 0 ? failed : undefined,
  };
}

/**
 * Create notification action
 */
async function executeCreateNotification(
  action: WorkflowAction,
  context: Record<string, unknown>,
  isTest: boolean,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<unknown> {
  const title = action.config.title as string;
  const message = action.config.message as string;

  if (!title || !message) {
    throw new Error("Notification requires title and message");
  }

  if (isTest) {
    return {
      action: "create_notification",
      title,
      message,
      wouldNotify: context.recipientId || "unknown",
      isTest: true,
    };
  }

  const recipientId = context.recipientId as string;
  if (!recipientId) {
    throw new Error("No recipient ID in context");
  }

  // Create notification. NB: the column is `read` (boolean), not `is_read` —
  // an `is_read` insert fails PostgREST schema-cache validation and the action
  // errors out (verified against the live schema + database.types.ts).
  const { error: notifError } = await supabase.from("notifications").insert({
    user_id: recipientId,
    type: "workflow",
    title,
    message,
    read: false,
  });

  if (notifError) {
    throw new Error(`Failed to create notification: ${notifError.message}`);
  }

  return { created: true, title };
}

/**
 * Webhook action
 */
async function executeWebhook(
  action: WorkflowAction,
  context: Record<string, unknown>,
  isTest: boolean,
): Promise<unknown> {
  const url = action.config.webhookUrl as string;
  const method = (action.config.webhookMethod as string) || "POST";

  if (!url) {
    throw new Error("No webhook URL specified");
  }

  // SSRF guard (also validates in test mode so authors see the error early).
  assertSafeWebhookUrl(url);

  if (isTest) {
    return {
      action: "webhook",
      url,
      method,
      wouldSend: context,
      isTest: true,
    };
  }

  const response = await fetch(url, {
    method,
    // Do NOT follow redirects: assertSafeWebhookUrl only validates the initial
    // host, so an allowed public host that 3xx-redirects to an internal address
    // (e.g. 169.254.169.254) would otherwise be an SSRF bypass. "manual" returns
    // an opaqueredirect response instead of following it.
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      ...((action.config.webhookHeaders as Record<string, string>) || {}),
    },
    body: method !== "GET" ? JSON.stringify(context) : undefined,
  });

  if (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  ) {
    throw new Error("Webhook endpoint attempted a redirect (not allowed)");
  }

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status}`);
  }

  return { status: response.status, url };
}

/**
 * Evaluate workflow conditions against the run context (AND logic). Moved here
 * from trigger-workflow-event: matching now happens in enqueue_workflow_event, so
 * conditions are enforced at execution time.
 */
function evaluateConditions(
  conditions: Array<{ field: string; operator: string; value: unknown }>,
  context: Record<string, unknown>,
): boolean {
  for (const condition of conditions) {
    const fieldValue = getNestedValue(context, condition.field);
    if (!evaluateCondition(fieldValue, condition.operator, condition.value)) {
      return false;
    }
  }
  return true;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce((current, key) => (current as Record<string, unknown>)?.[key], obj);
}

function evaluateCondition(
  fieldValue: unknown,
  operator: string,
  expectedValue: unknown,
): boolean {
  switch (operator) {
    case "equals":
      return fieldValue === expectedValue;
    case "not_equals":
      return fieldValue !== expectedValue;
    case "contains":
      return String(fieldValue).includes(String(expectedValue));
    case "not_contains":
      return !String(fieldValue).includes(String(expectedValue));
    case "greater_than":
      return Number(fieldValue) > Number(expectedValue);
    case "less_than":
      return Number(fieldValue) < Number(expectedValue);
    case "in":
      return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
    case "not_in":
      return (
        Array.isArray(expectedValue) && !expectedValue.includes(fieldValue)
      );
    default:
      return true;
  }
}

/**
 * Update field action
 */
async function executeUpdateField(
  action: WorkflowAction,
  context: Record<string, unknown>,
  isTest: boolean,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  workflow: Record<string, unknown>,
): Promise<unknown> {
  const fieldName = action.config.fieldName as string;
  const fieldValue = action.config.fieldValue;

  if (!fieldName) {
    throw new Error("No field name specified for update_field action");
  }

  if (isTest) {
    return {
      action: "update_field",
      field: fieldName,
      value: fieldValue,
      isTest: true,
    };
  }

  // targetId/targetTable come from the (client-supplied) event context, and this
  // runs on the service-role admin client which BYPASSES RLS. Everything below is
  // the tenant + privilege guard that keeps a crafted context from writing across
  // IMOs or escalating privilege.
  const targetId = context.targetId as string;
  const targetTable = context.targetTable as string;

  if (!targetId || !targetTable) {
    throw new Error("No target specified for field update");
  }

  const workflowImoId = workflow.imo_id as string | null;
  if (!workflowImoId) {
    throw new Error("update_field requires a tenant-scoped (imo_id) workflow");
  }

  // Per-table policy: which column ties a row to a tenant, and which columns may
  // NEVER be written (identity / privilege / tenant-move / billing). Only tables
  // with a verified tenant column are permitted; others are rejected (the UI does
  // not author update_field today, so this regresses nothing).
  const TABLE_POLICY: Record<
    string,
    { tenantColumn: string; denyFields: string[] }
  > = {
    user_profiles: {
      tenantColumn: "imo_id",
      denyFields: [
        "id",
        "imo_id",
        "agency_id",
        "auth_id",
        "user_id",
        "email",
        "is_super_admin",
        "is_admin",
        "archived_at",
        "role",
        "roles",
        "contract_level",
        "upline_id",
        "recruiter_id",
        "created_by",
        "agent_status",
        "stripe_customer_id",
      ],
    },
  };

  const policy = TABLE_POLICY[targetTable];
  if (!policy) {
    console.error(
      `[update_field] Rejected write to unsupported table: ${targetTable}`,
    );
    throw new Error(
      `Table "${targetTable}" is not allowed for update_field actions`,
    );
  }

  // Block privilege/identity/tenant columns outright, plus any obvious admin flag.
  if (
    policy.denyFields.includes(fieldName) ||
    /(^|_)(is_)?(admin|super|imo|agency|role|password|stripe|subscription)/i.test(
      fieldName,
    )
  ) {
    console.error(`[update_field] Rejected privileged field: ${fieldName}`);
    throw new Error(
      `Field "${fieldName}" cannot be set by update_field actions`,
    );
  }

  // Tenant pre-check: the target row must belong to the workflow's IMO.
  const { data: targetRow, error: lookupError } = await supabase
    .from(targetTable)
    .select(`id, ${policy.tenantColumn}`)
    .eq("id", targetId)
    .eq(policy.tenantColumn, workflowImoId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to verify target row: ${lookupError.message}`);
  }
  if (!targetRow) {
    console.error(
      `[update_field] Target ${targetTable}/${targetId} not in workflow IMO ${workflowImoId}`,
    );
    throw new Error("Target row not found in this tenant");
  }

  // Update is doubly guarded: by id AND by the tenant column.
  const { error } = await supabase
    .from(targetTable)
    .update({ [fieldName]: fieldValue })
    .eq("id", targetId)
    .eq(policy.tenantColumn, workflowImoId);

  if (error) {
    throw new Error(`Failed to update field: ${error.message}`);
  }

  return { updated: true, field: fieldName };
}

/**
 * Build template variables from context and additional data
 */
async function buildTemplateVariables(
  context: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic data shape
  ownerProfile: any,
  supabase: ReturnType<typeof createSupabaseAdminClient>,
): Promise<Record<string, string>> {
  // Start from empty defaults (prevents raw {{tags}} in output)
  const variables: Record<string, string> = initEmptyVariables();

  // Owner/user variables
  variables["user_name"] =
    `${ownerProfile.first_name || ""} ${ownerProfile.last_name || ""}`.trim() ||
    ownerProfile.email;
  variables["user_first_name"] = ownerProfile.first_name || "";
  variables["user_last_name"] = ownerProfile.last_name || "";
  variables["user_email"] = ownerProfile.email;
  variables["company_name"] = Deno.env.get("COMPANY_NAME") || "The Standard HQ";

  // Date variables
  const now = new Date();
  variables["current_date"] = now.toLocaleDateString();
  variables["date_today"] = now.toLocaleDateString(); // alias
  variables["date_tomorrow"] = new Date(
    now.getTime() + 24 * 60 * 60 * 1000,
  ).toLocaleDateString();
  variables["date_next_week"] = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString();
  variables["date_current_year"] = now.getFullYear().toString();
  variables["date_current_month"] = now.toLocaleDateString("en-US", {
    month: "long",
  });

  // Workflow variables
  variables["workflow_name"] = (context.workflowName as string) || "";
  variables["workflow_run_id"] = (context.runId as string) || "";
  variables["app_url"] = Deno.env.get("VITE_APP_URL") || "";

  // Try to get recipient/recruit data
  // First try recipientId, then recipientEmail, then use the workflow owner as fallback
  let recipientProfile = null;

  // recipientId / recipientEmail come from the (client-supplied) event context
  // and this runs on the service-role admin client (RLS bypassed). Scope the
  // lookup to the workflow owner's IMO so a crafted id/email cannot leak another
  // tenant's profile data (name/email/phone/license) into the rendered template.
  const ownerImoId = ownerProfile.imo_id;

  // Skip test IDs, but still try to find by email
  if (
    context.recipientId &&
    context.recipientId !== "test-user-id" &&
    context.recipientId !== "test-recipient"
  ) {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", context.recipientId)
      .eq("imo_id", ownerImoId)
      .single();
    recipientProfile = data;
    console.log("Found recipient by ID:", recipientProfile?.email);
  }

  // If no valid profile yet, try by email
  if (
    !recipientProfile &&
    context.recipientEmail &&
    context.recipientEmail !== "test@example.com"
  ) {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("email", context.recipientEmail as string)
      .eq("imo_id", ownerImoId)
      .single();
    recipientProfile = data;
    console.log("Found recipient by email:", recipientProfile?.email);
  }

  // If we still don't have a recipient, use the workflow owner as fallback
  if (!recipientProfile) {
    console.log(
      "No recipient found, using owner as fallback:",
      ownerProfile.email,
    );
    recipientProfile = ownerProfile;
  }

  if (recipientProfile) {
    // Override recruit variables with actual recipient data (using underscores)
    variables["recruit_name"] =
      `${recipientProfile.first_name || ""} ${recipientProfile.last_name || ""}`.trim() ||
      recipientProfile.email;
    variables["recruit_first_name"] = recipientProfile.first_name || "there";
    variables["recruit_last_name"] = recipientProfile.last_name || "";
    variables["recruit_email"] = recipientProfile.email;
    variables["recruit_phone"] = recipientProfile.phone || "";
    variables["recruit_status"] = recipientProfile.agent_status || "";
    variables["recruit_city"] = recipientProfile.city || "";
    variables["recruit_state"] = recipientProfile.state || "";
    variables["recruit_zip"] = recipientProfile.zip || "";
    variables["recruit_address"] = recipientProfile.street_address || "";
    variables["recruit_contract_level"] =
      recipientProfile.contract_level?.toString() || "";
    variables["recruit_npn"] = recipientProfile.npn || "";
    variables["recruit_license_number"] = recipientProfile.license_number || "";
    variables["recruit_license_expiration"] =
      recipientProfile.license_expiration
        ? new Date(recipientProfile.license_expiration).toLocaleDateString()
        : "";
    variables["recruit_referral_source"] =
      recipientProfile.referral_source || "";
    variables["recruit_facebook"] = recipientProfile.facebook_handle || "";
    variables["recruit_instagram"] = recipientProfile.instagram_username || "";
    variables["recruit_website"] = recipientProfile.personal_website || "";
  }

  // Add any additional context variables (using underscores)
  Object.entries(context).forEach(([key, value]) => {
    if (typeof value === "string" || typeof value === "number") {
      variables[`context_${key}`] = value.toString();
    }
  });

  return variables;
}

/**
 * Replace template variables in text — delegates to shared module
 */
function replaceTemplateVariables(
  text: string,
  variables: Record<string, string>,
  mode: TemplateRenderMode = "text",
): string {
  return sharedReplaceTemplateVariables(text, variables, mode);
}
