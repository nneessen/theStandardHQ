// src/lib/__tests__/currency.test.ts
import { describe, it, expect } from "vitest";
import { roundCurrency } from "../currency";

describe("roundCurrency", () => {
  it("rounds to two decimals", () => {
    expect(roundCurrency(4612.504)).toBe(4612.5);
    expect(roundCurrency(1537.499)).toBe(1537.5);
    expect(roundCurrency(100)).toBe(100);
  });

  it("rounds half away from zero", () => {
    expect(roundCurrency(1537.505)).toBe(1537.51);
    expect(roundCurrency(0.005)).toBe(0.01);
    expect(roundCurrency(-0.005)).toBe(-0.01);
    expect(roundCurrency(-2.675)).toBe(-2.68);
  });

  it("clears binary-float artifacts", () => {
    // 0.1 + 0.2 = 0.30000000000000004
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    // 3075.0000000001 -> 3075
    expect(roundCurrency(4612.5 - 1537.5)).toBe(3075);
  });

  it("collapses non-finite input to 0", () => {
    expect(roundCurrency(NaN)).toBe(0);
    expect(roundCurrency(Infinity)).toBe(0);
    expect(roundCurrency(-Infinity)).toBe(0);
  });

  it("is idempotent on already-rounded values", () => {
    const v = roundCurrency(123.456);
    expect(roundCurrency(v)).toBe(v);
  });
});
