// supabase/functions/voice-worker-health-check/index.ts
// Monitor for the Jarvis realtime voice worker (services/jarvis-voice-worker, on Fly.io).
//
// Triggered every 15 minutes by .github/workflows/voice-worker-health.yml (a dumb cron that
// just curls this function with the service-role key — same pattern as notification-digests /
// scheduled-reports). All logic lives here. It judges worker health from TWO independent
// signals and alerts the owner (SMS + email) on a healthy->down transition, clearing on recovery.
//
// Signals (either one going "down" trips the alert):
//   1. Fly machine-state  — GET the Fly Machines API; is >=1 'app' machine in state "started"?
//      (The stopped standby is EXPECTED and healthy — we only require >=1 started.)
//      Catches: clean stop, exhausted restart-retries, crash sustained past one sample.
//   2. Heartbeat staleness — is voice_worker_health.last_seen_at within STALE_THRESHOLD?
//      Catches: process alive but event-loop wedged (Fly still shows "started").
//   A NULL last_seen_at ABSTAINS (worker may predate the heartbeat deploy) — no false alarm.
//   A failed Fly API call ABSTAINS (transient) — we don't alert on our own monitoring blip.
//
// Residual gap (by design, not built): a worker whose loop turns but is silently deregistered
// from LiveKit, and pure upstream (Deepgram/ElevenLabs/orchestrator) outages — only a synthetic
// voice probe catches those. Add a low-frequency one later if those modes appear.
//
// De-dup: monitor_status in the row means we alert ONCE per transition, not every 15m. A still-
// down outage re-alerts at most every RE_ALERT_MS so it can't be silently forgotten.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createSupabaseAdminClient } from "../_shared/supabase-client.ts";
import { decideMonitorAction } from "./decide.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STALE_THRESHOLD_MS = 3 * 60_000; // 6 missed 30s beats before "stale"
const RE_ALERT_MS = 6 * 60 * 60_000; // re-alert a still-down outage every 6h

interface HealthRow {
  last_seen_at: string | null;
  machine_id: string | null;
  monitor_status: string | null;
  down_since: string | null;
  last_alert_at: string | null;
}

interface FlyMachine {
  id: string;
  state: string;
  region?: string;
}

/** Query the Fly Machines API. Returns null on any error (caller ABSTAINS, never false-alarms). */
async function flyStartedCount(
  app: string,
  token: string,
): Promise<{ started: number; total: number } | null> {
  try {
    const res = await fetch(
      `https://api.machines.dev/v1/apps/${app}/machines`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      console.error(`[health-check] Fly API ${res.status}`);
      return null;
    }
    const machines = (await res.json()) as FlyMachine[];
    if (!Array.isArray(machines)) return null;
    const started = machines.filter((m) => m.state === "started").length;
    return { started, total: machines.length };
  } catch (e) {
    console.error("[health-check] Fly API fetch failed:", (e as Error).message);
    return null;
  }
}

/** Fire-and-await an alert over both channels; one failing must not block the other. */
async function sendAlerts(
  supabaseUrl: string,
  serviceKey: string,
  subject: string,
  body: string,
): Promise<void> {
  const phone = Deno.env.get("VOICE_ALERT_PHONE");
  const email = Deno.env.get("VOICE_ALERT_EMAIL");
  const auth = {
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const tasks: Promise<unknown>[] = [];
  if (phone) {
    tasks.push(
      fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          to: phone,
          message: `${subject}\n${body}`,
          trigger: "voice_worker_health",
        }),
      }).catch((e) =>
        console.error("[health-check] SMS failed:", (e as Error).message),
      ),
    );
  } else {
    console.warn("[health-check] VOICE_ALERT_PHONE unset — skipping SMS");
  }
  if (email) {
    const html = `<p><strong>${subject}</strong></p><pre>${body}</pre>`;
    tasks.push(
      fetch(`${supabaseUrl}/functions/v1/send-automated-email`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          to: email,
          subject,
          html,
          text: `${subject}\n\n${body}`,
        }),
      }).catch((e) =>
        console.error("[health-check] email failed:", (e as Error).message),
      ),
    );
  } else {
    console.warn("[health-check] VOICE_ALERT_EMAIL unset — skipping email");
  }
  await Promise.all(tasks);
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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json(500, { ok: false, error: "Server not configured" });
  }

  // --- Caller auth: trusted server-to-server only (the GH Action passes the service key). ---
  const bearer =
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer !== SERVICE_KEY) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  const FLY_APP = Deno.env.get("FLY_APP_NAME") ?? "standardhq-jarvis-voice";
  const FLY_TOKEN = Deno.env.get("FLY_API_TOKEN");

  const supabase = createSupabaseAdminClient();
  const { data: row, error: readErr } = await supabase
    .from("voice_worker_health")
    .select(
      "last_seen_at, machine_id, monitor_status, down_since, last_alert_at",
    )
    .eq("id", true)
    .maybeSingle<HealthRow>();
  if (readErr) {
    console.error("[health-check] read failed:", readErr.message);
    return json(500, { ok: false, error: "Read failed" });
  }

  const now = Date.now();
  const prevStatus = row?.monitor_status === "down" ? "down" : "up";

  // --- Signal 1: Fly machine-state (abstain on error). ---
  const fly = FLY_TOKEN ? await flyStartedCount(FLY_APP, FLY_TOKEN) : null;
  if (!FLY_TOKEN)
    console.warn("[health-check] FLY_API_TOKEN unset — Fly check skipped");
  const flyDown = fly !== null && fly.started === 0;

  // --- Signal 2: heartbeat staleness (abstain when NULL — predates heartbeat deploy). ---
  const lastSeen = row?.last_seen_at ? Date.parse(row.last_seen_at) : null;
  const staleMs = lastSeen === null ? null : now - lastSeen;
  const heartbeatDown = staleMs !== null && staleMs > STALE_THRESHOLD_MS;

  const isDown = flyDown || heartbeatDown;

  // --- Build a human reason for whichever signal(s) tripped. ---
  const reasons: string[] = [];
  if (flyDown) reasons.push(`Fly: 0/${fly?.total ?? "?"} machines started`);
  if (heartbeatDown)
    reasons.push(
      `heartbeat stale ${Math.round((staleMs as number) / 60_000)}m`,
    );
  if (fly === null && FLY_TOKEN)
    reasons.push("(Fly API unreachable — abstained)");
  const reason = reasons.join("; ") || "all signals healthy";

  // Pure state machine (unit-tested in decide.test.ts) — decides the action, the row patch,
  // and whether to alert. The I/O (alerting + writing the patch) is handled here.
  const decision = decideMonitorAction({
    prevStatus,
    isDown,
    nowMs: now,
    lastAlertAtMs: row?.last_alert_at ? Date.parse(row.last_alert_at) : null,
    reAlertMs: RE_ALERT_MS,
  });

  if (decision.shouldAlert) {
    let subject: string;
    let body: string;
    if (decision.action === "alert_down") {
      subject = "🔴 Jarvis voice worker DOWN";
      body = `Reason: ${reason}\nApp: ${FLY_APP}\nMachine: ${row?.machine_id ?? "?"}\nUsers see the Retry screen; voice is unavailable until this recovers.`;
    } else if (decision.action === "realert_down") {
      const downMin = row?.down_since
        ? Math.round((now - Date.parse(row.down_since)) / 60_000)
        : "?";
      subject = "🔴 Jarvis voice worker STILL DOWN";
      body = `Down ~${downMin}m. Reason: ${reason}\nApp: ${FLY_APP}`;
    } else {
      subject = "🟢 Jarvis voice worker recovered";
      body = `Healthy again. ${reason}\nApp: ${FLY_APP}`;
    }
    await sendAlerts(SUPABASE_URL, SERVICE_KEY, subject, body);
  }

  if (Object.keys(decision.patch).length > 0) {
    const { error: writeErr } = await supabase
      .from("voice_worker_health")
      .update(decision.patch)
      .eq("id", true);
    if (writeErr)
      console.error("[health-check] state write failed:", writeErr.message);
  }

  return json(200, {
    ok: true,
    isDown,
    action: decision.action,
    reason,
    fly: fly ?? "abstained",
    heartbeat_stale_ms: staleMs,
  });
});
