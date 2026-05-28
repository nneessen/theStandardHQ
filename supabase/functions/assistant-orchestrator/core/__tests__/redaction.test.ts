import { assert, assertEquals } from "jsr:@std/assert@1";
import { redact } from "../redaction.ts";

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
