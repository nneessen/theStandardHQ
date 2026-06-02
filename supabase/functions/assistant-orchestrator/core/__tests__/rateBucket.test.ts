import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import {
  REQUEST_MAX_PER_HOUR_TYPED,
  REQUEST_MAX_PER_HOUR_VOICE,
  requestRateBucket,
} from "../rateBucket.ts";

const UID = "d0d3edea-af6d-4990-80b8-1765ba829896";

Deno.test("typed surface keeps the original orchestrator bucket + 30/hr cap", () => {
  const b = requestRateBucket(UID, false);
  assertEquals(b.key, `ratelimit:req:assistant-orchestrator:${UID}`);
  assertEquals(b.maxRequests, 30);
  assertEquals(b.maxRequests, REQUEST_MAX_PER_HOUR_TYPED);
});

Deno.test("voice surface gets a DISTINCT bucket with the higher cap", () => {
  const b = requestRateBucket(UID, true);
  assertEquals(b.key, `ratelimit:req:assistant-voice:${UID}`);
  assertEquals(b.maxRequests, REQUEST_MAX_PER_HOUR_VOICE);
});

Deno.test("voice and typed buckets never collide (would let voice trip the typed cap)", () => {
  const typed = requestRateBucket(UID, false);
  const voice = requestRateBucket(UID, true);
  assertNotEquals(typed.key, voice.key);
});

Deno.test("voice cap is high enough that a long spoken session never self-throttles", () => {
  // A 30-minute call at ~12 turns/min = ~360 turns; the cap must clear that with margin.
  const b = requestRateBucket(UID, true);
  assertEquals(b.maxRequests >= 360, true);
});

Deno.test("the bucket key is per-user (carries the uid)", () => {
  const a = requestRateBucket("user-a", true);
  const b = requestRateBucket("user-b", true);
  assertNotEquals(a.key, b.key);
});
