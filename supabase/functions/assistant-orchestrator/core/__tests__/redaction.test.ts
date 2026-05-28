import { assert, assertEquals } from "jsr:@std/assert@1";
import { redact, summarizeToolOutput } from "../redaction.ts";

Deno.test("redacts sensitive keys, keeps benign ones", () => {
  const out = redact({
    api_key: "sk-secret",
    token: "abc",
    password: "p",
    authorization: "Bearer x",
    name: "Nick",
  }) as Record<string, unknown>;
  assertEquals(out.api_key, "[redacted]");
  assertEquals(out.token, "[redacted]");
  assertEquals(out.password, "[redacted]");
  assertEquals(out.authorization, "[redacted]");
  assertEquals(out.name, "Nick");
});

Deno.test("truncates long strings", () => {
  const out = redact("a".repeat(1000)) as string;
  assert(out.length < 600);
  assert(out.includes("chars]"));
});

Deno.test("caps large arrays", () => {
  const out = redact(Array.from({ length: 100 }, (_, i) => i)) as unknown[];
  assert(out.length <= 26);
});

Deno.test("redacts nested sensitive keys", () => {
  const out = redact({ outer: { secret: "x", ok: 1 } }) as Record<
    string,
    Record<string, unknown>
  >;
  assertEquals(out.outer.secret, "[redacted]");
  assertEquals(out.outer.ok, 1);
});

// summarizeToolOutput — M1: tool OUTPUT must be summarized (counts + available
// flags + structure), never raw row values, so PII from grounding RPCs (client/
// agent names, premiums, DOB) never lands in assistant_tool_calls.output_redacted.

Deno.test(
  "summarizeToolOutput reduces arrays to counts and drops row PII",
  () => {
    const out = summarizeToolOutput({
      available: true,
      data: {
        teams: [
          { agent_name: "Nick", ap: 1234 },
          { agent_name: "Sam", ap: 56 },
        ],
      },
    }) as Record<string, { teams: unknown }>;
    assertEquals(out.available as unknown, true);
    assertEquals(out.data.teams, { count: 2 });
    assert(!JSON.stringify(out).includes("Nick"));
    assert(!JSON.stringify(out).includes("Sam"));
  },
);

Deno.test(
  "summarizeToolOutput keeps enum/structural strings, omits the rest",
  () => {
    const out = summarizeToolOutput({
      available: false,
      reason: "no_data",
      status: "pending_approval",
      full_name: "Jane Client",
      birth_date: "1980-01-01",
    }) as Record<string, unknown>;
    assertEquals(out.available, false);
    assertEquals(out.reason, "no_data");
    assertEquals(out.status, "pending_approval");
    assert(!JSON.stringify(out).includes("Jane"));
    assert(!JSON.stringify(out).includes("1980"));
  },
);

Deno.test(
  "summarizeToolOutput keeps draft metadata but omits drafted text/recipient",
  () => {
    const out = summarizeToolOutput({
      ok: true,
      actionRequestId: "11111111-2222-3333-4444-555555555555",
      channel: "email",
      draft: {
        subject: "Hi Jane",
        body: "Your policy 12345 lapses",
        to: "jane@x.com",
      },
    }) as Record<string, unknown>;
    assertEquals(out.ok, true);
    assertEquals(out.actionRequestId, "11111111-2222-3333-4444-555555555555");
    assertEquals(out.channel, "email");
    assert(!JSON.stringify(out).includes("Jane"));
    assert(!JSON.stringify(out).includes("jane@x.com"));
    assert(!JSON.stringify(out).includes("12345"));
  },
);
