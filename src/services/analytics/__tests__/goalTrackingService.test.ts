import { describe, it, expect } from "vitest";
import {
  calculateGoalTracking,
  goalTrackingFetchWindowStart,
} from "../goalTrackingService";
import type { Commission } from "@/types/commission.types";

// Build a minimal Commission with just the fields calculateGoalTracking reads
// (createdAt + earnedAmount). Everything else is irrelevant to the math.
function commission(createdAt: string, earnedAmount: number): Commission {
  return {
    id: `c-${createdAt}-${earnedAmount}`,
    createdAt,
    earnedAmount,
    status: "paid",
    amount: earnedAmount,
    type: "first_year",
  } as unknown as Commission;
}

// The contract: feeding calculateGoalTracking the full all-time set must produce
// byte-identical output to feeding it only the rows on/after the PRODUCTION fetch
// bound (goalTrackingFetchWindowStart — the same function IncomeGoalTracker uses).
// If this ever fails, the date-bound is under-fetching and silently changing
// money numbers. Importing the real bound (not a copy) means a drift between the
// bound and the windows calculateGoalTracking reads will fail this test.
describe("goalTracking — date-bound equivalence (Issue 2 IncomeGoalTracker)", () => {
  function assertBoundEquivalence(referenceDate: Date, all: Commission[]) {
    const bound = goalTrackingFetchWindowStart(referenceDate);
    const bounded = all.filter((c) => new Date(c.createdAt) >= bound);

    const full = calculateGoalTracking({
      commissions: all,
      annualGoal: 120000,
      referenceDate,
    });
    const trimmed = calculateGoalTracking({
      commissions: bounded,
      annualGoal: 120000,
      referenceDate,
    });

    expect(trimmed).toEqual(full);
  }

  it("mid-year: ancient rows dropped by the bound never affect any metric", () => {
    const ref = new Date("2026-07-15T12:00:00Z");
    assertBoundEquivalence(ref, [
      commission("2023-03-01T10:00:00Z", 5000), // ancient — outside every window
      commission("2025-11-15T10:00:00Z", 4000), // prior year — outside YTD & 60d
      commission("2026-01-05T10:00:00Z", 3000), // YTD, old enough to be trimmable
      commission("2026-06-20T10:00:00Z", 2000), // within last-60d
      commission("2026-07-10T10:00:00Z", 1000), // within last-30d
    ]);
  });

  it("January edge: prev-30/60d window reaches into last year and is retained", () => {
    const ref = new Date("2026-01-20T12:00:00Z");
    assertBoundEquivalence(ref, [
      commission("2024-12-10T10:00:00Z", 9000), // ancient — outside the 60d window
      commission("2025-12-15T10:00:00Z", 800), // ~36d before ref → prev-30 window, MUST survive
      commission("2026-01-02T10:00:00Z", 1200), // YTD + last-30
      commission("2026-01-18T10:00:00Z", 600), // last-30
    ]);
  });

  it("boundary: a row at the prev-30 window start (now-60d) is inside the bound", () => {
    // now-60d is the earliest instant calculateGoalTracking reads; the fetch
    // bound must sit before it (the 2-day buffer guarantees this). Seed a row
    // right at that edge so a too-tight bound would clip it and break equality.
    const ref = new Date("2026-08-15T12:00:00Z");
    const sixtyDaysAgo = new Date(ref);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    assertBoundEquivalence(ref, [
      commission(sixtyDaysAgo.toISOString(), 1500), // exactly at prev-30 start
      commission("2026-08-10T10:00:00Z", 700), // last-30
    ]);
  });

  it("empty set is handled identically", () => {
    assertBoundEquivalence(new Date("2026-05-01T12:00:00Z"), []);
  });
});
