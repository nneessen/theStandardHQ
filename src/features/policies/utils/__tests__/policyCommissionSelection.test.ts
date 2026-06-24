// src/features/policies/utils/__tests__/policyCommissionSelection.test.ts

import { describe, it, expect } from "vitest";
import { selectPrimaryCommissionsByPolicy } from "../policyCommissionSelection";
import {
  isCollectibleCommissionStatus,
  type Commission,
  type CommissionStatus,
} from "@/types/commission.types";

let seq = 0;
function makeCommission(
  overrides: Partial<Commission> & {
    policyId?: string;
    status?: CommissionStatus;
    amount?: number;
  } = {},
): Commission {
  seq += 1;
  return {
    id: overrides.id ?? `comm-${seq}`,
    policyId: "policy-1",
    userId: "user-1",
    type: "first_year",
    status: "paid",
    amount: 1000,
    advanceMonths: 9,
    monthsPaid: 0,
    earnedAmount: 0,
    unearnedAmount: 0,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("isCollectibleCommissionStatus", () => {
  it("treats pending/unpaid/paid as collectible", () => {
    expect(isCollectibleCommissionStatus("pending")).toBe(true);
    expect(isCollectibleCommissionStatus("unpaid")).toBe(true);
    expect(isCollectibleCommissionStatus("paid")).toBe(true);
  });

  it("treats terminal statuses as NOT collectible", () => {
    expect(isCollectibleCommissionStatus("charged_back")).toBe(false);
    expect(isCollectibleCommissionStatus("clawback")).toBe(false);
    expect(isCollectibleCommissionStatus("reversed")).toBe(false);
    expect(isCollectibleCommissionStatus("disputed")).toBe(false);
  });
});

describe("selectPrimaryCommissionsByPolicy", () => {
  it("returns the single commission when a policy has only one", () => {
    const map = selectPrimaryCommissionsByPolicy([
      makeCommission({ id: "a", amount: 500 }),
    ]);
    expect(map.get("policy-1")?.id).toBe("a");
  });

  it("prefers a collectible commission over a charged_back one", () => {
    const map = selectPrimaryCommissionsByPolicy([
      makeCommission({
        id: "chargeback",
        status: "charged_back",
        amount: 9999,
      }),
      makeCommission({ id: "active", status: "paid", amount: 100 }),
    ]);
    // Higher amount is the chargeback, but collectible must still win.
    expect(map.get("policy-1")?.id).toBe("active");
  });

  it("prefers a collectible commission over a clawback one", () => {
    const map = selectPrimaryCommissionsByPolicy([
      makeCommission({ id: "clawback", status: "clawback", amount: 9999 }),
      makeCommission({ id: "active", status: "pending", amount: 100 }),
    ]);
    expect(map.get("policy-1")?.id).toBe("active");
  });

  it("uses the higher amount when both are collectible", () => {
    const map = selectPrimaryCommissionsByPolicy([
      makeCommission({ id: "low", status: "paid", amount: 100 }),
      makeCommission({ id: "high", status: "pending", amount: 800 }),
    ]);
    expect(map.get("policy-1")?.id).toBe("high");
  });

  it("omits policies that have no commission (and skips null policyId)", () => {
    const map = selectPrimaryCommissionsByPolicy([
      makeCommission({ id: "orphan", policyId: undefined }),
    ]);
    expect(map.size).toBe(0);
  });

  it("is order-independent (stable tie-break by id when amounts tie)", () => {
    const a = makeCommission({ id: "aaa", status: "paid", amount: 500 });
    const b = makeCommission({ id: "bbb", status: "paid", amount: 500 });
    const forward = selectPrimaryCommissionsByPolicy([a, b]);
    const reversed = selectPrimaryCommissionsByPolicy([b, a]);
    expect(forward.get("policy-1")?.id).toBe("aaa");
    expect(reversed.get("policy-1")?.id).toBe("aaa");
  });

  it("groups commissions across multiple policies", () => {
    const map = selectPrimaryCommissionsByPolicy([
      makeCommission({ id: "p1", policyId: "policy-1", amount: 100 }),
      makeCommission({ id: "p2", policyId: "policy-2", amount: 200 }),
    ]);
    expect(map.get("policy-1")?.id).toBe("p1");
    expect(map.get("policy-2")?.id).toBe("p2");
  });
});
