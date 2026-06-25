import { describe, it, expect } from "vitest";
import { startOfYear, subDays, startOfDay } from "date-fns";
import { calculateGoalTracking } from "../goalTrackingService";
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

// Mirror of the bound IncomeGoalTracker passes to useCommissions({ createdAfter }):
// min(startOfYear(now), now-60d), day-floored, minus a 2-day skew buffer.
function fetchBound(now: Date): Date {
  const yearStart = startOfYear(now);
  const sixtyDaysAgo = subDays(now, 60);
  return startOfDay(
    subDays(yearStart < sixtyDaysAgo ? yearStart : sixtyDaysAgo, 2),
  );
}

// The contract: feeding calculateGoalTracking the full all-time set must produce
// byte-identical output to feeding it only the rows on/after the fetch bound.
// If this ever fails, the IncomeGoalTracker date-bound is under-fetching and
// silently changing money numbers.
describe("goalTracking — date-bound equivalence (Issue 2 IncomeGoalTracker)", () => {
  function assertBoundEquivalence(referenceDate: Date, all: Commission[]) {
    const bound = fetchBound(referenceDate);
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

  it("empty set is handled identically", () => {
    assertBoundEquivalence(new Date("2026-05-01T12:00:00Z"), []);
  });
});
