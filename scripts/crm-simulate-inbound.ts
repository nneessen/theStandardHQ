#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Multi-user inbound-call SIMULATOR for the inbound-CRM endpoints.
//
// Where crm-mock-caller.ts is a single-path correctness driver, THIS streams a batch of
// realistic inbound calls across N seeded agents/pcIds through the real served endpoints
// — the exact loop the external dialer ("Integration Platform") runs per call:
//     GET ?ani  (Agent-of-Record lookup)
//  -> POST       (find/create lead + write the call event; this is what fires the screen-pop)
//  -> PATCH      (set billable / end the call)
// plus edge cases (brand-new caller, unrecognized pcId, a "ringing-no-billing" call), then
// prints a per-call log + a routing summary. Driven by scripts/crm-simulate-inbound.sh.
//
// Env: CRM_BASE_URL, CRM_CLIENT_ID, CRM_CLIENT_SECRET (auth), CRM_SIM_FIXTURES (path to a JSON
//      array of {pcId, phone, agentId, agentName}), CRM_SIM_CALLS (default 24), CRM_SIM_RUN_TAG.

const BASE =
  Deno.env.get("CRM_BASE_URL") ?? "http://127.0.0.1:54321/functions/v1";
const TOKEN_URL = `${BASE}/crm-oauth-token`;
const LEADS_URL = `${BASE}/crm-leads`;
const CLIENT_ID = Deno.env.get("CRM_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("CRM_CLIENT_SECRET") ?? "";
const FIXTURES_PATH = Deno.env.get("CRM_SIM_FIXTURES") ?? "";
const N_CALLS = Number(Deno.env.get("CRM_SIM_CALLS") ?? "24");
const RUN_TAG = Deno.env.get("CRM_SIM_RUN_TAG") ?? "sim-local";

interface Fixture {
  pcId: string;
  phone: string;
  agentId: string;
  agentName: string;
}

const fixtures: Fixture[] = JSON.parse(await Deno.readTextFile(FIXTURES_PATH));
if (fixtures.length === 0) {
  console.error("No fixtures — seed step produced no agents.");
  Deno.exit(1);
}

async function getToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (res.status !== 200) {
    console.error(
      `Token mint failed (${res.status}). Is the env signing key shared with the served fn?`,
    );
    Deno.exit(1);
  }
  return (await res.json()).access_token as string;
}

const bearer = await getToken();
const H = {
  Authorization: `Bearer ${bearer}`,
  "Content-Type": "application/json",
};

async function get(ani: string): Promise<{ status: number; pcId?: string }> {
  const res = await fetch(`${LEADS_URL}?ani=${encodeURIComponent(ani)}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (res.status === 200) return { status: 200, pcId: (await res.json()).pcId };
  await res.body?.cancel();
  return { status: res.status };
}
async function post(b: unknown): Promise<{ status: number; id?: string }> {
  const res = await fetch(LEADS_URL, {
    method: "POST",
    headers: H,
    body: JSON.stringify(b),
  });
  const j =
    res.status === 200 ? await res.json() : (await res.body?.cancel(), {});
  return { status: res.status, id: j.id };
}
async function patch(b: unknown): Promise<number> {
  const res = await fetch(LEADS_URL, {
    method: "PATCH",
    headers: H,
    body: JSON.stringify(b),
  });
  await res.body?.cancel();
  return res.status;
}

// A fresh, unseeded caller number (deterministic per index → reproducible runs).
const newCaller = (i: number) => `+1888${String(7000000 + i).padStart(7, "0")}`;
// Round 12s..900s call durations, deterministic.
const durOf = (i: number) => 30 + ((i * 37) % 600);

interface Row {
  n: number;
  kind: string;
  pcId: string;
  ani: string;
  getStatus: number;
  popAgent: string;
  callId: string;
  billable: string;
}
const rows: Row[] = [];

console.log(
  `\n=== Inbound-call simulation — ${N_CALLS} calls across ${fixtures.length} agents (run ${RUN_TAG}) ===\n`,
);

for (let i = 0; i < N_CALLS; i++) {
  const reqTag = `${RUN_TAG}-${i}`;
  // Call-type mix: every 6th = new caller, every 9th = unknown pcId, every 11th = ringing-no-billing.
  const isUnknownPc = i % 9 === 4;
  const isNewCaller = !isUnknownPc && i % 6 === 5;
  const noBilling = !isUnknownPc && i % 11 === 7;
  const f = fixtures[i % fixtures.length];

  const pcId = isUnknownPc ? "sim-pc-UNREGISTERED" : f.pcId;
  const ani = isUnknownPc
    ? newCaller(900 + i)
    : isNewCaller
      ? newCaller(i)
      : f.phone;
  const kind = isUnknownPc
    ? "unknown-pcId"
    : isNewCaller
      ? "new-caller"
      : noBilling
        ? "ringing(no bill)"
        : "known-caller";

  const g = await get(ani); // pre-call AoR lookup
  const p = await post({
    requestTag: reqTag,
    pcId,
    ani,
    state: "CA",
    callProgram: "sim",
  });
  const resolved = !isUnknownPc; // a known pcId resolves a non-revoked agent => pop
  let billable = "—";
  if (!noBilling && !isUnknownPc) {
    const dur = durOf(i);
    const code = await patch({
      requestTag: reqTag,
      billable: 1,
      duration: dur,
    });
    billable = code === 200 ? `1 / ${dur}s` : `PATCH ${code}`;
  } else if (isUnknownPc) {
    await patch({ requestTag: reqTag, billable: 0, duration: 15 }); // unassigned call still ends
    billable = "0 (unassigned)";
  }
  rows.push({
    n: i + 1,
    kind,
    pcId,
    ani,
    getStatus: g.status,
    popAgent: resolved ? f.agentName : "—",
    callId: p.id ? p.id.slice(0, 8) : `POST ${p.status}`,
    billable,
  });
}

// ── Per-call log ─────────────────────────────────────────────────────────────
const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
console.log(
  pad("#", 3),
  pad("type", 17),
  pad("pcId", 12),
  pad("ANI", 15),
  pad("GET", 5),
  pad("pop→agent", 22),
  pad("callId", 9),
  "billable",
);
console.log("-".repeat(96));
for (const r of rows) {
  console.log(
    pad(String(r.n), 3),
    pad(r.kind, 17),
    pad(r.pcId, 12),
    pad(r.ani, 15),
    pad(String(r.getStatus), 5),
    pad(r.popAgent, 22),
    pad(r.callId, 9),
    r.billable,
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────
const byAgent = new Map<string, number>();
let pops = 0,
  unassigned = 0,
  newCallers = 0,
  ringing = 0;
for (const r of rows) {
  if (r.kind === "unknown-pcId") {
    unassigned++;
    continue;
  }
  pops++;
  if (r.kind === "new-caller") newCallers++;
  if (r.kind === "ringing(no bill)") ringing++;
  byAgent.set(r.popAgent, (byAgent.get(r.popAgent) ?? 0) + 1);
}
console.log(`\n=== Routing summary ===`);
console.log(
  `calls=${rows.length}  screen-pops fired=${pops}  unassigned(unknown pcId)=${unassigned}  new-callers(client created)=${newCallers}  ringing-no-billing=${ringing}`,
);
console.log(`pops per agent:`);
[...byAgent.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([a, c]) => console.log(`  ${pad(a, 28)} ${c}`));
console.log(`\nSIM_DONE`);
