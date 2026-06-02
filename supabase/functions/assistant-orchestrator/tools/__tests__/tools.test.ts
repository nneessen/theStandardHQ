import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { AssistantToolContext, ToolDbClient } from "../types.ts";
import { getPolicyRiskAlerts } from "../getPolicyRiskAlerts.ts";
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

function makeCtx(
  rpcResults: Record<string, { data: unknown; error: unknown }> = {},
) {
  const rpcCalls: RpcCall[] = [];
  const inserts: InsertCall[] = [];
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
  return { ctx, rpcCalls, inserts };
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
