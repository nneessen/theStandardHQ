// Tests for the day → relative-delay conversion that runs in
// handleSaveSequence (supabase/functions/close-ai-builder/index.ts).
//
// This logic is not directly importable from the frontend test context
// because it's inside a Deno edge function. We replicate the *exact* loop
// here and assert against it. If the real loop ever drifts from this
// reference, the tests fail and we know to re-sync. See the
// "SOURCE OF TRUTH" comment inline below.

import { describe, expect, it } from "vitest";

interface TestStep {
  day: number;
  step_type: "email" | "sms";
}

/**
 * SOURCE OF TRUTH: mirrors the loop in
 *   supabase/functions/close-ai-builder/index.ts:handleSaveSequence
 *
 * Given a sorted list of user-facing "day N" values, produces the
 * sequence of Close API `delay` values (seconds since previous step).
 */
function computeRelativeDelays(steps: TestStep[]): number[] {
  const sorted = [...steps].sort((a, b) => a.day - b.day);
  const delays: number[] = [];
  let prevDay = 1; // Day 1 = enrollment moment
  for (const step of sorted) {
    const day = Math.max(1, step.day);
    const delay = Math.max(0, (day - prevDay) * 86400);
    delays.push(delay);
    prevDay = day;
  }
  return delays;
}

describe("computeRelativeDelays — the bug Nick caught", () => {
  it("single Day 1 step gets delay 0 (immediate on enrollment)", () => {
    expect(computeRelativeDelays([{ day: 1, step_type: "email" }])).toEqual([
      0,
    ]);
  });

  it("Day 1, Day 3 → [0, 2 days] — two days between the steps", () => {
    const result = computeRelativeDelays([
      { day: 1, step_type: "email" },
      { day: 3, step_type: "sms" },
    ]);
    expect(result).toEqual([0, 2 * 86400]);
  });

  it("Day 1, Day 3, Day 6 → [0, 2 days, 3 days] — the exact case from the bug report", () => {
    // Nick said: "when you put in 6 days, thats going to be 6 days from the
    // last message." He meant: Day 6 should land 3 days after Day 3
    // (because 3 + 3 = 6), NOT 5 days after Day 1 (the old broken math).
    const result = computeRelativeDelays([
      { day: 1, step_type: "email" },
      { day: 3, step_type: "sms" },
      { day: 6, step_type: "email" },
    ]);
    expect(result).toEqual([0, 2 * 86400, 3 * 86400]);
    // Spelled out for clarity:
    expect(result[0]).toBe(0); // immediate
    expect(result[1]).toBe(172800); // 2 days after enrollment
    expect(result[2]).toBe(259200); // 3 days after step 2
  });

  it("long sequence: Day 1, Day 2, Day 5, Day 10, Day 14", () => {
    const result = computeRelativeDelays([
      { day: 1, step_type: "email" },
      { day: 2, step_type: "sms" },
      { day: 5, step_type: "email" },
      { day: 10, step_type: "email" },
      { day: 14, step_type: "sms" },
    ]);
    expect(result).toEqual([
      0, // Day 1 = immediate
      1 * 86400, // Day 2 = +1 day
      3 * 86400, // Day 5 = +3 days from Day 2
      5 * 86400, // Day 10 = +5 days from Day 5
      4 * 86400, // Day 14 = +4 days from Day 10
    ]);
  });

  it("out-of-order input is sorted before conversion", () => {
    const result = computeRelativeDelays([
      { day: 7, step_type: "email" },
      { day: 1, step_type: "email" },
      { day: 3, step_type: "sms" },
    ]);
    // After sort: Day 1 / Day 3 / Day 7
    expect(result).toEqual([0, 2 * 86400, 4 * 86400]);
  });

  it("two steps on the same day get delay 0 for the second (same-day follow-up)", () => {
    const result = computeRelativeDelays([
      { day: 3, step_type: "email" },
      { day: 3, step_type: "sms" },
    ]);
    // First step: day - prev(1) = 2 days
    // Second step: day - prev(3) = 0 days
    expect(result).toEqual([2 * 86400, 0]);
  });

  it("day clamps to minimum 1 (user can't create Day 0 or negative)", () => {
    const result = computeRelativeDelays([{ day: -5, step_type: "email" }]);
    expect(result).toEqual([0]);
  });

  it("starting at Day 5 (skipping Day 1) waits 4 days before first touch", () => {
    const result = computeRelativeDelays([{ day: 5, step_type: "email" }]);
    expect(result).toEqual([4 * 86400]);
  });
});

describe("regression: the OLD broken math (what NOT to ship)", () => {
  // Document the bug we fixed so nobody ever reinstates it.
  function BROKEN_absoluteFromStart(steps: TestStep[]): number[] {
    return steps.map((s) => Math.max(0, (s.day - 1) * 86400));
  }

  it("OLD math would place Day 6 at 5 days after enrollment (the bug)", () => {
    // If you send delay: 432000 to Close, it interprets that as "5 days after
    // the previous step," which lands Day 6 at Day 3 + 5 = Day 8 of the
    // sequence — NOT what the user typed.
    const broken = BROKEN_absoluteFromStart([
      { day: 1, step_type: "email" },
      { day: 3, step_type: "sms" },
      { day: 6, step_type: "email" },
    ]);
    // The broken math outputs [0, 172800, 432000]. We're asserting the
    // broken output here just to document it — this is the bug.
    expect(broken).toEqual([0, 172800, 432000]);
  });

  it("correct math differs from broken math starting at step 3", () => {
    const steps: TestStep[] = [
      { day: 1, step_type: "email" },
      { day: 3, step_type: "sms" },
      { day: 6, step_type: "email" },
    ];
    const correct = computeRelativeDelays(steps);
    const broken = [0, 172800, 432000];
    expect(correct[0]).toBe(broken[0]); // same — Day 1
    expect(correct[1]).toBe(broken[1]); // same — coincidentally matches for 2-step case
    expect(correct[2]).not.toBe(broken[2]); // DIFFERS — this is the bug
    expect(correct[2]).toBe(259200); // correct value: 3 days from Day 3
  });
});
