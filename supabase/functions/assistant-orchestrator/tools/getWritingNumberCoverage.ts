// Carrier writing-number (carrier-appointment) coverage — an RLS-scoped read over
// `agent_writing_numbers`. Answers "which carriers do I have writing numbers with",
// "which carrier appointments am I missing", and (for an upline) "how covered is my
// team / which agents are missing the most".
//
// TENANCY INVARIANT (do not weaken): runs on `ctx.db` — the signed-in user's
// RLS-scoped PostgREST client — and NEVER adminClient / a SECURITY DEFINER RPC. The
// `agent_writing_numbers` SELECT RLS already scopes every read to own
// (agent_id = auth.uid()) ∪ the caller's downline (is_upline_of) ∪ same agency ∪
// imo-admin/super-admin in scope. So `scope:'team'` can never surface an agent the
// caller may not already see in the app, and `scope:'mine'` only narrows further with
// an explicit agent_id filter. RLS is the ceiling regardless of any argument the model
// passes; the filters below can only ever shrink the visible set, never widen it.
//
// PII discipline:
//   - scope 'mine' returns the caller's OWN writing-number VALUES (their data, already
//     shown to them in the Licensing workspace) + carrier names.
//   - scope 'team' returns AGGREGATE coverage only — per-agent FILLED COUNTS and the
//     least-covered carriers. The agent's name embeds via the agent_id → user_profiles
//     FK (the same name the upline already sees in the Team view; inherits user_profiles
//     RLS). It NEVER returns another agent's actual writing-number strings.
//
// An empty result is a real "none" and is available:true — do NOT treat zero rows as
// unavailable.

import type {
  AssistantToolContext,
  RegisteredTool,
  ToolSelectBuilder,
} from "./types.ts";

// Active-carrier set is the denominator for "missing"/"coverage". Mirrors
// CarrierRepository.findActive (is_active = true, scoped to the caller's IMO).
async function fetchActiveCarriers(
  ctx: AssistantToolContext,
): Promise<Array<{ id: string; name: string }>> {
  let q: ToolSelectBuilder = ctx.db
    .from("carriers")
    .select("id, name")
    .eq("is_active", true);
  if (ctx.imoId) q = q.eq("imo_id", ctx.imoId);
  const { data, error } = await q.order("name", { ascending: true });
  if (error) return [];
  const rows = (data as Array<Record<string, unknown>>) ?? [];
  return rows
    .map((r) => ({
      id: typeof r.id === "string" ? r.id : "",
      name: typeof r.name === "string" ? r.name : "",
    }))
    .filter((c) => c.id !== "");
}

const TEAM_PAGE = 1000;
const TEAM_SAFETY_ROWS = 20_000;
const MISSING_LIST_CAP = 60;
const PER_AGENT_CAP = 100;
const LEAST_COVERED_CAP = 15;

function carrierName(r: Record<string, unknown>): string | null {
  const c = r.carriers as { name?: unknown } | null | undefined;
  return c && typeof c === "object" && typeof c.name === "string"
    ? c.name
    : null;
}

function agentName(r: Record<string, unknown>): string {
  const a = r.agent as
    | { first_name?: unknown; last_name?: unknown }
    | null
    | undefined;
  if (!a || typeof a !== "object") return "Unknown agent";
  const first = typeof a.first_name === "string" ? a.first_name : "";
  const last = typeof a.last_name === "string" ? a.last_name : "";
  const full = `${first} ${last}`.trim();
  return full || "Unknown agent";
}

/** The caller's OWN writing-number coverage, with the actual numbers + missing list. */
async function runMine(ctx: AssistantToolContext) {
  const [wnRes, activeCarriers] = await Promise.all([
    ctx.db
      .from("agent_writing_numbers")
      .select("carrier_id, writing_number, status, carriers(name)")
      .eq("agent_id", ctx.userId),
    fetchActiveCarriers(ctx),
  ]);

  if (wnRes.error) return { available: false, reason: "unavailable" };
  const rows = (wnRes.data as Array<Record<string, unknown>>) ?? [];

  const filledCarrierIds = new Set<string>();
  const carriers = rows.map((r) => {
    if (typeof r.carrier_id === "string") filledCarrierIds.add(r.carrier_id);
    return {
      carrier: carrierName(r),
      writingNumber:
        typeof r.writing_number === "string" ? r.writing_number : null,
      status: typeof r.status === "string" ? r.status : null,
    };
  });
  carriers.sort((a, b) => (a.carrier ?? "").localeCompare(b.carrier ?? ""));

  const totalCarriers = activeCarriers.length;
  const filled = filledCarrierIds.size;
  const missingCarriers = activeCarriers
    .filter((c) => !filledCarrierIds.has(c.id))
    .map((c) => c.name);

  return {
    available: true,
    data: {
      scope: "mine",
      // Active carriers in the caller's IMO — the denominator for coverage.
      totalCarriers,
      filled,
      missing: Math.max(0, totalCarriers - filled),
      coveragePct:
        totalCarriers === 0 ? null : Math.round((filled / totalCarriers) * 100),
      // The caller's OWN carrier writing numbers (their data).
      carriers,
      // Carriers with NO writing number yet (capped — there can be many).
      missingCarriers: missingCarriers.slice(0, MISSING_LIST_CAP),
      missingCarriersTruncated: missingCarriers.length > MISSING_LIST_CAP,
    },
  };
}

/**
 * Page through the caller's RLS-visible team writing numbers past PostgREST's
 * max_rows cap. Ordered by `id` and walked with OFFSET (`.range`); the cursor
 * advances by the ACTUAL rows received so a short page never skips rows. Mirrors
 * queryPolicies.sumAllPremiums; same UUID-OFFSET concurrency caveat (not a factor at
 * team scale). `complete:false` means the safety bound was hit and the aggregate is a
 * floor, not the exact picture.
 */
async function fetchTeamRows(
  ctx: AssistantToolContext,
): Promise<{ rows: Array<Record<string, unknown>>; complete: boolean }> {
  const out: Array<Record<string, unknown>> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await ctx.db
      .from("agent_writing_numbers")
      .select(
        "agent_id, carrier_id, carriers(name), agent:user_profiles!agent_writing_numbers_agent_id_fkey(first_name, last_name)",
      )
      .order("id", { ascending: true })
      .range(from, from + TEAM_PAGE - 1);
    if (error) return { rows: out, complete: false };
    const batch = (data as Array<Record<string, unknown>>) ?? [];
    out.push(...batch);
    from += batch.length;
    if (batch.length === 0 || batch.length < TEAM_PAGE) {
      return { rows: out, complete: true };
    }
    if (from >= TEAM_SAFETY_ROWS) return { rows: out, complete: false };
  }
}

/** Aggregate team coverage — per-agent filled counts + least-covered carriers. No PII. */
async function runTeam(ctx: AssistantToolContext) {
  const [{ rows, complete }, activeCarriers] = await Promise.all([
    fetchTeamRows(ctx),
    fetchActiveCarriers(ctx),
  ]);

  const totalCarriers = activeCarriers.length;

  // Per-agent filled count (distinct carriers with a writing number).
  const byAgent = new Map<string, { agent: string; carrierIds: Set<string> }>();
  // Per-carrier agent count (how many agents hold a writing number for it).
  const byCarrier = new Map<string, { carrier: string; agents: Set<string> }>();

  for (const r of rows) {
    const agentId = typeof r.agent_id === "string" ? r.agent_id : null;
    const carrierId = typeof r.carrier_id === "string" ? r.carrier_id : null;
    if (!agentId || !carrierId) continue;

    let a = byAgent.get(agentId);
    if (!a) {
      a = { agent: agentName(r), carrierIds: new Set() };
      byAgent.set(agentId, a);
    }
    a.carrierIds.add(carrierId);

    let c = byCarrier.get(carrierId);
    if (!c) {
      c = { carrier: carrierName(r) ?? "Unknown carrier", agents: new Set() };
      byCarrier.set(carrierId, c);
    }
    c.agents.add(agentId);
  }

  const agentCount = byAgent.size;
  const perAgent = Array.from(byAgent.values())
    .map((a) => ({
      agent: a.agent,
      filled: a.carrierIds.size,
      missing:
        totalCarriers === 0
          ? null
          : Math.max(0, totalCarriers - a.carrierIds.size),
      coveragePct:
        totalCarriers === 0
          ? null
          : Math.round((a.carrierIds.size / totalCarriers) * 100),
    }))
    // Least-covered agents first — that is who needs attention.
    .sort((x, y) => x.filled - y.filled);

  // Active carriers with the fewest agents covered (including ZERO), least first.
  const leastCovered = activeCarriers
    .map((c) => ({
      carrier: c.name,
      agentsCovered: byCarrier.get(c.id)?.agents.size ?? 0,
    }))
    .sort((x, y) => x.agentsCovered - y.agentsCovered);

  return {
    available: true,
    data: {
      scope: "team",
      // Agents (in the caller's downline/agency, RLS-scoped) who have at least one
      // writing number. Agents with ZERO writing numbers do not appear as rows here.
      agentCount,
      totalCarriers,
      totalWritingNumbers: rows.length,
      complete,
      perAgent: perAgent.slice(0, PER_AGENT_CAP),
      perAgentTruncated: perAgent.length > PER_AGENT_CAP,
      leastCoveredCarriers: leastCovered.slice(0, LEAST_COVERED_CAP),
    },
  };
}

async function run(input: Record<string, unknown>, ctx: AssistantToolContext) {
  const scope = input.scope === "team" ? "team" : "mine";
  return scope === "team" ? await runTeam(ctx) : await runMine(ctx);
}

export const getWritingNumberCoverage: RegisteredTool = {
  name: "getWritingNumberCoverage",
  inputSchema: {
    type: "object",
    properties: {
      scope: {
        type: "string",
        enum: ["mine", "team"],
        description:
          "Whose carrier writing-number (appointment) coverage to read: 'mine' = the caller's own carriers (default) — returns each carrier the caller holds a writing number for, the actual number, and the list of active carriers they're still MISSING. 'team' = the caller plus the downline/agency agents they can see — returns AGGREGATE coverage only (each agent's name + how many carriers they have filled, and which carriers the team covers least), never another agent's actual writing-number values. Both are RLS-scoped server-side; the model cannot widen beyond the caller's own team/IMO.",
      },
    },
    additionalProperties: false,
  },
  run,
};
