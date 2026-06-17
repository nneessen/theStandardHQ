// supabase/functions/trigger-workflow-event/index.ts
// Server-side workflow event INGEST. Authenticates the caller, derives the tenant
// (never from the body), then hands off to enqueue_workflow_event which matches
// active event-workflows and inserts pending runs (insert-only — NO synchronous
// fan-out). A fire-and-forget kick wakes the worker for low latency; pg_cron also
// drains the queue.

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
    //     authenticated caller's profile (NEVER from the request body); only
    //     workflows in that imo_id are matched.
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

      // Default to the caller's home IMO. Super-admins ONLY may act as another
      // IMO via their (trusted-profile-gated) auth metadata, mirroring the DB's
      // get_effective_imo_id(); "__all_imos__" => no scoping (null).
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

    // Best-effort idempotency key: a unique entity id + the emission timestamp
    // (if the caller provided one) so a retried emission can't double-create runs,
    // while a legitimately-repeated event (different timestamp) still fires.
    const ctx = (context ?? {}) as Record<string, unknown>;
    const entityId =
      ctx.policyId ||
      ctx.commissionId ||
      ctx.recruitId ||
      ctx.recipientId ||
      ctx.leadId ||
      ctx.id;
    const dedupeKey = entityId
      ? [eventName, entityId, ctx.timestamp].filter(Boolean).join(":")
      : null;

    // Insert-only match + enqueue (SECURITY DEFINER; service-role only).
    const { data: enqueued, error: enqErr } = await adminSupabase.rpc(
      "enqueue_workflow_event",
      {
        p_event_name: eventName,
        p_imo_id: callerImoId,
        p_context: ctx,
        p_dedupe_key: dedupeKey,
      },
    );

    if (enqErr) {
      console.error("[trigger-workflow-event] enqueue failed:", enqErr);
      return new Response(
        JSON.stringify({ success: false, error: enqErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Low-latency kick: wake the worker now (don't await; pg_cron also drains).
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      void fetch(`${supabaseUrl}/functions/v1/process-pending-workflows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
      }).catch(() => {});
    } catch {
      /* ignore kick failures — the cron heartbeat will pick the runs up */
    }

    return new Response(
      JSON.stringify({ success: true, workflowsTriggered: enqueued ?? 0 }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[trigger-workflow-event] error:", err);
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
