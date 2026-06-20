// Deno unit tests for checkRateLimit's failClosed contract.
//
// failClosed:true  → a limiter fault (RPC resolves-with-error OR rejects/throws) ⇒ allowed:false
// failClosed unset → SAME faults ⇒ allowed:true (legacy fail-open; crm-leads + AI fns rely on it)
//
// run: deno test --allow-all supabase/functions/_shared/rate-limit.test.ts

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { checkRateLimit } from "./rate-limit.ts";

// deno-lint-ignore no-explicit-any
function admin(rpc: () => Promise<{ data: unknown; error: unknown }>): any {
  return { rpc: () => rpc() };
}

const opts = (failClosed?: boolean) => ({
  key: "ratelimit:test",
  maxRequests: 10,
  windowSeconds: 60,
  ...(failClosed === undefined ? {} : { failClosed }),
});

Deno.test("normal allowed row passes through unchanged", async () => {
  const r = await checkRateLimit(
    admin(() =>
      Promise.resolve({
        data: [{ allowed: true, requests_used: 3, tokens_used: 0, retry_after_seconds: 50 }],
        error: null,
      })
    ),
    opts(),
  );
  assertEquals(r.allowed, true);
  assertEquals(r.requestsUsed, 3);
});

Deno.test("normal denied row passes through as not-allowed", async () => {
  const r = await checkRateLimit(
    admin(() =>
      Promise.resolve({
        data: [{ allowed: false, requests_used: 11, tokens_used: 0, retry_after_seconds: 30 }],
        error: null,
      })
    ),
    opts(),
  );
  assertEquals(r.allowed, false);
  assertEquals(r.retryAfterSeconds, 30);
});

Deno.test("failClosed + RPC resolves-with-error ⇒ blocked", async () => {
  const r = await checkRateLimit(
    admin(() => Promise.resolve({ data: null, error: { message: "statement timeout" } })),
    opts(true),
  );
  assertEquals(r.allowed, false);
  assertEquals(r.retryAfterSeconds, 60);
});

Deno.test("failClosed + RPC rejects/throws ⇒ blocked", async () => {
  const r = await checkRateLimit(
    admin(() => Promise.reject(new Error("connection reset"))),
    opts(true),
  );
  assertEquals(r.allowed, false);
});

Deno.test("default (no failClosed) + resolves-with-error ⇒ fail OPEN (backward-compat)", async () => {
  const r = await checkRateLimit(
    admin(() => Promise.resolve({ data: null, error: { message: "boom" } })),
    opts(),
  );
  assertEquals(r.allowed, true);
});

Deno.test("default (no failClosed) + RPC rejects/throws ⇒ PROPAGATES (legacy behaviour unchanged)", async () => {
  // Surgical contract: a throw is only caught when failClosed is set. For legacy callers
  // the reject propagates exactly as it did before this flag existed — so this shared
  // change can never silently fail-open (or fail-closed) an existing caller on a throw.
  await assertRejects(
    () =>
      checkRateLimit(
        admin(() => Promise.reject(new Error("connection reset"))),
        opts(),
      ),
    Error,
    "connection reset",
  );
});
