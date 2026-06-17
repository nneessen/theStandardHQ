import { describe, it, expect } from "vitest";
import { normalizePhoneNumber } from "../phone";
import vectorData from "./phone-parity-vectors.json";

type Vector = { input: string; expected: string | null };
const vectors = (vectorData as { vectors: Vector[] }).vectors;

describe("normalizePhoneNumber (TS twin of _shared/phone.ts + SQL normalize_phone_e164)", () => {
  // Pins the TS twin to the canonical vector set. The SAME vectors are run
  // through the SQL function by scripts/test-phone-parity.mjs, so TS≡vectors
  // and SQL≡vectors together prove TS≡SQL.
  it.each(vectors)("normalizes $input -> $expected", ({ input, expected }) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it("returns null for null/undefined (falsy guard)", () => {
    expect(normalizePhoneNumber(null)).toBeNull();
    expect(normalizePhoneNumber(undefined)).toBeNull();
  });

  it("covers every code branch in the vector set", () => {
    // Guard against the table silently losing coverage of a branch.
    expect(
      vectors.some(
        (v) =>
          v.expected?.startsWith("+1") &&
          v.input.replace(/[^\d+]/g, "").length === 10,
      ),
    ).toBe(true); // 10-digit
    expect(
      vectors.some(
        (v) =>
          v.input.replace(/[^\d+]/g, "").length === 11 &&
          v.input.replace(/[^\d+]/g, "").startsWith("1") &&
          v.expected !== null,
      ),
    ).toBe(true); // 11-digit leading 1
    expect(
      vectors.some(
        (v) =>
          v.input.replace(/[^\d+]/g, "").length === 11 &&
          !v.input.replace(/[^\d+]/g, "").startsWith("1") &&
          v.expected === null,
      ),
    ).toBe(true); // 11-digit NOT leading 1 -> null
    expect(
      vectors.some((v) => v.input.startsWith("+") && v.expected !== null),
    ).toBe(true); // E.164 passthrough
    expect(
      vectors.some((v) => v.input.startsWith("+") && v.expected === null),
    ).toBe(true); // too long/short + -> null
    expect(vectors.some((v) => v.input === "")).toBe(true); // empty/falsy
  });
});
