import { assertEquals } from "jsr:@std/assert@1";
import { normalizePhoneNumber } from "../phone.ts";
// The canonical parity vectors — the SAME table src/lib/__tests__/phone.test.ts and
// scripts/test-phone-parity.mjs assert against. This gates the THIRD twin
// (supabase/functions/_shared/phone.ts), which is the one a Phase-2 lead edge function
// will import to normalize an ANI on the call path. Without this, the Deno twin could
// silently drift from the SQL normalize_phone_e164 that computes clients.phone_e164,
// and a known caller's AoR lookup would miss.
import vectorData from "../../../../src/lib/__tests__/phone-parity-vectors.json" with { type: "json" };

type Vector = { input: string; expected: string | null };
const vectors = (vectorData as { vectors: Vector[] }).vectors;

Deno.test(
  "Deno _shared/phone.ts matches the canonical parity vectors (third twin)",
  () => {
    for (const { input, expected } of vectors) {
      assertEquals(
        normalizePhoneNumber(input),
        expected,
        `input: ${JSON.stringify(input)}`,
      );
    }
  },
);

Deno.test("falsy guard returns null for null/undefined", () => {
  assertEquals(normalizePhoneNumber(null), null);
  assertEquals(normalizePhoneNumber(undefined), null);
});
