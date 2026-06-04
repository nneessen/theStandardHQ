import { describe, it, expect } from "vitest";
import { resolveGoalAvgAP } from "../goal";

describe("resolveGoalAvgAP", () => {
  const averages = {
    personalMedianPolicyPremium: 1200,
    personalAvgPolicyPremium: 1400,
    medianPolicyPremium: 1600,
    avgPolicyPremium: 1800,
  };

  it("prefers the configured avgAP when set (does NOT take the max of all signals)", () => {
    // Old behaviour returned 1800 (the max); now it honours the configured value.
    expect(resolveGoalAvgAP(1000, averages)).toBe(1000);
  });

  it("falls back to the agent's own median when avgAP is unset", () => {
    expect(resolveGoalAvgAP(0, averages)).toBe(1200);
    expect(resolveGoalAvgAP(null, averages)).toBe(1200);
    expect(resolveGoalAvgAP(undefined, averages)).toBe(1200);
  });

  it("walks the fallback chain: personal median → personal mean → team median → team mean", () => {
    expect(
      resolveGoalAvgAP(0, {
        personalAvgPolicyPremium: 1400,
        avgPolicyPremium: 1800,
      }),
    ).toBe(1400);
    expect(resolveGoalAvgAP(0, { medianPolicyPremium: 1600 })).toBe(1600);
    expect(resolveGoalAvgAP(0, { avgPolicyPremium: 1800 })).toBe(1800);
  });

  it("returns 0 when no signal is available", () => {
    expect(resolveGoalAvgAP(0, {})).toBe(0);
    expect(resolveGoalAvgAP(null, {})).toBe(0);
  });
});
