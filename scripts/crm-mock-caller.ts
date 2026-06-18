#!/usr/bin/env -S deno run --allow-net --allow-env
// End-to-end mock caller for the inbound-CRM endpoints. Drives the OAuth token lifecycle
// (Phase 1) AND the /api/v1/leads data lifecycle (Phase 2) against the locally-served functions.
//
// Closes the full loop: POST client_id/secret -> bearer -> verify it -> then exercise GET (AoR
// lookup) / POST (find-create + call event) / PATCH (billable) plus the negatives. The Phase-2
// checks need a seeded fixture (a credential, a pcId registered to an agent, and that agent owning
// the KNOWN_ANI client) — the E2E harness seeds it before serving.
//
// Env: CRM_BASE_URL, CRM_CLIENT_ID, CRM_CLIENT_SECRET, CRM_CALL_PLATFORM_SIGNING_KEY (to verify the
//      returned token), CRM_TEST_PC_ID, CRM_TEST_KNOWN_ANI, CRM_TEST_UNKNOWN_ANI.
//
//   deno run --allow-net --allow-env scripts/crm-mock-caller.ts
import { verifyCrmToken } from "../supabase/functions/_shared/crm-token-decoder.ts";

const BASE =
  Deno.env.get("CRM_BASE_URL") ?? "http://127.0.0.1:54321/functions/v1";
const TOKEN_URL = `${BASE}/crm-oauth-token`;
const LEADS_URL = `${BASE}/crm-leads`;
const CLIENT_ID = Deno.env.get("CRM_CLIENT_ID") ?? "crm_mocktest";
const CLIENT_SECRET = Deno.env.get("CRM_CLIENT_SECRET") ?? "mock-secret-123";
const PC_ID = Deno.env.get("CRM_TEST_PC_ID") ?? "mock-pc-001";
const KNOWN_ANI = Deno.env.get("CRM_TEST_KNOWN_ANI") ?? "555-200-1000";
const UNKNOWN_ANI = Deno.env.get("CRM_TEST_UNKNOWN_ANI") ?? "+19995550000";

let failures = 0;
let bearer: string | null = null;
const tag = () => `phase2-e2e-${crypto.randomUUID()}`;

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

async function leads(
  method: string,
  opts: { ani?: string; body?: unknown; bearer?: string | null } = {},
): Promise<Response> {
  const headers: Record<string, string> = {};
  const b = opts.bearer === undefined ? bearer : opts.bearer;
  if (b) headers["Authorization"] = `Bearer ${b}`;
  let url = LEADS_URL;
  if (opts.ani !== undefined) url += `?ani=${encodeURIComponent(opts.ani)}`;
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.body);
  }
  return await fetch(url, init);
}

// ── Phase 1: token lifecycle ────────────────────────────────────────────────
console.log(`Token endpoint: ${TOKEN_URL}`);
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
  bearer = json.access_token ?? null;
  if (bearer) {
    const payload = await verifyCrmToken(bearer).catch(() => null);
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
{
  const res = await postToken(CLIENT_ID, "wrong-secret");
  check("wrong secret -> 401", res.status === 401, `(got ${res.status})`);
  const json = await res.json().catch(() => ({}));
  check("error is invalid_client", json.error === "invalid_client");
}
{
  const res = await postToken("crm_does_not_exist", CLIENT_SECRET);
  check("unknown client -> 401", res.status === 401, `(got ${res.status})`);
  await res.body?.cancel();
}
{
  const res = await fetch(TOKEN_URL, { method: "GET" });
  check("token endpoint GET -> 405", res.status === 405, `(got ${res.status})`);
  await res.body?.cancel();
}

// ── Phase 2: leads lifecycle ────────────────────────────────────────────────
console.log(`\nLeads endpoint: ${LEADS_URL}`);
if (!bearer) {
  check("leads lifecycle", false, "(skipped — token mint failed)");
} else {
  // GET — AoR lookup
  {
    const res = await leads("GET", { ani: KNOWN_ANI });
    check("GET known ANI -> 200", res.status === 200, `(got ${res.status})`);
    const j = await res.json().catch(() => ({}));
    check(`GET returns pcId=${PC_ID}`, j.pcId === PC_ID, `(got ${j.pcId})`);
  }
  {
    const res = await leads("GET", { ani: UNKNOWN_ANI });
    check("GET unknown ANI -> 204", res.status === 204, `(got ${res.status})`);
    await res.body?.cancel();
  }
  {
    const res = await leads("GET", { ani: "abc" });
    check(
      "GET malformed ANI -> 400",
      res.status === 400,
      `(got ${res.status})`,
    );
    await res.body?.cancel();
  }

  // POST — find/create + call event (idempotent)
  const tagA = tag();
  let idA: string | null = null;
  {
    const res = await leads("POST", {
      body: { requestTag: tagA, pcId: PC_ID, ani: KNOWN_ANI, state: "CA" },
    });
    check("POST -> 200", res.status === 200, `(got ${res.status})`);
    const j = await res.json().catch(() => ({}));
    check("POST returns a row id", typeof j.id === "string" && j.id.length > 0);
    idA = j.id ?? null;
  }
  {
    const res = await leads("POST", {
      body: { requestTag: tagA, pcId: PC_ID, ani: KNOWN_ANI },
    });
    check("duplicate POST -> 200", res.status === 200, `(got ${res.status})`);
    const j = await res.json().catch(() => ({}));
    check(
      "duplicate POST is idempotent (same id)",
      j.id === idA,
      `(got ${j.id})`,
    );
  }
  {
    const res = await leads("POST", {
      body: { requestTag: tag(), pcId: "pc-does-not-exist", ani: UNKNOWN_ANI },
    });
    check(
      "POST unknown pcId -> 200",
      res.status === 200,
      `(got ${res.status})`,
    );
    await res.body?.cancel();
  }
  {
    const res = await leads("POST", { body: { pcId: PC_ID, ani: KNOWN_ANI } });
    check(
      "POST missing requestTag -> 400",
      res.status === 400,
      `(got ${res.status})`,
    );
    await res.body?.cancel();
  }

  // PATCH — billable / end of call
  {
    const res = await leads("PATCH", {
      body: { requestTag: tagA, billable: 1, duration: 120 },
    });
    check("PATCH after POST -> 200", res.status === 200, `(got ${res.status})`);
    const j = await res.json().catch(() => ({}));
    check(
      "PATCH after POST is not patch_only",
      j.queued === false,
      `(queued=${j.queued})`,
    );
  }
  {
    const res = await leads("PATCH", {
      body: { requestTag: tag(), billable: 1, ani: UNKNOWN_ANI },
    });
    check(
      "PATCH before POST -> 200",
      res.status === 200,
      `(got ${res.status})`,
    );
    const j = await res.json().catch(() => ({}));
    check(
      "PATCH before POST is patch_only",
      j.queued === true,
      `(queued=${j.queued})`,
    );
  }

  // Malformed-but-present scalars must degrade to 200 (NOT a permanent 500) — guard #2.
  {
    const res = await leads("POST", {
      body: {
        requestTag: tag(),
        pcId: PC_ID,
        ani: KNOWN_ANI,
        callStart: "9am",
        duration: "120abc",
        billable: 40000,
      },
    });
    check(
      "POST with malformed scalars -> 200",
      res.status === 200,
      `(got ${res.status})`,
    );
    await res.body?.cancel();
  }
  {
    const res = await leads("PATCH", {
      body: { requestTag: tag(), billable: 999999 },
    });
    check(
      "PATCH with out-of-range billable -> 200",
      res.status === 200,
      `(got ${res.status})`,
    );
    await res.body?.cancel();
  }

  // Negatives
  {
    const res = await leads("GET", { ani: KNOWN_ANI, bearer: null });
    check("no bearer -> 401", res.status === 401, `(got ${res.status})`);
    await res.body?.cancel();
  }
  {
    const res = await leads("DELETE", {});
    check("leads DELETE -> 405", res.status === 405, `(got ${res.status})`);
    await res.body?.cancel();
  }
}

console.log(
  failures === 0
    ? "\nALL_MOCK_CALLER_CHECKS_PASSED"
    : `\n${failures} CHECK(S) FAILED`,
);
Deno.exit(failures === 0 ? 0 : 1);
