import { assertEquals } from "jsr:@std/assert@1";
import {
  actionDailyCap,
  actionRateKey,
  ACTION_RATE_WINDOW_SECONDS,
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
