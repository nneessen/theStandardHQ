import { assert, assertEquals } from "jsr:@std/assert@1";
import type { AssistantToolContext, ToolDbClient } from "../types.ts";
import { saveMemory } from "../saveMemory.ts";

interface InsertCall {
  table: string;
  values: Record<string, unknown>;
}

// Self-contained fake (the makeCtx in tools.test.ts is local + always succeeds on
// insert; saveMemory needs the error path too). Records inserts and lets each test
// choose the insert result.
function makeCtx(insertResult: {
  data: { id: string } | null;
  error: unknown;
}) {
  const inserts: InsertCall[] = [];
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
                  return Promise.resolve(insertResult);
                },
              };
            },
          };
        },
        select() {
          throw new Error("saveMemory must not read");
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
    close: { getClient: () => Promise.resolve(null) },
    underwriting: {
      run() {
        throw new Error("saveMemory must not run underwriting");
      },
    },
  };
  return { ctx, inserts };
}

const OK = { data: { id: "mem_1" }, error: null };

Deno.test(
  "saveMemory writes to jarvis_memory with user_id from CONTEXT, not input",
  async () => {
    const { ctx, inserts } = makeCtx(OK);
    // A malicious input tries to spoof identity fields; they must be ignored.
    const out = (await saveMemory.run(
      { content: "Goal: $50k AP", user_id: "attacker", source: "assistant" },
      ctx,
    )) as { ok: boolean };

    assertEquals(out.ok, true);
    assertEquals(inserts.length, 1);
    assertEquals(inserts[0].table, "jarvis_memory");
    assertEquals(inserts[0].values.user_id, "user_1"); // from ctx, never input
    assertEquals(inserts[0].values.imo_id, "imo_1");
    assertEquals(inserts[0].values.source, "user"); // always "user" in Phase A
    assertEquals(inserts[0].values.content, "Goal: $50k AP");
  },
);

Deno.test("saveMemory returns the new memory id on success", async () => {
  const { ctx } = makeCtx(OK);
  const out = (await saveMemory.run(
    { content: "Prefers terse replies" },
    ctx,
  )) as {
    ok: boolean;
    memoryId?: string;
  };
  assertEquals(out.ok, true);
  assertEquals(out.memoryId, "mem_1");
});

Deno.test(
  "saveMemory defaults kind to 'fact' and passes a valid kind through",
  async () => {
    const { ctx: c1, inserts: i1 } = makeCtx(OK);
    await saveMemory.run({ content: "x" }, c1);
    assertEquals(i1[0].values.kind, "fact");

    const { ctx: c2, inserts: i2 } = makeCtx(OK);
    await saveMemory.run({ content: "x", kind: "goal" }, c2);
    assertEquals(i2[0].values.kind, "goal");
  },
);

Deno.test(
  "saveMemory falls back to 'fact' for an out-of-allowlist kind",
  async () => {
    const { ctx, inserts } = makeCtx(OK);
    await saveMemory.run({ content: "x", kind: "bogus" }, ctx);
    assertEquals(inserts[0].values.kind, "fact");
  },
);

Deno.test(
  "saveMemory carries pinned through and keeps memory_key null (Phase A)",
  async () => {
    const { ctx, inserts } = makeCtx(OK);
    await saveMemory.run(
      // memoryKey is intentionally not in the schema in Phase A; even if passed it
      // must be ignored (no keyed-upsert path yet → would hit the unique index).
      {
        content: "income goal",
        kind: "goal",
        memoryKey: "income_goal",
        pinned: true,
      },
      ctx,
    );
    assertEquals(inserts[0].values.memory_key, null);
    assertEquals(inserts[0].values.pinned, true);
  },
);

Deno.test(
  "saveMemory never throws on a db error — returns { ok:false }",
  async () => {
    const { ctx } = makeCtx({ data: null, error: { message: "boom" } });
    const out = (await saveMemory.run({ content: "x" }, ctx)) as {
      ok: boolean;
    };
    assertEquals(out.ok, false);
  },
);

Deno.test(
  "saveMemory defaults pinned to false and memory_key to null when omitted",
  async () => {
    const { ctx, inserts } = makeCtx(OK);
    await saveMemory.run({ content: "x" }, ctx);
    assertEquals(inserts[0].values.pinned, false);
    assertEquals(inserts[0].values.memory_key, null);
    assert("source" in inserts[0].values);
  },
);
