// supabase/functions/trigger-workflow-event/index.ts
// Server-side workflow event matching and execution dispatch.
// Replaces client-side event matching to bypass RLS and ensure reliable execution.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TriggerEventRequest {
  eventName: string;
  context: Record<string, unknown>;
}

interface WorkflowMatch {
  workflowId: string;
  workflowName: string;
  runId?: string;
  status: "triggered" | "skipped_cooldown" | "skipped_conditions" | "failed";
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminSupabase = createSupabaseAdminClient();

  try {
    // =====================================================================
    // AUTHORIZATION — dual gate.
    // (a) Internal edge-to-edge callers pass the service-role key → trusted,
    //     no tenant scoping (system-wide event matching).
    // (b) Otherwise require a valid user JWT. The tenant is derived from the
    //     authenticated caller's profile (NEVER from the request body) and we
    //     only fire workflows whose imo_id matches the caller's imo_id.
    // The only known caller is the browser (workflowEventEmitter.emit) on the
    // user-JWT path; the service-role branch is defensive parity for future
    // internal callers.
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
        .select("imo_id, is_super_admin")
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

      // Default to the caller's home IMO. For SUPER-ADMINS ONLY, honor the acting
      // IMO from their auth metadata (set by the app's IMO switcher) so a super-admin
      // acting as a tenant fires/stamps that tenant's workflows — mirroring the DB's
      // get_effective_imo_id(). The is_super_admin gate is on the trusted profile,
      // never the user-settable metadata, so a non-super-admin cannot self-scope.
      // "__all_imos__" => no scoping (null), like the service-role path.
      callerImoId = callerProfile.imo_id;
      if (callerProfile.is_super_admin) {
        const actingImoId = (
          authData.user.user_metadata as Record<string, unknown> | undefined
        )?.acting_imo_id;
        if (actingImoId === "__all_imos__") {
          callerImoId = null;
        } else if (typeof actingImoId === "string" && actingImoId.length > 0) {
          callerImoId = actingImoId;
        }
      }
    }

    const body: TriggerEventRequest = await req.json();
    const { eventName, context } = body;

    if (!eventName) {
      return new Response(JSON.stringify({ error: "Missing eventName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[trigger-workflow-event] Processing event: ${eventName}`);

    // 1. Record the event in workflow_events (admin client bypasses RLS)
    let eventRecordId: string | null = null;
    try {
      const { data: eventRecord } = await adminSupabase
        .from("workflow_events")
        .insert({
          event_name: eventName,
          context,
          fired_at: new Date().toISOString(),
          workflows_triggered: 0,
          // Stamp the tenant on the event log. Set on the user-JWT path (the caller's
          // IMO); null for service-role/system emits that carry no IMO context.
          imo_id: callerImoId,
        })
        .select("id")
        .single();

      eventRecordId = eventRecord?.id ?? null;
    } catch (err) {
      console.warn("[trigger-workflow-event] Failed to record event:", err);
    }

    // 2. Find ALL active workflows matching this event (admin bypasses RLS)
    const { data: workflows, error: queryError } = await adminSupabase
      .from("workflows")
      .select("*")
      .eq("status", "active")
      .eq("trigger_type", "event")
      .contains("config", { trigger: { eventName } });

    if (queryError) {
      console.error("[trigger-workflow-event] Query error:", queryError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to query workflows: ${queryError.message}`,
          workflowsTriggered: 0,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Additional filter to confirm event name match. On the user-JWT path also
    // scope strictly to the caller's tenant so a user can never fire (or probe)
    // another IMO's workflows.
    const matchingWorkflows = (workflows || []).filter((w) => {
      const trigger = w.config?.trigger;
      if (trigger?.eventName !== eventName) return false;
      if (callerImoId !== null && w.imo_id !== callerImoId) return false;
      return true;
    });

    console.log(
      `[trigger-workflow-event] Found ${matchingWorkflows.length} matching workflows for: ${eventName}`,
    );

    if (matchingWorkflows.length === 0) {
      // Update event record with 0 workflows triggered
      return new Response(
        JSON.stringify({
          success: true,
          workflowsTriggered: 0,
          matches: [],
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. For each matching workflow: check cooldown, evaluate conditions, create run, invoke processor
    const matches: WorkflowMatch[] = [];

    for (const workflow of matchingWorkflows) {
      const match: WorkflowMatch = {
        workflowId: workflow.id,
        workflowName: workflow.name,
        status: "triggered",
      };

      try {
        // Check cooldown
        if (workflow.cooldown_minutes) {
          const cooldownTime = new Date();
          cooldownTime.setMinutes(
            cooldownTime.getMinutes() - workflow.cooldown_minutes,
          );

          const { data: recentRuns } = await adminSupabase
            .from("workflow_runs")
            .select("id")
            .eq("workflow_id", workflow.id)
            .gte("started_at", cooldownTime.toISOString())
            .limit(1);

          if (recentRuns && recentRuns.length > 0) {
            match.status = "skipped_cooldown";
            matches.push(match);
            console.log(
              `[trigger-workflow-event] Skipping ${workflow.name}: cooldown active`,
            );
            continue;
          }
        }

        // Evaluate conditions
        const conditions = workflow.conditions || [];
        if (conditions.length > 0 && !evaluateConditions(conditions, context)) {
          match.status = "skipped_conditions";
          matches.push(match);
          console.log(
            `[trigger-workflow-event] Skipping ${workflow.name}: conditions not met`,
          );
          continue;
        }

        // Create workflow run (admin client ensures no RLS issues)
        const { data: run, error: runError } = await adminSupabase
          .from("workflow_runs")
          .insert({
            workflow_id: workflow.id,
            trigger_source: `event:${eventName}`,
            status: "running",
            context: {
              ...context,
              eventName,
              workflowId: workflow.id,
              triggeredBy: context.userId || "system",
              triggeredAt: new Date().toISOString(),
            },
          })
          .select("id")
          .single();

        if (runError) {
          console.error(
            `[trigger-workflow-event] Failed to create run for ${workflow.name}:`,
            runError,
          );
          match.status = "failed";
          match.error = runError.message;
          matches.push(match);
          continue;
        }

        match.runId = run.id;

        // Invoke process-workflow edge function
        // Use fetch to call the function directly (edge-to-edge invocation)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const processResponse = await fetch(
          `${supabaseUrl}/functions/v1/process-workflow`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              runId: run.id,
              workflowId: workflow.id,
              isEventTriggered: true,
            }),
          },
        );

        if (!processResponse.ok) {
          const errorBody = await processResponse.text();
          console.error(
            `[trigger-workflow-event] process-workflow failed for ${workflow.name}:`,
            errorBody,
          );
          match.error = `Processor returned ${processResponse.status}`;
        }

        matches.push(match);
        console.log(
          `[trigger-workflow-event] Triggered workflow: ${workflow.name} (run: ${run.id})`,
        );
      } catch (err) {
        match.status = "failed";
        match.error = err instanceof Error ? err.message : "Unknown error";
        matches.push(match);
        console.error(
          `[trigger-workflow-event] Error processing ${workflow.name}:`,
          err,
        );
      }
    }

    const triggeredCount = matches.filter(
      (m) => m.status === "triggered",
    ).length;

    // Update event record with actual triggered count
    if (eventRecordId) {
      const { error: updateErr } = await adminSupabase
        .from("workflow_events")
        .update({ workflows_triggered: triggeredCount })
        .eq("id", eventRecordId);
      if (updateErr) {
        console.log("workflow_events update failed (non-critical):", updateErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        workflowsTriggered: triggeredCount,
        matches,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[trigger-workflow-event] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
        workflowsTriggered: 0,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

/**
 * Evaluate workflow conditions against the event context (AND logic)
 */
function evaluateConditions(
  conditions: Array<{
    field: string;
    operator: string;
    value: unknown;
  }>,
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
