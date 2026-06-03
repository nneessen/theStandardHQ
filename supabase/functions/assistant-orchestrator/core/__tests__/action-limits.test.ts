import { assertEquals } from "jsr:@std/assert@1";
import {
  actionDailyCap,
  actionRateKey,
  ACTION_RATE_WINDOW_SECONDS,
  distinctRecipientDailyCap,
  imoDailySendCeiling,
} from "../action-limits.ts";

Deno.test("actionDailyCap: per-channel caps, null when uncapped", () => {
  assertEquals(actionDailyCap("sms"), 25);
  assertEquals(actionDailyCap("email"), 50);
  assertEquals(actionDailyCap("close_note"), 60);
  assertEquals(actionDailyCap("close_task"), 60);
  assertEquals(actionDailyCap("discord"), null); // not yet capped (PR 2.3)
  assertEquals(actionDailyCap("unknown"), null);
});

Deno.test("actionRateKey: per-user per-channel; daily window", () => {
  assertEquals(actionRateKey("sms", "u1"), "ratelimit:act:sms:u1");
  assertEquals(actionRateKey("email", "u2"), "ratelimit:act:email:u2");
  assertEquals(ACTION_RATE_WINDOW_SECONDS, 86400);
});

Deno.test(
  "distinctRecipientDailyCap: external channels only, null otherwise",
  () => {
    assertEquals(distinctRecipientDailyCap("sms"), 15);
    assertEquals(distinctRecipientDailyCap("email"), 30);
    // Close writes have no recipient — no distinct-recipient axis.
    assertEquals(distinctRecipientDailyCap("close_note"), null);
    assertEquals(distinctRecipientDailyCap("close_task"), null);
    assertEquals(distinctRecipientDailyCap("unknown"), null);
  },
);

Deno.test("distinct-recipient cap sits below the per-call volume cap", () => {
  // The distinct cap must be < the per-call daily cap so the volume budget can
  // include repeats while the number of DISTINCT people stays bounded.
  for (const ch of ["sms", "email"]) {
    const distinct = distinctRecipientDailyCap(ch)!;
    const volume = actionDailyCap(ch)!;
    if (distinct >= volume) {
      throw new Error(
        `distinct cap (${distinct}) must be < volume cap (${volume}) for ${ch}`,
      );
    }
  }
});

Deno.test("imoDailySendCeiling: positive constant", () => {
  assertEquals(imoDailySendCeiling(), 300);
});
