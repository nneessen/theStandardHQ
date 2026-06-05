// Deno test for the monitor's pure decision brain. Run: deno test decide.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { decideMonitorAction } from "./decide.ts";

const NOW = 1_700_000_000_000;
const RE_ALERT = 6 * 60 * 60_000; // 6h

Deno.test("healthy steady state → nothing", () => {
  const r = decideMonitorAction({
    prevStatus: "up",
    isDown: false,
    nowMs: NOW,
    lastAlertAtMs: null,
    reAlertMs: RE_ALERT,
  });
  assertEquals(r.action, "none");
  assertEquals(r.shouldAlert, false);
  assertEquals(r.patch, {});
});

Deno.test("up → down: first alert sets status, down_since, last_alert", () => {
  const r = decideMonitorAction({
    prevStatus: "up",
    isDown: true,
    nowMs: NOW,
    lastAlertAtMs: null,
    reAlertMs: RE_ALERT,
  });
  assertEquals(r.action, "alert_down");
  assertEquals(r.shouldAlert, true);
  assertEquals(r.patch.monitor_status, "down");
  assertEquals(r.patch.down_since, new Date(NOW).toISOString());
  assertEquals(r.patch.last_alert_at, new Date(NOW).toISOString());
});

Deno.test("still down within cooldown → suppressed, no alert, no write", () => {
  const r = decideMonitorAction({
    prevStatus: "down",
    isDown: true,
    nowMs: NOW,
    lastAlertAtMs: NOW - 60_000, // alerted 1m ago
    reAlertMs: RE_ALERT,
  });
  assertEquals(r.action, "down_suppressed");
  assertEquals(r.shouldAlert, false);
  assertEquals(r.patch, {});
});

Deno.test("still down past cooldown → re-alert, bumps last_alert only", () => {
  const r = decideMonitorAction({
    prevStatus: "down",
    isDown: true,
    nowMs: NOW,
    lastAlertAtMs: NOW - RE_ALERT - 1, // just past cooldown
    reAlertMs: RE_ALERT,
  });
  assertEquals(r.action, "realert_down");
  assertEquals(r.shouldAlert, true);
  assertEquals(r.patch, { last_alert_at: new Date(NOW).toISOString() });
});

Deno.test(
  "still down but last_alert null → re-alert (don't get stuck silent)",
  () => {
    const r = decideMonitorAction({
      prevStatus: "down",
      isDown: true,
      nowMs: NOW,
      lastAlertAtMs: null,
      reAlertMs: RE_ALERT,
    });
    assertEquals(r.action, "realert_down");
    assertEquals(r.shouldAlert, true);
  },
);

Deno.test("down → healthy: recovery alert clears status + down_since", () => {
  const r = decideMonitorAction({
    prevStatus: "down",
    isDown: false,
    nowMs: NOW,
    lastAlertAtMs: NOW - 1000,
    reAlertMs: RE_ALERT,
  });
  assertEquals(r.action, "alert_recovered");
  assertEquals(r.shouldAlert, true);
  assertEquals(r.patch.monitor_status, "up");
  assertEquals(r.patch.down_since, null);
});
