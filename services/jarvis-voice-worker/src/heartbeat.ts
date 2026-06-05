// services/jarvis-voice-worker/src/heartbeat.ts
// Outbound liveness heartbeat for the Jarvis voice worker.
//
// The worker is an always-resident process with no public HTTP, so it can't be probed from
// outside. Instead it PUSHES a heartbeat to the voice-worker-heartbeat edge function every
// HEARTBEAT_INTERVAL_MS. A monitor (voice-worker-health-check, run every 15m by a GitHub
// Action) alerts the owner (SMS + email) if the heartbeat goes stale OR the Fly machine is
// not 'started'.
//
// IMPORTANT: start this ONLY in the MAIN worker process, never in per-job subprocesses — the
// SDK forks one subprocess per room and re-imports this module. The caller in agent.ts gates
// on that (a job subprocess runs ipc/job_main.js as argv[1]).
//
// Coverage (deliberately honest): a successful POST proves the Node event loop is turning AND
// the box can reach the network. It does NOT prove the worker is still registered with LiveKit
// — @livekit/agents@1.4.5 keeps that state private (#session/#id), and on LiveKit Cloud a custom
// loadFunc is force-reset to the default, so there is no supported hook to gate on. The Fly
// machine-state check complements this; the residual "deregistered-but-alive" gap is closed only
// by a synthetic voice probe (a future, low-frequency add-on).

const HEARTBEAT_INTERVAL_MS = 30_000;

let lastJobAt: string | null = null;

/** Call from the job entry() each time a real LiveKit job starts (diagnostic context only). */
export function markJobStarted(): void {
  lastJobAt = new Date().toISOString();
}

/**
 * Start the heartbeat loop. No-op (with a one-time log) when HEARTBEAT_TOKEN or SUPABASE_URL is
 * unset, so local dev without secrets simply doesn't heartbeat. Returns a stop() for tests.
 */
export function startHeartbeat(): () => void {
  const token = process.env.HEARTBEAT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!token || !supabaseUrl) {
    console.log(
      "[jarvis] heartbeat disabled (HEARTBEAT_TOKEN/SUPABASE_URL unset)",
    );
    return () => {};
  }
  const url = `${supabaseUrl}/functions/v1/voice-worker-heartbeat`;
  const machineId = process.env.FLY_MACHINE_ID ?? null;
  const startedAt = Date.now();

  const beat = async (): Promise<void> => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-heartbeat-token": token,
        },
        body: JSON.stringify({
          machine_id: machineId,
          last_job_at: lastJobAt,
          uptime_s: Math.round((Date.now() - startedAt) / 1000),
        }),
      });
      if (!res.ok) console.warn(`[jarvis] heartbeat HTTP ${res.status}`);
    } catch (e) {
      // Never throw — a heartbeat failure must not disturb a live call.
      console.warn("[jarvis] heartbeat failed:", (e as Error).message);
    }
  };

  void beat(); // fire once immediately so the monitor sees liveness right after a (re)start
  const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  // Don't let the heartbeat timer hold the event loop open on shutdown.
  if (typeof timer.unref === "function") timer.unref();
  console.log(
    `[jarvis] heartbeat started (every ${HEARTBEAT_INTERVAL_MS / 1000}s) → ${url}`,
  );
  return () => clearInterval(timer);
}
