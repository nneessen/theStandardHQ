// supabase/functions/voice-worker-health-check/decide.ts
// The monitor's "brain", extracted as a PURE function so its state machine can be unit-tested
// deterministically (no Fly API, no DB, no clock). Given the previous persisted status, the
// current health verdict, and the clock, it returns the action to take, the row patch to write,
// and whether to fire an alert. The serve handler (index.ts) owns the I/O (read row, query Fly,
// send SMS/email, write patch); this owns the de-dup transitions.

export type MonitorAction =
  | "none" // healthy steady state
  | "alert_down" // healthy -> down: first alert
  | "realert_down" // still down past the cooldown: re-alert
  | "down_suppressed" // still down within cooldown: stay quiet
  | "alert_recovered"; // down -> healthy: recovery alert

export interface DecideInput {
  /** Persisted monitor_status before this run. */
  prevStatus: "up" | "down";
  /** Health verdict for this run (flyDown || heartbeatDown). */
  isDown: boolean;
  nowMs: number;
  /** Persisted last_alert_at in ms, or null if never alerted. */
  lastAlertAtMs: number | null;
  /** Minimum gap before re-alerting a still-down outage. */
  reAlertMs: number;
}

export interface DecideResult {
  action: MonitorAction;
  /** Columns to write to voice_worker_health (empty when nothing changes). */
  patch: {
    monitor_status?: "up" | "down";
    down_since?: string | null;
    last_alert_at?: string;
  };
  /** True for the actions that must dispatch SMS + email. */
  shouldAlert: boolean;
}

export function decideMonitorAction(input: DecideInput): DecideResult {
  const { prevStatus, isDown, nowMs, lastAlertAtMs, reAlertMs } = input;
  const nowIso = new Date(nowMs).toISOString();

  if (isDown && prevStatus === "up") {
    // First detection of an outage.
    return {
      action: "alert_down",
      patch: {
        monitor_status: "down",
        down_since: nowIso,
        last_alert_at: nowIso,
      },
      shouldAlert: true,
    };
  }

  if (isDown && prevStatus === "down") {
    // Already alerted — re-alert only once the cooldown has elapsed (so a long outage isn't
    // silently forgotten, but we don't spam every 15m).
    if (lastAlertAtMs === null || nowMs - lastAlertAtMs > reAlertMs) {
      return {
        action: "realert_down",
        patch: { last_alert_at: nowIso },
        shouldAlert: true,
      };
    }
    return { action: "down_suppressed", patch: {}, shouldAlert: false };
  }

  if (!isDown && prevStatus === "down") {
    // Recovery.
    return {
      action: "alert_recovered",
      patch: { monitor_status: "up", down_since: null },
      shouldAlert: true,
    };
  }

  // Healthy steady state.
  return { action: "none", patch: {}, shouldAlert: false };
}
