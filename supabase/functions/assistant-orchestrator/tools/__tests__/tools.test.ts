import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { AssistantToolContext, ToolDbClient } from "../types.ts";
import { getPolicyRiskAlerts } from "../getPolicyRiskAlerts.ts";
import { getDailyBriefingData } from "../getDailyBriefingData.ts";
import { getLeadPriorities } from "../getLeadPriorities.ts";
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
