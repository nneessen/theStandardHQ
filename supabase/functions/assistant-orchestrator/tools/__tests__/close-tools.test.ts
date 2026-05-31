import { assert, assertEquals } from "jsr:@std/assert@1";
import type {
  AssistantToolContext,
  CloseReadClient,
  ToolDbClient,
} from "../types.ts";
import { searchCloseLeads } from "../searchCloseLeads.ts";
import { getCloseLeadSnapshot } from "../getCloseLeadSnapshot.ts";
import { getCloseLeadActivity } from "../getCloseLeadActivity.ts";
import { getCloseOpportunities } from "../getCloseOpportunities.ts";
import { draftCloseNote } from "../draftCloseNote.ts";
import { draftCloseTask } from "../draftCloseTask.ts";

// A db that fails loudly if a Close tool ever touches Postgres (they must not).
const noDb: ToolDbClient = {
  rpc() {
    throw new Error("Close tools must not call the DB");
  },
  from() {
    throw new Error("Close tools must not write");
  },
};

interface CloseApiErrorLike extends Error {
  code: string;
  status: number;
}

/**
 * Build a ctx whose Close client serves canned responses by path-substring. Pass
 * `null` for the client to simulate a not-connected user, or an Error to simulate
 * a thrown Close API error.
 */
function makeCtx(opts: {
  client?: CloseReadClient | null;
  routes?: Array<{ match: string; body: unknown }>;
  calls?: string[];
}) {
  const calls = opts.calls ?? [];
  const client: CloseReadClient | null =
    opts.client !== undefined
      ? opts.client
      : {
          get<T>(path: string): Promise<T> {
            calls.push(path);
            const hit = (opts.routes ?? []).find((r) => path.includes(r.match));
            if (!hit) return Promise.resolve({ data: [] } as unknown as T);
            if (hit.body instanceof Error) return Promise.reject(hit.body);
            return Promise.resolve(hit.body as T);
          },
        };
  const ctx: AssistantToolContext = {
    db: noDb,
    userId: "user_1",
    imoId: "imo_1",
    conversationId: "conv_1",
    firstName: "Nick",
    close: { getClient: () => Promise.resolve(client) },
    underwriting: {
      run() {
        throw new Error("close tools must not run underwriting");
      },
    },
  };
  return { ctx, calls };
}

function closeAuthError(): CloseApiErrorLike {
  const e = new Error(
    "Close API key is expired or invalid",
  ) as CloseApiErrorLike;
  e.code = "CLOSE_AUTH_ERROR";
  e.status = 401;
  return e;
}

function closeNotFound(): CloseApiErrorLike {
  const e = new Error("Close API 404") as CloseApiErrorLike;
  e.code = "CLOSE_ERROR";
  e.status = 404;
  return e;
}

/**
 * Draft-tool fixture: a working Close read client (for lead validation) AND a db
 * that records inserts (the draft tools write a pending_approval row). Pass
 * client:null to simulate not-connected.
 */
function makeDraftCtx(opts: {
  client?: CloseReadClient | null;
  routes?: Array<{ match: string; body: unknown }>;
}) {
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  const db: ToolDbClient = {
    rpc() {
      return Promise.resolve({ data: null, error: null });
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
                    data: { id: "act_close_1" },
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
  const client: CloseReadClient | null =
    opts.client !== undefined
      ? opts.client
      : {
          get<T>(path: string): Promise<T> {
            const hit = (opts.routes ?? []).find((r) => path.includes(r.match));
            if (!hit) return Promise.resolve({ data: [] } as unknown as T);
            if (hit.body instanceof Error) return Promise.reject(hit.body);
            return Promise.resolve(hit.body as T);
          },
        };
  const ctx: AssistantToolContext = {
    db,
    userId: "user_1",
    imoId: "imo_1",
    conversationId: "conv_1",
    firstName: "Nick",
    close: { getClient: () => Promise.resolve(client) },
    underwriting: {
      run() {
        throw new Error("close tools must not run underwriting");
      },
    },
  };
  return { ctx, inserts };
}

const LEAD_OK = {
  match: "/lead/lead_1/",
  body: { id: "lead_1", display_name: "Jane Doe" },
};

Deno.test(
  "draftCloseNote creates a pending close_note row, no send",
  async () => {
    const { ctx, inserts } = makeDraftCtx({ routes: [LEAD_OK] });
    const res = (await draftCloseNote.run(
      { leadId: "lead_1", note: "Called, left VM." },
      ctx,
    )) as { ok: boolean; actionRequestId: string; channel: string };
    assertEquals(res.ok, true);
    assertEquals(res.channel, "close_note");
    assertEquals(inserts.length, 1);
    assertEquals(inserts[0].values.channel, "close_note");
    assertEquals(inserts[0].values.status, "pending_approval");
    assertEquals(inserts[0].values.recipient, null);
    const payload = inserts[0].values.draft_payload as Record<string, unknown>;
    assertEquals(payload.leadId, "lead_1");
    assertEquals(payload.leadName, "Jane Doe"); // resolved at draft time
    assertEquals(payload.body, "Called, left VM.");
  },
);

Deno.test("draftCloseNote: unknown lead id => ok:false, no row", async () => {
  const { ctx, inserts } = makeDraftCtx({
    routes: [{ match: "/lead/lead_1/", body: closeNotFound() }],
  });
  const res = (await draftCloseNote.run(
    { leadId: "lead_1", note: "x" },
    ctx,
  )) as { ok: boolean; error: string };
  assertEquals(res.ok, false);
  assertEquals(inserts.length, 0);
});

Deno.test("draftCloseNote: not connected => ok:false, no row", async () => {
  const { ctx, inserts } = makeDraftCtx({ client: null });
  const res = (await draftCloseNote.run(
    { leadId: "lead_1", note: "x" },
    ctx,
  )) as { ok: boolean; error: string };
  assertEquals(res.ok, false);
  assertEquals(inserts.length, 0);
});

Deno.test("draftCloseTask keeps a valid dueDate", async () => {
  const ok = makeDraftCtx({ routes: [LEAD_OK] });
  await draftCloseTask.run(
    { leadId: "lead_1", text: "Follow up", dueDate: "2026-06-01" },
    ok.ctx,
  );
  const okPayload = ok.inserts[0].values.draft_payload as Record<
    string,
    unknown
  >;
  assertEquals(ok.inserts[0].values.channel, "close_task");
  assertEquals(okPayload.dueDate, "2026-06-01");
  assertEquals(okPayload.body, "Follow up");
});

Deno.test("draftCloseTask: no dueDate is fine (task without one)", async () => {
  const { ctx, inserts } = makeDraftCtx({ routes: [LEAD_OK] });
  const res = (await draftCloseTask.run(
    { leadId: "lead_1", text: "Follow up" },
    ctx,
  )) as { ok: boolean };
  assertEquals(res.ok, true);
  const payload = inserts[0].values.draft_payload as Record<string, unknown>;
  assertEquals("dueDate" in payload, false);
});

Deno.test(
  "draftCloseTask rejects an invalid dueDate (no row created)",
  async () => {
    for (const bad of [
      "next tuesday",
      "2026-13-45",
      "2026-02-31",
      "2026-6-3",
    ]) {
      const { ctx, inserts } = makeDraftCtx({ routes: [LEAD_OK] });
      const res = (await draftCloseTask.run(
        { leadId: "lead_1", text: "Follow up", dueDate: bad },
        ctx,
      )) as { ok: boolean };
      assertEquals(res.ok, false, `"${bad}" should be rejected`);
      assertEquals(inserts.length, 0, `"${bad}" must not create a row`);
    }
  },
);

Deno.test(
  "searchCloseLeads returns lean matches and never the DB",
  async () => {
    const { ctx, calls } = makeCtx({
      routes: [
        {
          match: "/lead/?query=",
          body: {
            data: [
              {
                id: "lead_1",
                display_name: "Jane Doe",
                status_label: "Potential",
                date_updated: "2026-05-01T00:00:00Z",
                // PII that must NOT survive into the tool output:
                description: "secret note about Jane",
              },
            ],
            total_results: 1,
          },
        },
      ],
    });
    const res = (await searchCloseLeads.run({ query: "Jane" }, ctx)) as {
      available: boolean;
      data: { leads: Array<Record<string, unknown>>; matchCount: number };
    };
    assertEquals(res.available, true);
    assertEquals(res.data.matchCount, 1);
    assertEquals(res.data.leads[0].name, "Jane Doe");
    assertEquals(res.data.leads[0].id, "lead_1");
    assertEquals("description" in res.data.leads[0], false);
    assert(calls[0].includes("_fields="));
  },
);

Deno.test(
  "searchCloseLeads: missing query is rejected, no call made",
  async () => {
    const { ctx, calls } = makeCtx({ routes: [] });
    const res = (await searchCloseLeads.run({}, ctx)) as {
      available: boolean;
      reason: string;
    };
    assertEquals(res.available, false);
    assertEquals(res.reason, "missing_query");
    assertEquals(calls.length, 0);
  },
);

Deno.test(
  "searchCloseLeads: not connected => close_not_connected",
  async () => {
    const { ctx } = makeCtx({ client: null });
    const res = (await searchCloseLeads.run({ query: "Jane" }, ctx)) as {
      available: boolean;
      reason: string;
    };
    assertEquals(res.available, false);
    assertEquals(res.reason, "close_not_connected");
  },
);

Deno.test(
  "getCloseLeadSnapshot drops contact PII to presence counts",
  async () => {
    const { ctx } = makeCtx({
      routes: [
        {
          match: "/lead/lead_1/",
          body: {
            id: "lead_1",
            display_name: "Jane Doe",
            status_label: "Potential",
            contacts: [
              {
                name: "Jane",
                emails: [{ email: "jane@example.com" }],
                phones: [{ phone: "+15551234567" }],
              },
              { name: "No Contact Info", emails: [], phones: [] },
            ],
            opportunities: [
              {
                status_type: "active",
                status_label: "Quoted",
                value: 120000,
                value_formatted: "$1,200",
                date_created: "2026-04-01T00:00:00Z",
                date_updated: "2026-05-01T00:00:00Z",
              },
              { status_type: "won", status_label: "Won", value: 50000 },
            ],
          },
        },
      ],
    });
    const res = (await getCloseLeadSnapshot.run({ leadId: "lead_1" }, ctx)) as {
      available: boolean;
      data: {
        contacts: {
          contactCount: number;
          withEmail: number;
          withPhone: number;
        };
        opportunities: { total: number; open: number; openSummary: unknown[] };
      };
    };
    assertEquals(res.available, true);
    assertEquals(res.data.contacts, {
      contactCount: 2,
      withEmail: 1,
      withPhone: 1,
    });
    assertEquals(res.data.opportunities.total, 2);
    assertEquals(res.data.opportunities.open, 1);
    // The raw email/phone must not appear anywhere in the serialized output.
    const blob = JSON.stringify(res);
    assertEquals(blob.includes("jane@example.com"), false);
    assertEquals(blob.includes("15551234567"), false);
  },
);

Deno.test(
  "getCloseLeadSnapshot: name with no match => lead_not_found",
  async () => {
    const { ctx } = makeCtx({
      routes: [{ match: "/lead/?query=", body: { data: [] } }],
    });
    const res = (await getCloseLeadSnapshot.run({ name: "Nobody" }, ctx)) as {
      available: boolean;
      reason: string;
    };
    assertEquals(res.available, false);
    assertEquals(res.reason, "lead_not_found");
  },
);

Deno.test(
  "getCloseLeadActivity summarizes and drops bodies/subjects",
  async () => {
    const { ctx } = makeCtx({
      routes: [
        {
          match: "/activity/?lead_id=",
          body: {
            data: [
              {
                _type: "Email",
                date_created: "2026-05-10T00:00:00Z",
                direction: "outbound",
                subject: "Your quote is ready",
                body_text: "Hi Jane, here is your secret quote...",
              },
              {
                _type: "Call",
                date_created: "2026-05-08T00:00:00Z",
                direction: "outbound",
                duration: 245,
              },
            ],
          },
        },
      ],
    });
    const res = (await getCloseLeadActivity.run({ leadId: "lead_1" }, ctx)) as {
      available: boolean;
      data: {
        count: number;
        byType: Record<string, number>;
        activities: Array<Record<string, unknown>>;
      };
    };
    assertEquals(res.available, true);
    assertEquals(res.data.count, 2);
    assertEquals(res.data.byType.Email, 1);
    assertEquals(res.data.byType.Call, 1);
    assertEquals(res.data.activities[1].durationSec, 245);
    const blob = JSON.stringify(res);
    assertEquals(blob.includes("secret quote"), false);
    assertEquals(blob.includes("Your quote is ready"), false);
  },
);

Deno.test(
  "getCloseOpportunities: active-only, stalled-first, cents->dollars, true count",
  async () => {
    const { ctx, calls } = makeCtx({
      routes: [
        {
          match: "/opportunity/",
          body: {
            // total_results is the TRUE open count, independent of the page.
            total_results: 7,
            data: [
              {
                lead_name: "Fresh Co",
                status_type: "active",
                status_label: "Quoted",
                value: 100000, // cents -> $1,000
                date_created: "2026-05-01T00:00:00Z",
                date_updated: "2026-05-20T00:00:00Z",
              },
              {
                lead_name: "Stale Co",
                status_type: "active",
                status_label: "Quoted",
                value: 50000, // cents -> $500
                date_created: "2026-01-01T00:00:00Z",
                date_updated: "2026-01-15T00:00:00Z",
              },
              {
                // A won deal that the server filter SHOULD have excluded — the
                // defensive client-side filter must drop it anyway.
                lead_name: "Closed Co",
                status_type: "won",
                status_label: "Won",
                value: 999999,
                date_created: "2025-12-01T00:00:00Z",
                date_updated: "2025-12-02T00:00:00Z",
              },
            ],
          },
        },
      ],
    });
    const res = (await getCloseOpportunities.run({}, ctx)) as {
      available: boolean;
      data: {
        opportunities: Array<Record<string, unknown>>;
        openCount: number;
        returned: number;
        truncated: boolean;
        returnedValue: number;
      };
    };
    assertEquals(res.available, true);
    // True count from total_results, not the page size.
    assertEquals(res.data.openCount, 7);
    assertEquals(res.data.returned, 2); // the "won" deal was filtered out
    assertEquals(res.data.truncated, true); // 7 open > 2 returned
    // Stale Co (older date_updated) sorts first; value is dollars not cents.
    assertEquals(res.data.opportunities[0].leadName, "Stale Co");
    assertEquals(res.data.opportunities[0].value, 500);
    assertEquals(res.data.returnedValue, 1500); // 1000 + 500, no won deal
    assert(calls[0].includes("status_type=active"));
  },
);

Deno.test(
  "getCloseOpportunities: empty pipeline => no_open_opportunities",
  async () => {
    const { ctx } = makeCtx({
      routes: [{ match: "/opportunity/", body: { data: [] } }],
    });
    const res = (await getCloseOpportunities.run({}, ctx)) as {
      available: boolean;
      reason: string;
    };
    assertEquals(res.available, false);
    assertEquals(res.reason, "no_open_opportunities");
  },
);

Deno.test(
  "Close auth failure maps to close_auth_failed (no throw)",
  async () => {
    const { ctx } = makeCtx({
      routes: [{ match: "/opportunity/", body: closeAuthError() }],
    });
    const res = (await getCloseOpportunities.run({}, ctx)) as {
      available: boolean;
      reason: string;
    };
    assertEquals(res.available, false);
    assertEquals(res.reason, "close_auth_failed");
  },
);
