import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  CRM_TOKEN_TTL_SECONDS,
  type CrmTokenPayload,
  mintCrmToken,
  signCrmToken,
  verifyCrmToken,
} from "../crm-token-decoder.ts";

const KEY = "test-signing-key-0123456789abcdef0123456789abcdef";

function basePayload(over: Partial<CrmTokenPayload> = {}): CrmTokenPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    imo_id: "11111111-1111-1111-1111-111111111111",
    credential_id: "22222222-2222-2222-2222-222222222222",
    scopes: ["crm:leads"],
    typ: "crm_m2m",
    iat: now,
    exp: now + CRM_TOKEN_TTL_SECONDS,
    ...over,
  };
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.test("round-trips a valid 24h token", async () => {
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
  const { token } = await mintCrmToken({
    imo_id: "11111111-1111-1111-1111-111111111111",
    credential_id: "22222222-2222-2222-2222-222222222222",
    scopes: ["crm:leads"],
  });
  const v = await verifyCrmToken(token);
  assert(v !== null);
  assertEquals(v!.imo_id, "11111111-1111-1111-1111-111111111111");
  assertEquals(v!.credential_id, "22222222-2222-2222-2222-222222222222");
  assertEquals(v!.typ, "crm_m2m");
  assertEquals(v!.exp - v!.iat, CRM_TOKEN_TTL_SECONDS);
});

Deno.test("rejects a tampered payload (keeps the old signature)", async () => {
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
  const token = await signCrmToken(basePayload());
  const sig = token.split(".")[1];
  const forgedBody = b64url(
    JSON.stringify(
      basePayload({ imo_id: "99999999-9999-9999-9999-999999999999" }),
    ),
  );
  assertEquals(await verifyCrmToken(`${forgedBody}.${sig}`), null);
});

Deno.test("rejects a tampered signature", async () => {
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
  const body = (await signCrmToken(basePayload())).split(".")[0];
  assertEquals(await verifyCrmToken(`${body}.deadbeef`), null);
});

Deno.test("rejects an expired token", async () => {
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
  const token = await signCrmToken(
    basePayload({ exp: Math.floor(Date.now() / 1000) - 10 }),
  );
  assertEquals(await verifyCrmToken(token), null);
});

Deno.test("rejects a wrong typ", async () => {
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
  const token = await signCrmToken(basePayload({ typ: "something_else" }));
  assertEquals(await verifyCrmToken(token), null);
});

Deno.test("rejects an iat too far in the future", async () => {
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
  const future = Math.floor(Date.now() / 1000) + 3600;
  const token = await signCrmToken(
    basePayload({ iat: future, exp: future + CRM_TOKEN_TTL_SECONDS }),
  );
  assertEquals(await verifyCrmToken(token), null);
});

Deno.test("rejects a token signed with a different key (forgery)", async () => {
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
  const token = await signCrmToken(basePayload());
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", "a-totally-different-key");
  assertEquals(await verifyCrmToken(token), null);
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
});

Deno.test("fail-closed: signing throws when the key is unset", async () => {
  Deno.env.delete("CRM_CALL_PLATFORM_SIGNING_KEY");
  let threw = false;
  try {
    await signCrmToken(basePayload());
  } catch {
    threw = true;
  }
  assert(threw);
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
});

Deno.test("rejects malformed tokens", async () => {
  Deno.env.set("CRM_CALL_PLATFORM_SIGNING_KEY", KEY);
  assertEquals(await verifyCrmToken(""), null);
  assertEquals(await verifyCrmToken("not-a-token"), null);
  assertEquals(await verifyCrmToken("a.b.c"), null);
});
