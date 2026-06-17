#!/usr/bin/env -S deno run --allow-net --allow-env
// End-to-end mock caller for the inbound-CRM endpoints. Phase 1 exercises the OAuth
// token lifecycle; the GET/POST/PATCH /api/v1/leads calls get added here as Phases 2+ land.
//
// Closes the full loop: POST client_id/secret -> receive a bearer -> VERIFY that bearer
// with the shared signing key (so we know the mint path actually produced a valid token),
// plus the negatives (wrong secret -> 401, unknown client -> 401, GET -> 405).
//
// Env: CRM_BASE_URL (default local serve), CRM_CLIENT_ID, CRM_CLIENT_SECRET,
//      CRM_CALL_PLATFORM_SIGNING_KEY (to verify the returned token).
//
//   deno run --allow-net --allow-env scripts/crm-mock-caller.ts
import { verifyCrmToken } from "../supabase/functions/_shared/crm-token-decoder.ts";

const BASE =
  Deno.env.get("CRM_BASE_URL") ?? "http://127.0.0.1:54321/functions/v1";
const TOKEN_URL = `${BASE}/crm-oauth-token`;
const CLIENT_ID = Deno.env.get("CRM_CLIENT_ID") ?? "crm_mocktest";
const CLIENT_SECRET = Deno.env.get("CRM_CLIENT_SECRET") ?? "mock-secret-123";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    console.error(`  FAIL ${name} ${detail}`);
    failures++;
  }
}

async function postToken(id: string, secret: string): Promise<Response> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });
  return await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

console.log(`Token endpoint: ${TOKEN_URL}`);

// 1) Happy path: mint + verify the returned bearer.
{
  const res = await postToken(CLIENT_ID, CLIENT_SECRET);
  check("token mint returns 200", res.status === 200, `(got ${res.status})`);
  const json = await res.json().catch(() => ({}));
  check(
    "access_token present",
    typeof json.access_token === "string" && json.access_token.length > 0,
  );
  check("token_type is Bearer", json.token_type === "Bearer");
  check("expires_in is 86400", json.expires_in === 86400);
  if (json.access_token) {
    const payload = await verifyCrmToken(json.access_token).catch(() => null);
    check(
      "minted token verifies with the shared signing key",
      payload !== null,
    );
    check("token typ is crm_m2m", payload?.typ === "crm_m2m");
    check(
      "token carries imo_id",
      typeof payload?.imo_id === "string" && (payload?.imo_id?.length ?? 0) > 0,
    );
    check(
      "token carries credential_id",
      typeof payload?.credential_id === "string",
    );
  }
}

// 2) Wrong secret -> 401 invalid_client.
{
  const res = await postToken(CLIENT_ID, "wrong-secret");
  check("wrong secret -> 401", res.status === 401, `(got ${res.status})`);
  const json = await res.json().catch(() => ({}));
  check("error is invalid_client", json.error === "invalid_client");
}

// 3) Unknown client -> 401.
{
  const res = await postToken("crm_does_not_exist", CLIENT_SECRET);
  check("unknown client -> 401", res.status === 401, `(got ${res.status})`);
  await res.body?.cancel();
}

// 4) Wrong method -> 405.
{
  const res = await fetch(TOKEN_URL, { method: "GET" });
  check("GET -> 405", res.status === 405, `(got ${res.status})`);
  await res.body?.cancel();
}

console.log(
  failures === 0
    ? "\nALL_MOCK_CALLER_CHECKS_PASSED"
    : `\n${failures} CHECK(S) FAILED`,
);
Deno.exit(failures === 0 ? 0 : 1);
