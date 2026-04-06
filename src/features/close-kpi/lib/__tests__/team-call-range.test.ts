// src/features/close-kpi/lib/__tests__/team-call-range.test.ts
//
// Unit tests for the timezone-aware date range helper used by the Team tab's
// daily call view. The most important things to assert are:
//
// 1. The output ISO strings carry the LOCAL timezone offset, not UTC.
//    (If toLocalIso ever regresses to .toISOString(), "today" would shift
//    by the timezone offset and the user would see yesterday/tomorrow's data.)
// 2. Window boundaries are inclusive on both sides (00:00:00.000 → 23:59:59.999).
// 3. last_7_days includes today + 6 prior days, not 7 prior excluding today.
// 4. last_30_days same.
// 5. Custom range pass-through.
//
// We use an injected `now` so the tests are deterministic and don't depend
// on the test runner's wall clock.

import { describe, it, expect } from "vitest";
import { buildTeamCallRange, toLocalIso } from "../team-call-range";

describe("toLocalIso", () => {
  it("formats with the local timezone offset, not UTC", () => {
    // Pick a specific moment: April 6 2026, 14:30:45 LOCAL
    const d = new Date(2026, 3, 6, 14, 30, 45, 0);
    const iso = toLocalIso(d);

    // Must include the date and time portions correctly
    expect(iso).toMatch(/^2026-04-06T14:30:45/);

    // Must NOT end with "Z" (which would mean UTC)
    expect(iso).not.toMatch(/Z$/);

    // Must end with a +HH:MM or -HH:MM offset
    expect(iso).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it("zero-pads single-digit hours/minutes/seconds", () => {
    const d = new Date(2026, 0, 1, 5, 7, 9, 0);
    const iso = toLocalIso(d);
    expect(iso).toMatch(/^2026-01-01T05:07:09/);
  });

  it("preserves the local calendar date even near a UTC day boundary", () => {
    // 23:59:59 local on April 6 — in many timezones, this is April 7 in UTC.
    // toLocalIso must preserve "2026-04-06" not "2026-04-07".
    const d = new Date(2026, 3, 6, 23, 59, 59, 999);
    const iso = toLocalIso(d);
    expect(iso.slice(0, 10)).toBe("2026-04-06");
  });
});

describe("buildTeamCallRange", () => {
  // Anchor "now" at April 6 2026, 14:00 local. All preset math is computed
  // relative to this fixed moment.
  const NOW = new Date(2026, 3, 6, 14, 0, 0, 0);

  describe("today", () => {
    const range = buildTeamCallRange("today", undefined, undefined, NOW);

    it("uses preset 'today'", () => {
      expect(range.preset).toBe("today");
    });

    it("from is start of today (00:00:00)", () => {
      expect(range.from).toMatch(/^2026-04-06T00:00:00/);
    });

    it("to is end of today (23:59:59)", () => {
      expect(range.to).toMatch(/^2026-04-06T23:59:59/);
    });

    it("label is 'Today'", () => {
      expect(range.label).toBe("Today");
    });

    it("from and to are local-tz, not UTC", () => {
      expect(range.from).not.toMatch(/Z$/);
      expect(range.to).not.toMatch(/Z$/);
    });
  });

  describe("yesterday", () => {
    const range = buildTeamCallRange("yesterday", undefined, undefined, NOW);

    it("from is start of April 5 2026", () => {
      expect(range.from).toMatch(/^2026-04-05T00:00:00/);
    });

    it("to is end of April 5 2026", () => {
      expect(range.to).toMatch(/^2026-04-05T23:59:59/);
    });
  });

  describe("last_7_days", () => {
    // Inclusive 7-day window ending TODAY: today + 6 prior days
    // = March 31 → April 6 inclusive
    const range = buildTeamCallRange("last_7_days", undefined, undefined, NOW);

    it("from is start of March 31 (today minus 6 days)", () => {
      expect(range.from).toMatch(/^2026-03-31T00:00:00/);
    });

    it("to is end of today (April 6)", () => {
      expect(range.to).toMatch(/^2026-04-06T23:59:59/);
    });

    it("does NOT extend to 7 days before today (would exclude today)", () => {
      // If buggy implementation set start to 7 days ago instead of 6, the
      // range would be March 30 → April 5, missing today. Catch that here.
      expect(range.from).not.toMatch(/^2026-03-30/);
    });
  });

  describe("last_30_days", () => {
    // Inclusive 30-day window ending TODAY: today + 29 prior days
    // = March 8 → April 6 inclusive
    const range = buildTeamCallRange("last_30_days", undefined, undefined, NOW);

    it("from is start of March 8 (today minus 29 days)", () => {
      expect(range.from).toMatch(/^2026-03-08T00:00:00/);
    });

    it("to is end of today (April 6)", () => {
      expect(range.to).toMatch(/^2026-04-06T23:59:59/);
    });
  });

  describe("custom", () => {
    it("passes through provided ISO timestamps", () => {
      const customFrom = "2026-01-01T00:00:00-05:00";
      const customTo = "2026-01-31T23:59:59-05:00";
      const range = buildTeamCallRange("custom", customFrom, customTo, NOW);
      // The implementation re-runs the dates through toLocalIso, so the
      // OUTPUT will be in the test runner's local timezone — but it represents
      // the same moment. We assert the date portion matches at minimum.
      expect(range.from.slice(0, 10)).toMatch(/^2026-01-0[01]$/);
      expect(range.to.slice(0, 10)).toMatch(/^2026-01-3[01]$/);
      expect(range.preset).toBe("custom");
    });

    it("falls back to today when custom from/to are missing", () => {
      const range = buildTeamCallRange("custom", undefined, undefined, NOW);
      expect(range.from).toMatch(/^2026-04-06T00:00:00/);
      expect(range.to).toMatch(/^2026-04-06T23:59:59/);
    });
  });

  describe("midnight rollover detection (regression guard for H2)", () => {
    // The TeamTab.tsx midnight rollover check compares range.from to a freshly
    // computed range.from. This test pins the contract that DIFFERENT calendar
    // days produce DIFFERENT from strings — so the rollover detector can rely
    // on string equality.
    it("different days produce different `from` strings", () => {
      const apr6 = buildTeamCallRange(
        "today",
        undefined,
        undefined,
        new Date(2026, 3, 6, 23, 59, 0),
      );
      const apr7 = buildTeamCallRange(
        "today",
        undefined,
        undefined,
        new Date(2026, 3, 7, 0, 1, 0),
      );
      expect(apr6.from).not.toBe(apr7.from);
      expect(apr6.from.slice(0, 10)).toBe("2026-04-06");
      expect(apr7.from.slice(0, 10)).toBe("2026-04-07");
    });

    it("same day at different times produces the SAME `from` string", () => {
      // Two calls on the same calendar day must produce the same `from`
      // — otherwise the rollover detector would trigger spuriously every minute.
      const morning = buildTeamCallRange(
        "today",
        undefined,
        undefined,
        new Date(2026, 3, 6, 9, 0, 0),
      );
      const evening = buildTeamCallRange(
        "today",
        undefined,
        undefined,
        new Date(2026, 3, 6, 21, 30, 0),
      );
      expect(morning.from).toBe(evening.from);
      expect(morning.to).toBe(evening.to);
    });
  });
});
