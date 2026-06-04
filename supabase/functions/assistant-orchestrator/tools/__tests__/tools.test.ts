import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import type {
  AssistantToolContext,
  ToolDbClient,
  ToolSelectBuilder,
} from "../types.ts";
import { getPolicyRiskAlerts } from "../getPolicyRiskAlerts.ts";
import {
  queryPolicies,
  sumAllPremiums,
  type PolicyFilters,
} from "../queryPolicies.ts";
import { getWritingNumberCoverage } from "../getWritingNumberCoverage.ts";
import { getDailyBriefingData } from "../getDailyBriefingData.ts";
import { getLeadPriorities } from "../getLeadPriorities.ts";
import { getRecruitingSnapshot } from "../getRecruitingSnapshot.ts";
import { getClientSnapshot } from "../getClientSnapshot.ts";
import { getMyProduction } from "../getMyProduction.ts";
import { getTeamProductionSummary } from "../getTeamProductionSummary.ts";
import { getTeamLeaderboard } from "../getTeamLeaderboard.ts";
import { draftEmailMessage } from "../draftEmailMessage.ts";

interface RpcCall {
  fn: string;
  args?: Record<string, unknown>;
}
interface InsertCall {
  table: string;
  values: Record<string, unknown>;
}
interface SelectFilter {
  op: string;
  column?: string;
  value?: unknown;
  values?: readonly unknown[];
}
interface SelectCall {
  table: string;
  columns?: string;
  opts?: { count?: string };
  filters: SelectFilter[];
}

type SelectResult = { data: unknown; count: number | null; error: unknown };

function makeCtx(
  rpcResults: Record<string, { data: unknown; error: unknown }> = {},
  selectResults: Record<string, SelectResult> = {},
) {
  const rpcCalls: RpcCall[] = [];
  const inserts: InsertCall[] = [];
  const selectCalls: SelectCall[] = [];

  // Chainable, awaitable SELECT builder mirroring PostgREST: each filter records
  // itself and returns the SAME builder; `then` resolves to a plain
  // { data, count, error } (never another thenable, so awaiting can't recurse).
  const makeSelectBuilder = (call: SelectCall): ToolSelectBuilder => {
    const result = selectResults[call.table] ?? {
      data: null,
      count: null,
      error: null,
    };
    const builder: ToolSelectBuilder = {
      eq(column, value) {
        call.filters.push({ op: "eq", column, value });
        return builder;
      },
      in(column, values) {
        call.filters.push({ op: "in", column, values });
        return builder;
      },
      gte(column, value) {
        call.filters.push({ op: "gte", column, value });
        return builder;
      },
      lte(column, value) {
        call.filters.push({ op: "lte", column, value });
        return builder;
      },
      order(column, opts) {
        call.filters.push({ op: "order", column, value: opts });
        return builder;
      },
      limit(count) {
        call.filters.push({ op: "limit", value: count });
        return builder;
      },
      range(from, to) {
        call.filters.push({ op: "range", values: [from, to] });
        return builder;
      },
      then(onfulfilled, onrejected) {
        return Promise.resolve(result).then(onfulfilled, onrejected);
      },
    };
    return builder;
  };

  const db: ToolDbClient = {
    rpc(fn, args) {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResults[fn] ?? { data: null, error: null });
    },
    from(table) {
      return {
        insert(values) {
          inserts.push({ table, values });
          return {
            select() {
              return {
                single() {
                  return Promise.resolve({
                    data: { id: "act_test_1" },
                    error: null,
                  });
                },
              };
            },
          };
        },
        select(columns, opts) {
          const call: SelectCall = { table, columns, opts, filters: [] };
          selectCalls.push(call);
          return makeSelectBuilder(call);
        },
      };
    },
  };
  const ctx: AssistantToolContext = {
    db,
    userId: "user_1",
    imoId: "imo_1",
    conversationId: "conv_1",
    firstName: "Nick",
    // These tools never touch Close; a not-connected provider is enough.
    close: { getClient: () => Promise.resolve(null) },
    // These tools never run underwriting; fail loudly if one ever does.
    underwriting: {
      run() {
        throw new Error("these tools must not run underwriting");
      },
    },
  };
  return { ctx, rpcCalls, inserts, selectCalls };
}

Deno.test("read tool (getPolicyRiskAlerts) performs NO writes", async () => {
  const { ctx, rpcCalls, inserts } = makeCtx();
  await getPolicyRiskAlerts.run({}, ctx);
  assertEquals(inserts.length, 0);
  assert(rpcCalls.some((c) => c.fn === "get_at_risk_commissions"));
  assert(
    rpcCalls.some((c) => c.fn === "get_user_commission_chargeback_summary"),
  );
});

Deno.test("read tool (getLeadPriorities) performs NO writes", async () => {
  const { ctx, rpcCalls, inserts } = makeCtx();
  await getLeadPriorities.run({ limit: 5 }, ctx);
  assertEquals(inserts.length, 0);
  const call = rpcCalls.find((c) => c.fn === "get_lead_priorities");
  assert(call, "should call get_lead_priorities");
  assertEquals(call?.args?.p_user_id, "user_1");
  assertEquals(call?.args?.p_limit, 5);
});

Deno.test(
  "getLeadPriorities is unavailable (no fabrication) when no leads",
  async () => {
    const { ctx } = makeCtx(); // rpc returns { data: null }
    const res = (await getLeadPriorities.run({}, ctx)) as {
      available: boolean;
    };
    assertEquals(res.available, false);
  },
);

Deno.test("read tool (getRecruitingSnapshot) performs NO writes", async () => {
  const { ctx, rpcCalls, inserts } = makeCtx({
    get_recruiting_leads_stats: { data: { total: 3, pending: 1 }, error: null },
  });
  const res = (await getRecruitingSnapshot.run({}, ctx)) as {
    available: boolean;
  };
  assertEquals(inserts.length, 0);
  assert(rpcCalls.some((c) => c.fn === "get_recruiting_leads_stats"));
  assertEquals(res.available, true);
});

Deno.test("getClientSnapshot summarizes and drops contact PII", async () => {
  const { ctx, inserts } = makeCtx({
    get_clients_with_stats: {
      data: [
        {
          name: "Jane Doe",
          email: "jane@example.com",
          phone: "555",
          date_of_birth: "1980-01-01",
          policy_count: 2,
          active_policy_count: 1,
          total_premium: 1200,
        },
        {
          name: "John Roe",
          email: "john@example.com",
          policy_count: 1,
          active_policy_count: 0,
          total_premium: 400,
        },
      ],
      error: null,
    },
  });
  const res = (await getClientSnapshot.run({}, ctx)) as {
    available: boolean;
    data: {
      summary: { totalClients: number; totalPremium: number };
      topClients: Array<Record<string, unknown>>;
    };
  };
  assertEquals(inserts.length, 0);
  assertEquals(res.available, true);
  assertEquals(res.data.summary.totalClients, 2);
  assertEquals(res.data.summary.totalPremium, 1600);
  // Highest premium first, and NO contact PII leaked into the payload.
  assertEquals(res.data.topClients[0].name, "Jane Doe");
  assertEquals("email" in res.data.topClients[0], false);
  assertEquals("date_of_birth" in res.data.topClients[0], false);
});

Deno.test(
  "getDailyBriefingData performs NO writes and only reads RPCs",
  async () => {
    const { ctx, inserts, rpcCalls } = makeCtx();
    await getDailyBriefingData.run({}, ctx);
    assertEquals(inserts.length, 0);
    assert(rpcCalls.length >= 5);
  },
);

Deno.test(
  "briefing marks every section unavailable when no data (no fabrication)",
  async () => {
    const { ctx } = makeCtx(); // all RPCs return { data: null }
    const res = (await getDailyBriefingData.run({}, ctx)) as {
      sections: Record<string, { available: boolean }>;
    };
    for (const [key, section] of Object.entries(res.sections)) {
      assertEquals(
        section.available,
        false,
        `${key} must be unavailable with no data`,
      );
    }
  },
);

Deno.test(
  "briefing surfaces only the sections that actually have data",
  async () => {
    const { ctx } = makeCtx({
      get_at_risk_commissions: {
        data: [{ commission_id: "c1", risk_level: "HIGH" }],
        error: null,
      },
    });
    const res = (await getDailyBriefingData.run({}, ctx)) as {
      sections: Record<string, { available: boolean }>;
    };
    assertEquals(res.sections.policyRisk.available, true);
    assertEquals(res.sections.teamProduction.available, false);
    assertEquals(res.sections.recruiting.available, false);
  },
);

Deno.test(
  "draftEmailMessage creates a pending_approval row and sends nothing",
  async () => {
    const { ctx, inserts } = makeCtx();
    const res = (await draftEmailMessage.run(
      { subject: "Quick follow-up", body: "Hi there, following up." },
      ctx,
    )) as {
      ok: boolean;
      status: string;
      actionRequestId: string;
      channel: string;
    };

    assertEquals(inserts.length, 1);
    assertEquals(inserts[0].table, "assistant_action_requests");
    assertEquals(inserts[0].values.status, "pending_approval");
    assertEquals(inserts[0].values.channel, "email");
    assertEquals(inserts[0].values.user_id, "user_1");
    assert(res.ok);
    assertEquals(res.status, "pending_approval");
    assertEquals(typeof res.actionRequestId, "string");
  },
);

Deno.test("draftEmailMessage rejects a draft missing its body", async () => {
  const { ctx } = makeCtx();
  await assertRejects(() => draftEmailMessage.run({ subject: "No body" }, ctx));
});

// --- Bug A: personal production (getMyProduction) ---------------------------

Deno.test(
  "getMyProduction returns the caller's own numbers, scoped 'personal', no writes",
  async () => {
    const { ctx, rpcCalls, inserts } = makeCtx({
      get_command_center_summary: {
        data: [
          {
            total_ap: 1000,
            total_ip: 800,
            total_policies: 3,
            total_prospects: 2,
            total_leads_scored: 5,
          },
        ],
        error: null,
      },
    });
    const res = (await getMyProduction.run({}, ctx)) as {
      available: boolean;
      data: { totalAp: number; totalPolicies: number };
    };
    assertEquals(inserts.length, 0);
    const call = rpcCalls.find((c) => c.fn === "get_command_center_summary");
    assert(call, "should call get_command_center_summary");
    assertEquals(call?.args?.p_scope, "personal");
    assertEquals(res.available, true);
    assertEquals(res.data.totalAp, 1000);
    assertEquals(res.data.totalPolicies, 3);
  },
);

Deno.test(
  "getMyProduction treats an all-zero row as available (not 'no data')",
  async () => {
    const { ctx } = makeCtx({
      get_command_center_summary: {
        data: [
          {
            total_ap: 0,
            total_ip: 0,
            total_policies: 0,
            total_prospects: 0,
            total_leads_scored: 0,
          },
        ],
        error: null,
      },
    });
    const res = (await getMyProduction.run({}, ctx)) as {
      available: boolean;
      data: { totalAp: number };
    };
    assertEquals(res.available, true);
    assertEquals(res.data.totalAp, 0);
  },
);

// --- Bug B Part 1: team aggregate (getTeamProductionSummary) ----------------

Deno.test(
  "getTeamProductionSummary returns one caller-scoped aggregate, scoped 'team'",
  async () => {
    const { ctx, rpcCalls, inserts } = makeCtx({
      get_command_center_summary: {
        data: [
          {
            total_ap: 40000,
            total_ip: 32000,
            total_policies: 90,
            total_prospects: 4,
            total_leads_scored: 60,
          },
        ],
        error: null,
      },
    });
    const res = (await getTeamProductionSummary.run({}, ctx)) as {
      available: boolean;
      data: { team: { totalAp: number; totalPolicies: number } };
    };
    assertEquals(inserts.length, 0);
    const call = rpcCalls.find((c) => c.fn === "get_command_center_summary");
    assertEquals(call?.args?.p_scope, "team");
    // It must NOT call the IMO-wide leaderboard RPC anymore (the Bug B leak).
    assert(!rpcCalls.some((c) => c.fn === "get_team_leaderboard_data"));
    assertEquals(res.available, true);
    assertEquals(res.data.team.totalAp, 40000);
    assertEquals(res.data.team.totalPolicies, 90);
  },
);

// --- Bug B Part 2: per-member leaderboard (getTeamLeaderboard) --------------

Deno.test(
  "getTeamLeaderboard ranks the caller's own team via get_my_team_leaderboard, no writes",
  async () => {
    const { ctx, rpcCalls, inserts } = makeCtx({
      get_my_team_leaderboard: {
        data: [
          {
            member_id: "u1",
            member_name: "Ada Agent",
            ip_total: 5000,
            ap_total: 6000,
            policy_count: 12,
            rank_overall: 1,
          },
          {
            member_id: "u2",
            member_name: "Bo Agent",
            ip_total: 1000,
            ap_total: 1200,
            policy_count: 3,
            rank_overall: 2,
          },
        ],
        error: null,
      },
    });
    const res = (await getTeamLeaderboard.run({}, ctx)) as {
      available: boolean;
      data: { members: Array<Record<string, unknown>> };
    };
    assertEquals(inserts.length, 0);
    assert(rpcCalls.some((c) => c.fn === "get_my_team_leaderboard"));
    assertEquals(res.available, true);
    assertEquals(res.data.members.length, 2);
    assertEquals(res.data.members[0].name, "Ada Agent");
    assertEquals(res.data.members[0].rank, 1);
    // member_id (a UUID) is intentionally dropped from the model payload.
    assertEquals("member_id" in res.data.members[0], false);
  },
);

Deno.test(
  "getTeamLeaderboard is unavailable (no fabrication) with no rows",
  async () => {
    const { ctx } = makeCtx(); // get_my_team_leaderboard returns { data: null }
    const res = (await getTeamLeaderboard.run({}, ctx)) as {
      available: boolean;
    };
    assertEquals(res.available, false);
  },
);

// --- queryPolicies: flexible RLS-scoped policy queries ----------------------

// Raw PostgREST-shaped rows. Row 0 deliberately carries PII columns (notes,
// client_id, user_id) the tool must NEVER surface, even though they aren't in
// SAFE_COLS, to prove safeShape is a hard allowlist.
const POLICY_ROWS = [
  {
    status: "pending",
    lifecycle_status: null,
    product: "term_life",
    annual_premium: 1200,
    monthly_premium: 100,
    submit_date: "2026-05-20",
    effective_date: "2026-06-01",
    expiration_date: null,
    cancellation_date: null,
    policy_number: "PN-1",
    payment_frequency: "monthly",
    carriers: { name: "Acme Life" },
    clients: { name: "Jane Client" },
    notes: "private underwriting note",
    client_id: "client-uuid-xyz",
    user_id: "some-other-user",
    cancellation_reason: "should never surface",
  },
  {
    status: "pending",
    lifecycle_status: "active",
    product: "whole_life",
    annual_premium: 800,
    monthly_premium: 70,
    submit_date: "2026-05-18",
    effective_date: "2026-05-25",
    expiration_date: null,
    cancellation_date: null,
    policy_number: "PN-2",
    payment_frequency: "monthly",
    carriers: { name: "Beta Mutual" },
  },
];

Deno.test(
  "queryPolicies lists policies with an exact count, applies filters, writes nothing, and leaks no PII",
  async () => {
    const { ctx, inserts, selectCalls } = makeCtx(
      {},
      { policies: { data: POLICY_ROWS, count: 2, error: null } },
    );
    const res = (await queryPolicies.run(
      {
        scope: "mine",
        status: ["Pending"], // mixed-case: tool lowercases before .in()
        dateField: "submit_date",
        startDate: "2026-05-15",
        endDate: "2026-05-31",
      },
      ctx,
    )) as {
      available: boolean;
      data: {
        count: number;
        returned: number;
        truncated: boolean;
        policies: Array<Record<string, unknown>>;
      };
    };

    assertEquals(inserts.length, 0); // read-only
    assertEquals(res.available, true);
    assertEquals(res.data.count, 2);
    assertEquals(res.data.returned, 2);
    assertEquals(res.data.truncated, false);

    const call = selectCalls.find((c) => c.table === "policies");
    assert(call, "should SELECT from policies");
    assertEquals(call?.opts?.count, "exact");
    // status filter lowercased + applied as .in
    const statusIn = call?.filters.find(
      (f) => f.op === "in" && f.column === "status",
    );
    assertEquals(statusIn?.values, ["pending"]);
    // date range bound to submit_date
    assert(
      call?.filters.some((f) => f.op === "gte" && f.column === "submit_date"),
    );
    assert(
      call?.filters.some((f) => f.op === "lte" && f.column === "submit_date"),
    );

    // PII allowlist: the client's NAME is surfaced (owner's own book), but the raw
    // client_id UUID and contact PII are NOT.
    const p = res.data.policies[0];
    assertEquals(p.policyNumber, "PN-1");
    assertEquals(p.carrier, "Acme Life");
    assertEquals(p.client, "Jane Client");
    assertEquals(p.status, "pending");
    assertEquals("notes" in p, false);
    assertEquals("client_id" in p, false);
    assertEquals("user_id" in p, false);
    assertEquals("cancellation_reason" in p, false);
  },
);

Deno.test(
  "queryPolicies scope 'mine' narrows to the caller's user_id; 'team' relies on RLS only",
  async () => {
    const mine = makeCtx({}, { policies: { data: [], count: 0, error: null } });
    await queryPolicies.run({ scope: "mine" }, mine.ctx);
    const mineCall = mine.selectCalls.find((c) => c.table === "policies");
    assert(
      mineCall?.filters.some(
        (f) => f.op === "eq" && f.column === "user_id" && f.value === "user_1",
      ),
      "scope 'mine' must add user_id = caller",
    );

    const team = makeCtx({}, { policies: { data: [], count: 0, error: null } });
    await queryPolicies.run({ scope: "team" }, team.ctx);
    const teamCall = team.selectCalls.find((c) => c.table === "policies");
    assertEquals(
      teamCall?.filters.some((f) => f.op === "eq" && f.column === "user_id"),
      false,
      "scope 'team' must NOT add a user_id filter (RLS scopes the subtree)",
    );

    // Default scope (no arg) behaves as 'mine'.
    const def = makeCtx({}, { policies: { data: [], count: 0, error: null } });
    await queryPolicies.run({}, def.ctx);
    const defCall = def.selectCalls.find((c) => c.table === "policies");
    assert(
      defCall?.filters.some((f) => f.op === "eq" && f.column === "user_id"),
      "default scope must behave as 'mine'",
    );
  },
);

Deno.test(
  "queryPolicies treats zero matches as available:true (a real 'none', not unavailable)",
  async () => {
    const { ctx } = makeCtx(
      {},
      { policies: { data: [], count: 0, error: null } },
    );
    const res = (await queryPolicies.run({}, ctx)) as {
      available: boolean;
      data: { count: number; returned: number; truncated: boolean };
    };
    assertEquals(res.available, true);
    assertEquals(res.data.count, 0);
    assertEquals(res.data.returned, 0);
    assertEquals(res.data.truncated, false);
  },
);

Deno.test(
  "queryPolicies flags truncation and delegates AP/IP to a second numeric-only sum pass",
  async () => {
    // 2 rows returned but 6 match overall → truncated. The capped display query can only
    // see 2 rows, so the totals come from a SECOND pass over just the premium columns.
    // This test pins the WIRING (truncation flagged, second pass fires with the right
    // shape, premiumsComplete surfaced); the cross-page sum ARITHMETIC is covered by the
    // dedicated sumAllPremiums tests below (makeCtx returns one fixed page and so cannot
    // simulate real pagination, which is exactly why the arithmetic is tested separately).
    const { ctx, selectCalls } = makeCtx(
      {},
      { policies: { data: POLICY_ROWS, count: 6, error: null } },
    );
    const res = (await queryPolicies.run({ limit: 2 }, ctx)) as {
      data: {
        count: number;
        returned: number;
        truncated: boolean;
        premiumsComplete: boolean;
      };
    };
    assertEquals(res.data.count, 6);
    assertEquals(res.data.returned, 2);
    assertEquals(res.data.truncated, true);
    assertEquals(res.data.premiumsComplete, true);

    const policyCalls = selectCalls.filter((c) => c.table === "policies");
    assert(policyCalls.length >= 2, "display query + at least one sum pass");

    // The display query is capped at the requested limit.
    assertEquals(
      policyCalls[0].filters.find((f) => f.op === "limit")?.value,
      2,
    );

    // The sum pass selects ONLY the two premium columns, orders by the stable PK, and
    // paginates by range (so it can walk past PostgREST's max_rows cap).
    const sumPass = policyCalls[1];
    assertEquals(sumPass.columns, "annual_premium, monthly_premium");
    assert(
      sumPass.filters.some((f) => f.op === "order" && f.column === "id"),
      "sum pass must order by the stable id key",
    );
    assert(
      sumPass.filters.some((f) => f.op === "range"),
      "sum pass must paginate with range()",
    );
  },
);

Deno.test(
  "queryPolicies clamps an oversized limit to the 200 hard cap",
  async () => {
    const { ctx, selectCalls } = makeCtx(
      {},
      { policies: { data: [], count: 0, error: null } },
    );
    await queryPolicies.run({ limit: 9999 }, ctx);
    const limitFilter = selectCalls
      .find((c) => c.table === "policies")
      ?.filters.find((f) => f.op === "limit");
    assertEquals(limitFilter?.value, 200);
  },
);

Deno.test(
  "queryPolicies allowlists the product enum — a typo'd value never reaches .in()",
  async () => {
    // "term" is invalid (the enum is term_life); only the valid value survives.
    const { ctx, selectCalls } = makeCtx(
      {},
      { policies: { data: [], count: 0, error: null } },
    );
    await queryPolicies.run({ product: ["term", "whole_life"] }, ctx);
    const call = selectCalls.find((c) => c.table === "policies");
    const productIn = call?.filters.find(
      (f) => f.op === "in" && f.column === "product",
    );
    assert(productIn, "the valid product value should still filter");
    assertEquals(productIn?.values, ["whole_life"]);

    // When EVERY product value is invalid, omit the filter rather than match nothing.
    const allBad = makeCtx(
      {},
      { policies: { data: [], count: 0, error: null } },
    );
    await queryPolicies.run({ product: ["term", "bogus"] }, allBad.ctx);
    const badCall = allBad.selectCalls.find((c) => c.table === "policies");
    assertEquals(
      badCall?.filters.some((f) => f.op === "in" && f.column === "product"),
      false,
    );
  },
);

Deno.test(
  "queryPolicies allowlists dateField — an unknown column never reaches the query",
  async () => {
    const { ctx, selectCalls } = makeCtx(
      {},
      { policies: { data: [], count: 0, error: null } },
    );
    await queryPolicies.run(
      { dateField: "notes", startDate: "2026-01-01" },
      ctx,
    );
    const call = selectCalls.find((c) => c.table === "policies");
    // The unknown column is rejected; gte + ordering fall back to submit_date.
    assertEquals(
      call?.filters.find((f) => f.op === "gte")?.column,
      "submit_date",
    );
    assertEquals(
      call?.filters.find((f) => f.op === "order")?.column,
      "submit_date",
    );
    assert(!call?.filters.some((f) => f.column === "notes"));

    // A valid dateField passes through.
    const ok = makeCtx({}, { policies: { data: [], count: 0, error: null } });
    await queryPolicies.run(
      { dateField: "effective_date", endDate: "2026-06-30" },
      ok.ctx,
    );
    assertEquals(
      ok.selectCalls
        .find((c) => c.table === "policies")
        ?.filters.find((f) => f.op === "lte")?.column,
      "effective_date",
    );
  },
);

Deno.test(
  "queryPolicies returns available:false on a query error (no fabrication)",
  async () => {
    const { ctx } = makeCtx(
      {},
      { policies: { data: null, count: null, error: { message: "boom" } } },
    );
    const res = (await queryPolicies.run({}, ctx)) as { available: boolean };
    assertEquals(res.available, false);
  },
);

// --- getWritingNumberCoverage: RLS-scoped carrier-appointment coverage ---------------

Deno.test(
  "getWritingNumberCoverage scope 'mine' returns own numbers + missing carriers, filters by agent_id, writes nothing",
  async () => {
    const { ctx, inserts, selectCalls } = makeCtx(
      {},
      {
        agent_writing_numbers: {
          data: [
            {
              carrier_id: "c1",
              writing_number: "WN-111",
              status: "active",
              carriers: { name: "Americo" },
            },
            {
              carrier_id: "c2",
              writing_number: "WN-222",
              status: "active",
              carriers: { name: "Mutual of Omaha" },
            },
          ],
          count: null,
          error: null,
        },
        carriers: {
          data: [
            { id: "c1", name: "Americo" },
            { id: "c2", name: "Mutual of Omaha" },
            { id: "c3", name: "Foresters" },
          ],
          count: null,
          error: null,
        },
      },
    );

    const res = (await getWritingNumberCoverage.run(
      { scope: "mine" },
      ctx,
    )) as {
      available: boolean;
      data: {
        scope: string;
        totalCarriers: number;
        filled: number;
        missing: number;
        coveragePct: number | null;
        carriers: Array<{
          carrier: string | null;
          writingNumber: string | null;
        }>;
        missingCarriers: string[];
      };
    };

    assertEquals(inserts.length, 0); // read-only
    assertEquals(res.available, true);
    assertEquals(res.data.scope, "mine");
    assertEquals(res.data.totalCarriers, 3);
    assertEquals(res.data.filled, 2);
    assertEquals(res.data.missing, 1);
    assertEquals(res.data.coveragePct, 67);
    assertEquals(res.data.missingCarriers, ["Foresters"]);
    // The caller's OWN writing numbers ARE returned (their data).
    assert(res.data.carriers.some((c) => c.writingNumber === "WN-111"));

    // scope 'mine' MUST narrow agent_writing_numbers to the caller's own user_id.
    const wnCall = selectCalls.find((c) => c.table === "agent_writing_numbers");
    assert(wnCall, "should query agent_writing_numbers");
    assert(
      wnCall?.filters.some(
        (f) => f.op === "eq" && f.column === "agent_id" && f.value === "user_1",
      ),
      "must filter agent_id = caller",
    );
    // Active-carrier denominator is IMO-scoped.
    const carrierCall = selectCalls.find((c) => c.table === "carriers");
    assert(
      carrierCall?.filters.some(
        (f) => f.op === "eq" && f.column === "is_active" && f.value === true,
      ),
      "carriers must be filtered to active",
    );
  },
);

Deno.test(
  "getWritingNumberCoverage scope 'mine' treats zero rows as available:true (a real 'none')",
  async () => {
    const { ctx } = makeCtx(
      {},
      {
        agent_writing_numbers: { data: [], count: null, error: null },
        carriers: {
          data: [{ id: "c1", name: "Americo" }],
          count: null,
          error: null,
        },
      },
    );
    const res = (await getWritingNumberCoverage.run({}, ctx)) as {
      available: boolean;
      data: { filled: number; missing: number };
    };
    assertEquals(res.available, true);
    assertEquals(res.data.filled, 0);
    assertEquals(res.data.missing, 1);
  },
);

Deno.test(
  "getWritingNumberCoverage scope 'team' aggregates per-agent coverage and NEVER leaks another agent's numbers",
  async () => {
    const { ctx, inserts, selectCalls } = makeCtx(
      {},
      {
        agent_writing_numbers: {
          data: [
            {
              agent_id: "a1",
              carrier_id: "c1",
              carriers: { name: "Americo" },
              writing_number: "SECRET-1",
              agent: { first_name: "Jane", last_name: "Doe" },
            },
            {
              agent_id: "a1",
              carrier_id: "c2",
              carriers: { name: "Mutual of Omaha" },
              writing_number: "SECRET-2",
              agent: { first_name: "Jane", last_name: "Doe" },
            },
            {
              agent_id: "a2",
              carrier_id: "c1",
              carriers: { name: "Americo" },
              writing_number: "SECRET-3",
              agent: { first_name: "Bob", last_name: "Smith" },
            },
          ],
          count: null,
          error: null,
        },
        carriers: {
          data: [
            { id: "c1", name: "Americo" },
            { id: "c2", name: "Mutual of Omaha" },
            { id: "c3", name: "Foresters" },
          ],
          count: null,
          error: null,
        },
      },
    );

    const res = (await getWritingNumberCoverage.run(
      { scope: "team" },
      ctx,
    )) as {
      available: boolean;
      data: {
        scope: string;
        agentCount: number;
        totalCarriers: number;
        perAgent: Array<{ agent: string; filled: number }>;
        leastCoveredCarriers: Array<{ carrier: string; agentsCovered: number }>;
      };
    };

    assertEquals(inserts.length, 0);
    assertEquals(res.available, true);
    assertEquals(res.data.scope, "team");
    assertEquals(res.data.agentCount, 2);
    assertEquals(res.data.totalCarriers, 3);
    // least-covered first: Bob (1) before Jane (2).
    assertEquals(res.data.perAgent[0].agent, "Bob Smith");
    assertEquals(res.data.perAgent[0].filled, 1);
    // Foresters has zero agents covered and must surface as least-covered.
    assert(
      res.data.leastCoveredCarriers.some(
        (c) => c.carrier === "Foresters" && c.agentsCovered === 0,
      ),
    );
    // PII guard: no individual writing-number value leaks into the team payload.
    const serialized = JSON.stringify(res.data);
    assert(!serialized.includes("SECRET-"), "team scope must not leak numbers");
    // team scope must NOT add an agent_id eq filter (RLS is the only scope).
    const wnCall = selectCalls.find((c) => c.table === "agent_writing_numbers");
    assert(
      !wnCall?.filters.some((f) => f.op === "eq" && f.column === "agent_id"),
      "team scope relies on RLS, not an explicit agent_id filter",
    );
  },
);

// --- sumAllPremiums: the cross-page accumulation arithmetic (the money path) ---------
//
// queryPolicies' display-query mock returns one page, so it cannot exercise the
// multi-page walk. This focused mock returns a SEQUENCE of pages keyed by call order
// and records every range() so we can assert the cursor never skips or double-counts.

const SUM_FILTERS: PolicyFilters = {
  scope: "team",
  userId: "user_1",
  statuses: null,
  lifecycles: null,
  products: [],
  dateField: "submit_date",
  startDate: null,
  endDate: null,
};

function makePagedCtx(
  pages: Array<
    Array<{ annual_premium: number | null; monthly_premium: number }>
  >,
) {
  const ranges: Array<[number, number]> = [];
  let call = 0;
  const builder: ToolSelectBuilder = {
    eq: () => builder,
    in: () => builder,
    gte: () => builder,
    lte: () => builder,
    order: () => builder,
    limit: () => builder,
    range(from, to) {
      ranges.push([from, to]);
      return builder;
    },
    then(onfulfilled, onrejected) {
      const data = pages[call] ?? [];
      call += 1;
      return Promise.resolve({ data, count: null, error: null }).then(
        onfulfilled,
        onrejected,
      );
    },
  };
  const db = {
    rpc: () => Promise.resolve({ data: null, error: null }),
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      select: () => builder,
    }),
  } as unknown as AssistantToolContext["db"];
  const ctx = {
    db,
    userId: "user_1",
    imoId: null,
    conversationId: "c",
    close: { getClient: () => Promise.resolve(null) },
    underwriting: { run: () => Promise.resolve(null) },
  } as unknown as AssistantToolContext;
  return { ctx, ranges, callCount: () => call };
}

Deno.test(
  "sumAllPremiums walks every page and sums all matches (no skip, no double-count at the page boundary)",
  async () => {
    // pageSize=2, expectedCount=5: two FULL pages then a short final page.
    const { ctx, ranges } = makePagedCtx([
      [
        { annual_premium: 100, monthly_premium: 10 },
        { annual_premium: 200, monthly_premium: 20 },
      ],
      [
        { annual_premium: 300, monthly_premium: 30 },
        { annual_premium: 400, monthly_premium: 40 },
      ],
      [{ annual_premium: 500, monthly_premium: 50 }],
    ]);
    const r = await sumAllPremiums(ctx, SUM_FILTERS, 5, 2, 1_000);
    assertEquals(r.annual, 1500); // 100+200+300+400+500
    assertEquals(r.monthly, 150); // 10+20+30+40+50
    assertEquals(r.complete, true);
    // Cursor advances by ACTUAL rows received → contiguous, non-overlapping ranges, and
    // it stops the moment expectedCount is covered (no wasted trailing empty-page query).
    assertEquals(ranges, [
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  },
);

Deno.test(
  "sumAllPremiums advances by batch length so a SHORT non-final page can never skip rows",
  async () => {
    // Server returns fewer rows than the requested pageSize (e.g. max_rows below
    // pageSize). Advancing by 1 (not by pageSize=10) must still reach all 3 rows.
    const { ctx, ranges } = makePagedCtx([
      [{ annual_premium: 100, monthly_premium: 10 }],
      [{ annual_premium: 200, monthly_premium: 20 }],
      [{ annual_premium: 300, monthly_premium: 30 }],
    ]);
    const r = await sumAllPremiums(ctx, SUM_FILTERS, 3, 10, 1_000);
    assertEquals(r.annual, 600);
    assertEquals(r.complete, true);
    assertEquals(ranges, [
      [0, 9],
      [1, 10],
      [2, 11],
    ]);
  },
);

Deno.test(
  "sumAllPremiums treats null annual_premium as 0 and stops on an empty page (stale count)",
  async () => {
    // expectedCount says 9 but only 2 rows actually exist → empty page terminates the
    // walk (no infinite loop), and a null premium contributes 0.
    const { ctx } = makePagedCtx([
      [
        { annual_premium: null, monthly_premium: 10 },
        { annual_premium: 250, monthly_premium: 20 },
      ],
      [],
    ]);
    const r = await sumAllPremiums(ctx, SUM_FILTERS, 9, 2, 1_000);
    assertEquals(r.annual, 250); // null → 0, + 250
    assertEquals(r.monthly, 30);
    assertEquals(r.complete, true);
  },
);

Deno.test(
  "sumAllPremiums flags premiumsComplete:false when the safety bound is hit",
  async () => {
    // Every page is full and expectedCount is effectively unbounded → the safety bound
    // (safetyRows=4, pageSize=2) trips after 4 rows, returning a floor, not the total.
    const fullPage = [
      { annual_premium: 100, monthly_premium: 10 },
      { annual_premium: 100, monthly_premium: 10 },
    ];
    const { ctx } = makePagedCtx([fullPage, fullPage, fullPage, fullPage]);
    const r = await sumAllPremiums(ctx, SUM_FILTERS, 1_000_000, 2, 4);
    assertEquals(r.complete, false);
    assertEquals(r.annual, 400); // summed 4 rows (2 pages) before the bound
  },
);
