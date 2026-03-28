import { describe, it, expect } from "vitest";
import {
  calculateChangePercent,
  formatDuration,
  getDateRangeBounds,
  getComparisonBounds,
  median,
} from "../kpi-calculations";

describe("calculateChangePercent", () => {
  it("returns positive percent for increase", () => {
    expect(calculateChangePercent(150, 100)).toBe(50);
  });

  it("returns negative percent for decrease", () => {
    expect(calculateChangePercent(50, 100)).toBe(-50);
  });

  it("returns 0 for no change", () => {
    expect(calculateChangePercent(100, 100)).toBe(0);
  });

  it("returns 100 when previous is 0 and current is positive", () => {
    expect(calculateChangePercent(50, 0)).toBe(100);
  });

  it("returns null when both are 0", () => {
    expect(calculateChangePercent(0, 0)).toBeNull();
  });

  it("handles fractional changes with 1 decimal precision", () => {
    // (110 - 100) / 100 = 0.1 = 10%
    expect(calculateChangePercent(110, 100)).toBe(10);
    // (105 - 100) / 100 = 0.05 = 5%
    expect(calculateChangePercent(105, 100)).toBe(5);
    // (101 - 100) / 100 = 0.01 = 1%
    expect(calculateChangePercent(101, 100)).toBe(1);
  });
});

describe("formatDuration", () => {
  it("formats sub-day durations as hours", () => {
    expect(formatDuration(0.5)).toBe("12 hours");
  });

  it("formats 1 hour correctly", () => {
    // 1/24 of a day
    expect(formatDuration(1 / 24)).toBe("1 hour");
  });

  it("formats 1 day as singular", () => {
    expect(formatDuration(1)).toBe("1 day");
  });

  it("formats multiple days", () => {
    expect(formatDuration(5.3)).toBe("5.3 days");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0 hours");
  });
});

describe("getDateRangeBounds", () => {
  it("returns today for 'today' preset", () => {
    const { from, to } = getDateRangeBounds("today");
    expect(from).toBe(to);
    // Should be a valid date string
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns start of week for 'this_week'", () => {
    const { from, to } = getDateRangeBounds("this_week");
    // from should be a valid date string at or before today
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // from should be within last 7 days
    const diff =
      (new Date(to).getTime() - new Date(from).getTime()) /
      (1000 * 60 * 60 * 24);
    expect(diff).toBeLessThanOrEqual(6);
    expect(diff).toBeGreaterThanOrEqual(0);
  });

  it("returns start of month for 'this_month'", () => {
    const { from } = getDateRangeBounds("this_month");
    expect(from).toMatch(/-01$/); // First of month
  });

  it("returns 7 days back for 'last_7_days'", () => {
    const { from, to } = getDateRangeBounds("last_7_days");
    const diff =
      (new Date(to).getTime() - new Date(from).getTime()) /
      (1000 * 60 * 60 * 24);
    expect(diff).toBe(7);
  });

  it("returns 30 days back for 'last_30_days'", () => {
    const { from, to } = getDateRangeBounds("last_30_days");
    const diff =
      (new Date(to).getTime() - new Date(from).getTime()) /
      (1000 * 60 * 60 * 24);
    expect(diff).toBe(30);
  });

  it("returns custom dates for 'custom' preset", () => {
    const { from, to } = getDateRangeBounds(
      "custom",
      "2026-01-01",
      "2026-01-31",
    );
    expect(from).toBe("2026-01-01");
    expect(to).toBe("2026-01-31");
  });

  it("falls back to today for unknown preset", () => {
    const { from, to } = getDateRangeBounds("unknown_preset");
    const today = new Date().toISOString().split("T")[0];
    expect(from).toBe(today);
    expect(to).toBe(today);
  });

  it("handles 'this_quarter' correctly", () => {
    const { from } = getDateRangeBounds("this_quarter");
    // from should be the first of a quarter-start month (Jan, Apr, Jul, Oct)
    expect(from).toMatch(/-01$/); // First of month
    // The month in the date string should be a quarter start
    const monthStr = from.split("-")[1];
    expect(["01", "04", "07", "10"]).toContain(monthStr);
  });

  it("handles 'this_year' correctly", () => {
    const { from } = getDateRangeBounds("this_year");
    const year = new Date().getFullYear();
    expect(from).toBe(`${year}-01-01`);
  });
});

describe("getComparisonBounds", () => {
  it("returns a previous period of equal duration", () => {
    const { from, to } = getComparisonBounds("2026-03-01", "2026-03-31");
    const currentDuration =
      new Date("2026-03-31").getTime() - new Date("2026-03-01").getTime();
    const compDuration = new Date(to).getTime() - new Date(from).getTime();
    // Comparison duration should equal current duration (within 1 day due to -1ms truncation)
    expect(Math.abs(compDuration - currentDuration)).toBeLessThanOrEqual(
      86400000,
    );
  });

  it("comparison period ends before current period starts", () => {
    const { to } = getComparisonBounds("2026-03-01", "2026-03-31");
    expect(new Date(to).getTime()).toBeLessThan(
      new Date("2026-03-01").getTime(),
    );
  });

  it("works for single-day ranges", () => {
    const { from, to } = getComparisonBounds("2026-03-15", "2026-03-15");
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("median", () => {
  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns single element for length 1", () => {
    expect(median([5])).toBe(5);
  });

  it("returns middle element for odd length", () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it("returns average of two middle elements for even length", () => {
    expect(median([1, 3, 5, 7])).toBe(4);
  });

  it("handles already sorted input", () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });
});
