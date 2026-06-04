import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getMonthlyPoliciesWritten,
  getPolicyStatusSnapshot,
} from "../policyStatusService";
import type { Policy } from "@/types";

function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: "p1",
    submitDate: "2026-03-15",
    effectiveDate: "2026-03-20",
    lifecycleStatus: "active",
    status: "approved",
    ...overrides,
  } as unknown as Policy;
}

describe("policyStatusService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fixed "now" so the 12-month window is deterministic (Jun 15, 2026).
    vi.setSystemTime(new Date(2026, 5, 15));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getPolicyStatusSnapshot", () => {
    it("buckets issued policies by lifecycle and surfaces pending apps", () => {
      const policies = [
        makePolicy({ lifecycleStatus: "active" }),
        makePolicy({ lifecycleStatus: "active" }),
        makePolicy({ lifecycleStatus: "lapsed" }),
        makePolicy({ lifecycleStatus: "cancelled" }),
        makePolicy({ lifecycleStatus: null, status: "pending" }),
      ];
      const snap = getPolicyStatusSnapshot(policies);
      expect(snap.active).toBe(2);
      expect(snap.lapsed).toBe(1);
      expect(snap.cancelled).toBe(1);
      expect(snap.pending).toBe(1);
      expect(snap.total).toBe(5);
    });

    it("excludes terminal non-issued apps (withdrawn/denied) from all buckets", () => {
      const policies = [
        makePolicy({ lifecycleStatus: null, status: "withdrawn" }),
        makePolicy({ lifecycleStatus: null, status: "denied" }),
        makePolicy({ lifecycleStatus: "active" }),
      ];
      const snap = getPolicyStatusSnapshot(policies);
      expect(snap.active).toBe(1);
      expect(snap.pending).toBe(0);
      // withdrawn/denied are not part of the policy-status view
      expect(snap.total).toBe(1);
    });

    it("handles empty input", () => {
      expect(getPolicyStatusSnapshot([])).toEqual({
        active: 0,
        lapsed: 0,
        cancelled: 0,
        pending: 0,
        total: 0,
      });
    });
  });

  describe("getMonthlyPoliciesWritten", () => {
    it("returns 12 month buckets ending at the current month", () => {
      const result = getMonthlyPoliciesWritten([]);
      expect(result).toHaveLength(12);
      expect(result[0].month).toBe("Jul 2025");
      expect(result[11].month).toBe("Jun 2026");
      expect(result.every((m) => m.written === 0)).toBe(true);
    });

    it("counts policies by submit month within the 12-month window", () => {
      const policies = [
        makePolicy({ submitDate: "2026-06-02" }), // current month
        makePolicy({ submitDate: "2026-06-28" }), // current month
        makePolicy({ submitDate: "2026-05-10" }), // previous month
        makePolicy({ submitDate: "2024-01-01" }), // outside the 12-month window
      ];
      const result = getMonthlyPoliciesWritten(policies);
      expect(result.find((m) => m.month === "Jun 2026")?.written).toBe(2);
      expect(result.find((m) => m.month === "May 2026")?.written).toBe(1);
      // the out-of-window policy lands in no bucket
      expect(result.reduce((s, m) => s + m.written, 0)).toBe(3);
    });

    it("falls back to effectiveDate when submitDate is absent", () => {
      const policies = [
        makePolicy({
          submitDate: undefined as unknown as string,
          effectiveDate: "2026-06-05",
        }),
      ];
      const result = getMonthlyPoliciesWritten(policies);
      expect(result.find((m) => m.month === "Jun 2026")?.written).toBe(1);
    });
  });
});
