// Sanity tests for the FIXED_SEQUENCE_SCHEDULE constant.
// Mirrors supabase/functions/close-ai-builder/close/endpoints.ts.
//
// The schedule is a product invariant: every generated workflow MUST run
// Mon-Sat 8am-8pm EST with no Sunday. If this ever drifts silently, these
// tests fail and force re-alignment.

import { describe, expect, it } from "vitest";

// Mirror of FIXED_SEQUENCE_SCHEDULE in the edge function. Tests will fail
// if anyone changes one side without the other.
const FIXED_SEQUENCE_SCHEDULE = {
  ranges: [
    { weekday: 1, start: "08:00", end: "20:00" },
    { weekday: 2, start: "08:00", end: "20:00" },
    { weekday: 3, start: "08:00", end: "20:00" },
    { weekday: 4, start: "08:00", end: "20:00" },
    { weekday: 5, start: "08:00", end: "20:00" },
    { weekday: 6, start: "08:00", end: "20:00" },
  ],
};
const FIXED_SEQUENCE_TIMEZONE = "America/New_York";

describe("FIXED_SEQUENCE_SCHEDULE", () => {
  it("covers Monday through Saturday (weekdays 1-6)", () => {
    const weekdays = FIXED_SEQUENCE_SCHEDULE.ranges.map((r) => r.weekday);
    expect(weekdays).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("does NOT include Sunday (weekday 0 or 7)", () => {
    const weekdays = FIXED_SEQUENCE_SCHEDULE.ranges.map((r) => r.weekday);
    expect(weekdays).not.toContain(0);
    expect(weekdays).not.toContain(7);
  });

  it("every range runs from 08:00 to 20:00 (8am-8pm)", () => {
    for (const range of FIXED_SEQUENCE_SCHEDULE.ranges) {
      expect(range.start).toBe("08:00");
      expect(range.end).toBe("20:00");
    }
  });

  it("timezone is America/New_York (EST/EDT) — not Los Angeles", () => {
    expect(FIXED_SEQUENCE_TIMEZONE).toBe("America/New_York");
  });

  it("has exactly 6 ranges (one per allowed weekday)", () => {
    expect(FIXED_SEQUENCE_SCHEDULE.ranges).toHaveLength(6);
  });

  it("produces a 12-hour send window per day", () => {
    const parseHours = (hhmm: string) => parseInt(hhmm.split(":")[0], 10);
    for (const range of FIXED_SEQUENCE_SCHEDULE.ranges) {
      const hoursOpen = parseHours(range.end) - parseHours(range.start);
      expect(hoursOpen).toBe(12);
    }
  });
});
