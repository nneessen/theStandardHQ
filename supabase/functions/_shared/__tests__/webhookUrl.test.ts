import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { assertSafeWebhookUrl } from "../webhookUrl.ts";

Deno.test("allows ordinary public https hosts", () => {
  assertEquals(
    assertSafeWebhookUrl("https://hooks.example.com/abc").hostname,
    "hooks.example.com",
  );
});

Deno.test(
  "does NOT over-block hostnames starting with fc/fd (regression)",
  () => {
    // The old IPv6 ULA regex /^(fc|fd)/ wrongly rejected these.
    assertEquals(
      assertSafeWebhookUrl("https://fdic.gov/hook").hostname,
      "fdic.gov",
    );
    assertEquals(
      assertSafeWebhookUrl("https://fcc.gov/hook").hostname,
      "fcc.gov",
    );
  },
);

Deno.test("rejects non-https", () => {
  assertThrows(() => assertSafeWebhookUrl("http://example.com/x"));
});

Deno.test("rejects localhost + cloud metadata + loopback IPv4", () => {
  for (const u of [
    "https://localhost/x",
    "https://127.0.0.1/x",
    "https://169.254.169.254/latest/meta-data/",
    "https://metadata.google.internal/x",
    "https://0.0.0.0/x",
  ]) {
    assertThrows(
      () => assertSafeWebhookUrl(u),
      Error,
      "",
      `should reject ${u}`,
    );
  }
});

Deno.test("rejects private IPv4 ranges", () => {
  for (const u of [
    "https://10.0.0.5/x",
    "https://192.168.1.1/x",
    "https://172.16.0.1/x",
    "https://172.31.255.255/x",
  ]) {
    assertThrows(
      () => assertSafeWebhookUrl(u),
      Error,
      "",
      `should reject ${u}`,
    );
  }
});

Deno.test("rejects trailing-dot FQDN bypass", () => {
  assertThrows(() => assertSafeWebhookUrl("https://169.254.169.254./x"));
  assertThrows(() => assertSafeWebhookUrl("https://localhost./x"));
});

Deno.test("rejects ALL IPv6 literals incl. IPv4-mapped + loopback", () => {
  for (const u of [
    "https://[::1]/x",
    "https://[::ffff:127.0.0.1]/x",
    "https://[fd00::1]/x",
    "https://[fe80::1]/x",
    "https://[2001:4860:4860::8888]/x", // even public IPv6 literals are rejected by policy
  ]) {
    assertThrows(
      () => assertSafeWebhookUrl(u),
      Error,
      "",
      `should reject ${u}`,
    );
  }
});

Deno.test("rejects the project's own Supabase host", () => {
  Deno.env.set("SUPABASE_URL", "https://abcxyz.supabase.co");
  try {
    assertThrows(
      () => assertSafeWebhookUrl("https://abcxyz.supabase.co/functions/v1/x"),
      Error,
      "Supabase host",
    );
    // a different host is still fine
    assertEquals(
      assertSafeWebhookUrl("https://other.supabase.co/x").hostname,
      "other.supabase.co",
    );
  } finally {
    Deno.env.delete("SUPABASE_URL");
  }
});
