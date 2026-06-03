import { assert, assertEquals } from "jsr:@std/assert@1";
import { resolveContact } from "../resolveContact.ts";
import type { AssistantToolContext } from "../types.ts";

// Minimal ctx whose db.rpc is stubbed; resolveContact only uses ctx.db.rpc.
function ctxWithRpc(
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => {
    data: unknown;
    error: unknown;
  },
): AssistantToolContext {
  return {
    db: {
      rpc: (fn: string, args?: Record<string, unknown>) =>
        Promise.resolve(rpc(fn, args ?? {})),
    },
  } as unknown as AssistantToolContext;
}

Deno.test("resolveContact maps masked candidates", async () => {
  const ctx = ctxWithRpc(() => ({
    data: [
      {
        display_name: "Bob Smith",
        contact_kind: "client",
        masked_value: "***-1234",
      },
    ],
    error: null,
  }));
  // deno-lint-ignore no-explicit-any
  const r = (await resolveContact.run(
    { name: "Bob", channel: "sms" },
    ctx,
  )) as any;
  assert(r.available);
  assertEquals(r.data.channel, "sms");
  assertEquals(r.data.candidates[0], {
    displayName: "Bob Smith",
    contactKind: "client",
    maskedValue: "***-1234",
  });
});

Deno.test("resolveContact: empty result -> no_match", async () => {
  const ctx = ctxWithRpc(() => ({ data: [], error: null }));
  const r = (await resolveContact.run({ name: "Zzz" }, ctx)) as Record<
    string,
    unknown
  >;
  assertEquals(r.reason, "no_match");
});

Deno.test(
  "resolveContact: missing name -> name_required, never calls rpc",
  async () => {
    let called = false;
    const ctx = ctxWithRpc(() => {
      called = true;
      return { data: [], error: null };
    });
    const r = (await resolveContact.run({}, ctx)) as Record<string, unknown>;
    assertEquals(r.reason, "name_required");
    assertEquals(called, false);
  },
);

Deno.test("resolveContact: rpc error -> unavailable", async () => {
  const ctx = ctxWithRpc(() => ({ data: null, error: { message: "boom" } }));
  const r = (await resolveContact.run({ name: "Bob" }, ctx)) as Record<
    string,
    unknown
  >;
  assertEquals(r.reason, "unavailable");
});

Deno.test(
  "resolveContact: channel defaults to sms; invalid -> sms; email passes",
  async () => {
    let seen = "";
    const ctx = ctxWithRpc((_fn, args) => {
      seen = String(args.p_channel);
      return {
        data: [
          {
            display_name: "X",
            contact_kind: "client",
            masked_value: "x***@y.com",
          },
        ],
        error: null,
      };
    });
    await resolveContact.run({ name: "X" }, ctx);
    assertEquals(seen, "sms");
    await resolveContact.run({ name: "X", channel: "email" }, ctx);
    assertEquals(seen, "email");
    await resolveContact.run({ name: "X", channel: "garbage" }, ctx);
    assertEquals(seen, "sms");
  },
);
