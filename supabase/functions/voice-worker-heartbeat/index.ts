// supabase/functions/voice-worker-heartbeat/index.ts
// Heartbeat receiver for the Jarvis realtime voice worker (services/jarvis-voice-worker).
//
// The worker POSTs here every ~30s while its process is alive (see src/heartbeat.ts).
// We upsert the singleton voice_worker_health row so the monitor (voice-worker-health-check)
// can detect staleness. This is a MACHINE-TO-MACHINE endpoint: it is NOT called by a user,
// so it is deployed with --no-verify-jwt and guarded by a shared HEARTBEAT_TOKEN secret
// (the worker holds no service-role key by design — its only secrets are the LiveKit/STT/TTS
// creds + SUPABASE_ANON_KEY — so a dedicated shared token is the right machine credential).
//
// What the heartbeat proves: the worker's Node event loop is turning and it can reach the
// network. It does NOT prove the worker is still registered with LiveKit (that state is
// private in @livekit/agents@1.4.5). The Fly machine-state check in the monitor complements
// this; the residual "deregistered-but-alive" gap is closed only by a synthetic voice probe.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-heartbeat-token",
};

interface HeartbeatBody {
  machine_id?: string;
  // ISO timestamp of the worker's last LiveKit job (diagnostic only).
  last_job_at?: string | null;
  uptime_s?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  // --- Shared-secret auth (constant work; reject anything that isn't the worker). ---
  const expected = Deno.env.get("HEARTBEAT_TOKEN");
  if (!expected) {
    console.error("[voice-worker-heartbeat] HEARTBEAT_TOKEN not configured");
    return json(500, { ok: false, error: "Server not configured" });
  }
  const provided =
    req.headers.get("x-heartbeat-token") ??
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (provided !== expected) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  let body: HeartbeatBody = {};
  try {
    body = (await req.json()) as HeartbeatBody;
  } catch {
    // A heartbeat with no/invalid body is still a valid liveness signal — keep going.
    body = {};
  }

  const supabase = createSupabaseAdminClient();
  // Upsert the singleton. monitor_status / down_since / last_alert_at are DELIBERATELY omitted:
  // ON CONFLICT only SETs the columns in this payload, so the monitor's de-dup state is preserved
  // across heartbeats (a beat can never reset 'down' and lose the pending recovery alert). The
  // insert branch only fires if the seeded row was deleted — then defaults apply, which is correct.
  const { error } = await supabase.from("voice_worker_health").upsert(
    {
      id: true, // singleton
      last_seen_at: new Date().toISOString(),
      machine_id: body.machine_id ?? null,
      last_job_at: body.last_job_at ?? null,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("[voice-worker-heartbeat] upsert failed:", error.message);
    return json(500, { ok: false, error: "Persist failed" });
  }

  return json(200, { ok: true });
});
