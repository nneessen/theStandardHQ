// Process Pending Workflows — the async workflow worker.
// Invoked frequently by pg_cron (via pg_net) and on-demand after an enqueue.
// Claims a batch of DUE pending runs via dequeue_workflow_runs (FOR UPDATE SKIP
// LOCKED — many concurrent workers are safe), invokes process-workflow for each,
// and reaps stale/stuck runs back into the queue.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  // AUTH: service-role only. The worker is invoked by pg_cron (pg_net) and the
  // enqueue kick, both with the service-role key. No user/anon access.
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const bearer = req.headers.get("Authorization")?.startsWith("Bearer ")
    ? req.headers.get("Authorization")!.slice(7)
    : null;
  if (!bearer || bearer !== SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  let batch = 25;
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.batch) batch = Math.min(Math.max(1, Number(body.batch)), 100);
  } catch {
    /* no body */
  }

  try {
    // 1. Reap stale runs (worker died / timed out) back into the queue, and
    //    dead-letter ones that exhausted their attempts.
    const { data: requeued } = await adminSupabase.rpc(
      "requeue_stale_workflow_runs",
      {},
    );

    // 2. Claim a batch of due pending runs (atomic, SKIP LOCKED).
    const { data: claimed, error: claimErr } = await adminSupabase.rpc(
      "dequeue_workflow_runs",
      { p_batch: batch },
    );
    if (claimErr) {
      throw new Error(`dequeue_workflow_runs failed: ${claimErr.message}`);
    }

    const runs =
      (claimed as Array<{ run_id: string; workflow_id: string }>) || [];
    if (runs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          requeued: requeued ?? 0,
          durationMs: Date.now() - startTime,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Process each claimed run. A failed INVOKE leaves the run 'running' (it
    //    was claimed) so the reaper re-queues it after the visibility timeout —
    //    at-least-once with bounded retries (dead-letter on max attempts).
    let ok = 0;
    let failed = 0;
    for (const run of runs) {
      try {
        const { error: invokeError } = await adminSupabase.functions.invoke(
          "process-workflow",
          {
            body: {
              runId: run.run_id,
              workflowId: run.workflow_id,
              isTest: false,
            },
          },
        );
        if (invokeError) throw invokeError;
        ok++;
      } catch (runError) {
        failed++;
        console.error(
          `[worker] invoke failed for run ${run.run_id}:`,
          runError instanceof Error ? runError.message : runError,
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: runs.length,
        ok,
        failed,
        requeued: requeued ?? 0,
        durationMs: Date.now() - startTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[worker] error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
