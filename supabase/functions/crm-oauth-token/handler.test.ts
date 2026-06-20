// Deno unit tests for the OAuth token handler's fail-closed DoS rate-limit gates.
//
// The contract under test: the two rate-limit gates run BEFORE the crm_authenticate_credential
// bcrypt RPC, and they fail CLOSED. We prove "before bcrypt" by observing whether the fake
// admin client's crm_authenticate_credential is ever called — if a gate trips (or faults),
// it must NOT be.
//
// run: deno test --allow-all supabase/functions/crm-oauth-token/handler.test.ts

import { assert, assertEquals } from "jsr:@std/assert@1";
import { handleOAuthTokenRequest } from "./handler.ts";

type RpcResult = { data: unknown; error: unknown };

interface FakeAdminOpts {
  rateLimit: () => Promise<RpcResult>;
  onAuthenticate: () => void;
}

// A fake admin client whose .rpc dispatches on the function name:
//   check_rate_limit            → the per-scenario behaviour (resolve or reject)
//   crm_authenticate_credential → records that bcrypt was reached, then returns no row
// deno-lint-ignore no-explicit-any
function fakeAdmin(opts: FakeAdminOpts): any {
  return {
    rpc: (fn: string) => {
      if (fn === "check_rate_limit") return opts.rateLimit();
      if (fn === "crm_authenticate_credential") {
        opts.onAuthenticate();
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

function tokenRequest(): Request {
  return new Request("https://example.functions.supabase.co/crm-oauth-token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-for": "203.0.113.7",
    },
    body: "grant_type=client_credentials&client_id=acme&client_secret=shhh",
  });
}

const allowed = (): Promise<RpcResult> =>
  Promise.resolve({
    data: [{ allowed: true, requests_used: 1, tokens_used: 0, retry_after_seconds: 59 }],
    error: null,
  });
const denied = (retryAfter: number): Promise<RpcResult> =>
  Promise.resolve({
    data: [{ allowed: false, requests_used: 99, tokens_used: 0, retry_after_seconds: retryAfter }],
    error: null,
  });

Deno.test("under-limit: both gates pass, request reaches the bcrypt RPC", async () => {
  let authenticateCalled = false;
  const res = await handleOAuthTokenRequest(tokenRequest(), {
    makeAdminClient: () =>
      fakeAdmin({ rateLimit: allowed, onAuthenticate: () => (authenticateCalled = true) }),
  });
  // The credential stub returns no row → invalid_client 401, which proves we passed the
  // gates and actually reached crm_authenticate_credential.
  assertEquals(authenticateCalled, true);
  assertEquals(res.status, 401);
});

Deno.test("over-limit: 429 is returned BEFORE the bcrypt RPC runs", async () => {
  let authenticateCalled = false;
  const res = await handleOAuthTokenRequest(tokenRequest(), {
    makeAdminClient: () =>
      fakeAdmin({ rateLimit: () => denied(42), onAuthenticate: () => (authenticateCalled = true) }),
  });
  assertEquals(res.status, 429);
  assertEquals(authenticateCalled, false); // bcrypt never reached
  assertEquals(res.headers.get("retry-after"), "42");
  const body = await res.json();
  assertEquals(body.error, "slow_down");
  // The 429 must not echo the client IP nor reveal which gate/shard tripped.
  const raw = JSON.stringify(body).toLowerCase();
  assert(!raw.includes("203.0.113.7"));
  assert(!raw.includes("global"));
  assert(!raw.includes("shard"));
});

Deno.test("limiter RPC resolves-with-error: fail CLOSED ⇒ 429, bcrypt not reached", async () => {
  let authenticateCalled = false;
  const res = await handleOAuthTokenRequest(tokenRequest(), {
    makeAdminClient: () =>
      fakeAdmin({
        rateLimit: () => Promise.resolve({ data: null, error: { message: "statement timeout", code: "57014" } }),
        onAuthenticate: () => (authenticateCalled = true),
      }),
  });
  assertEquals(res.status, 429); // fail-closed, NOT pass-through
  assertEquals(authenticateCalled, false);
  assertEquals(res.headers.get("retry-after"), "60");
});

Deno.test("limiter RPC rejects/throws (transport fault under flood): fail CLOSED ⇒ 429, bcrypt not reached", async () => {
  let authenticateCalled = false;
  const res = await handleOAuthTokenRequest(tokenRequest(), {
    makeAdminClient: () =>
      fakeAdmin({
        rateLimit: () => Promise.reject(new Error("connection reset")),
        onAuthenticate: () => (authenticateCalled = true),
      }),
  });
  assertEquals(res.status, 429); // a thrown limiter call must also fail closed, not surface a 500
  assertEquals(authenticateCalled, false);
});

Deno.test("non-POST is rejected before any admin client is built", async () => {
  let built = false;
  const res = await handleOAuthTokenRequest(
    new Request("https://example.functions.supabase.co/crm-oauth-token", { method: "GET" }),
    { makeAdminClient: () => { built = true; return fakeAdmin({ rateLimit: allowed, onAuthenticate: () => {} }); } },
  );
  assertEquals(res.status, 405);
  assertEquals(built, false);
});

Deno.test("malformed (missing credentials) gets a cheap 400 WITHOUT consuming rate-limit budget", async () => {
  let rateLimitCalled = false;
  let authenticateCalled = false;
  const res = await handleOAuthTokenRequest(
    new Request("https://example.functions.supabase.co/crm-oauth-token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials", // no client_id/secret
    }),
    {
      makeAdminClient: () =>
        fakeAdmin({
          rateLimit: () => { rateLimitCalled = true; return allowed(); },
          onAuthenticate: () => (authenticateCalled = true),
        }),
    },
  );
  assertEquals(res.status, 400);
  assertEquals(rateLimitCalled, false); // budget not spent on malformed traffic
  assertEquals(authenticateCalled, false);
});
