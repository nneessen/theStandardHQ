import { assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import {
  REQUEST_MAX_PER_HOUR_TYPED,
  REQUEST_MAX_PER_HOUR_VOICE,
  requestRateBucket,
  TOKEN_MAX_PER_DAY_TYPED,
  TOKEN_MAX_PER_DAY_VOICE,
  tokenRateBucket,
} from "../rateBucket.ts";

const UID = "d0d3edea-af6d-4990-80b8-1765ba829896";

Deno.test(
  "typed surface keeps the original orchestrator bucket + 30/hr cap",
  () => {
    const b = requestRateBucket(UID, false);
    assertEquals(b.key, `ratelimit:req:assistant-orchestrator:${UID}`);
    assertEquals(b.maxRequests, 30);
    assertEquals(b.maxRequests, REQUEST_MAX_PER_HOUR_TYPED);
  },
);

Deno.test("voice surface gets a DISTINCT bucket with the higher cap", () => {
  const b = requestRateBucket(UID, true);
  assertEquals(b.key, `ratelimit:req:assistant-voice:${UID}`);
  assertEquals(b.maxRequests, REQUEST_MAX_PER_HOUR_VOICE);
});

Deno.test(
  "voice and typed buckets never collide (would let voice trip the typed cap)",
  () => {
    const typed = requestRateBucket(UID, false);
    const voice = requestRateBucket(UID, true);
    assertNotEquals(typed.key, voice.key);
  },
);

Deno.test(
  "voice cap is high enough that a long spoken session never self-throttles",
  () => {
    // A 30-minute call at ~12 turns/min = ~360 turns; the cap must clear that with margin.
    const b = requestRateBucket(UID, true);
    assertEquals(b.maxRequests >= 360, true);
  },
);

Deno.test("the bucket key is per-user (carries the uid)", () => {
  const a = requestRateBucket("user-a", true);
  const b = requestRateBucket("user-b", true);
  assertNotEquals(a.key, b.key);
});

Deno.test(
  "typed token bucket keeps the SHARED ratelimit:tok:<uid> key + 200k cap",
  () => {
    // This key is shared with other Anthropic functions — it must not change.
    const b = tokenRateBucket(UID, false);
    assertEquals(b.key, `ratelimit:tok:${UID}`);
    assertEquals(b.maxTokens, 200_000);
    assertEquals(b.maxTokens, TOKEN_MAX_PER_DAY_TYPED);
  },
);

Deno.test(
  "voice token bucket is DISTINCT so a call can't drain the typed budget",
  () => {
    const voice = tokenRateBucket(UID, true);
    const typed = tokenRateBucket(UID, false);
    assertEquals(voice.key, `ratelimit:tok:voice:${UID}`);
    assertEquals(voice.maxTokens, TOKEN_MAX_PER_DAY_VOICE);
    assertNotEquals(voice.key, typed.key);
    // Voice gets the more generous cap (many short turns), still a hard ceiling.
    assertEquals(voice.maxTokens > typed.maxTokens, true);
  },
);

Deno.test("token bucket key is per-user on both surfaces", () => {
  assertNotEquals(
    tokenRateBucket("u-a", true).key,
    tokenRateBucket("u-b", true).key,
  );
  assertNotEquals(
    tokenRateBucket("u-a", false).key,
    tokenRateBucket("u-b", false).key,
  );
});
