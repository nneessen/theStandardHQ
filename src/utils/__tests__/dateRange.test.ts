// src/utils/__tests__/dateRange.test.ts

import { afterEach, beforeEach, vi } from "vitest";
import {
  DateRange,
  DAYS_PER_PERIOD,
  getDateRange,
  scaleMetricByPeriod,
  getAveragePeriodValue,
  getPeriodLabel,
} from "../dateRange";

describe("dateRange time period scaling", () => {
  describe("DAYS_PER_PERIOD constant", () => {
    it("should have correct day values for each period", () => {
      expect(DAYS_PER_PERIOD.daily).toBe(1);
      expect(DAYS_PER_PERIOD.weekly).toBe(7);
      expect(DAYS_PER_PERIOD.monthly).toBe(30.44);
      expect(DAYS_PER_PERIOD.yearly).toBe(365.25);
    });
  });

  describe("scaleMetricByPeriod", () => {
    it("should scale daily to weekly correctly", () => {
      const result = scaleMetricByPeriod(100, "daily", "weekly");
      expect(result).toBe(700); // 100 * 7
    });

    it("should scale monthly to weekly correctly", () => {
      const result = scaleMetricByPeriod(4000, "monthly", "weekly");
      // 4000 / 30.44 = 131.41... per day
      // 131.41 * 7 = 919.87...
      expect(result).toBeCloseTo(919.87, 1);
    });

    it("should scale weekly to monthly correctly", () => {
      const result = scaleMetricByPeriod(1000, "weekly", "monthly");
      // 1000 / 7 = 142.86 per day
      // 142.86 * 30.44 = 4348.57
      expect(result).toBeCloseTo(4348.57, 1);
    });

    it("should scale yearly to monthly correctly", () => {
      const result = scaleMetricByPeriod(60000, "yearly", "monthly");
      // 60000 / 365.25 = 164.25 per day
      // 164.25 * 30.44 = 5000
      expect(result).toBeCloseTo(5000, 0);
    });

    it("should return same value when scaling to same period", () => {
      const result = scaleMetricByPeriod(5000, "monthly", "monthly");
      expect(result).toBe(5000);
    });
  });

  describe("getAveragePeriodValue", () => {
    it("should calculate weekly average from 30-day monthly data", () => {
      // Example: $4,000 in expenses over 30 days
      const dateRange: DateRange = {
        startDate: new Date("2025-10-01"),
        endDate: new Date("2025-10-31"),
      };

      const result = getAveragePeriodValue(4000, dateRange, "weekly");

      // Daily average: 4000 / 30 = 133.33
      // Weekly average: 133.33 * 7 = 933.33
      expect(result).toBeCloseTo(933.33, 0);
    });

    it("should calculate daily average from 30-day monthly data", () => {
      const dateRange: DateRange = {
        startDate: new Date("2025-10-01"),
        endDate: new Date("2025-10-31"),
      };

      const result = getAveragePeriodValue(4000, dateRange, "daily");

      // Daily average: 4000 / 30 = 133.33
      expect(result).toBeCloseTo(133.33, 0);
    });

    it("should calculate monthly average from 30-day data", () => {
      const dateRange: DateRange = {
        startDate: new Date("2025-10-01"),
        endDate: new Date("2025-10-31"),
      };

      const result = getAveragePeriodValue(4000, dateRange, "monthly");

      // Daily average: 4000 / 30 = 133.33
      // Monthly average: 133.33 * 30.44 = 4058.67
      expect(result).toBeCloseTo(4058.67, 0);
    });

    it("should calculate yearly average from 30-day data", () => {
      const dateRange: DateRange = {
        startDate: new Date("2025-10-01"),
        endDate: new Date("2025-10-31"),
      };

      const result = getAveragePeriodValue(4000, dateRange, "yearly");

      // Daily average: 4000 / 30 = 133.33
      // Yearly average: 133.33 * 365.25 = 48700
      expect(result).toBeCloseTo(48700, 0);
    });

    it("should handle 7-day weekly data correctly", () => {
      const dateRange: DateRange = {
        startDate: new Date("2025-10-01"),
        endDate: new Date("2025-10-08"),
      };

      const result = getAveragePeriodValue(1000, dateRange, "weekly");

      // Daily average: 1000 / 7 = 142.86
      // Weekly average: 142.86 * 7 = 1000
      expect(result).toBeCloseTo(1000, 0);
    });

    it("should handle edge case of 1-day range", () => {
      const dateRange: DateRange = {
        startDate: new Date("2025-10-01"),
        endDate: new Date("2025-10-01"),
      };

      const result = getAveragePeriodValue(100, dateRange, "daily");

      // Uses Math.max(1, ...) to prevent division by zero
      expect(result).toBe(100);
    });
  });

  describe("Real-world example from review document", () => {
    it("should replicate the exact example from the bug report", () => {
      // Bug report states:
      // Monthly expenses: $4,000
      // Expected weekly: ~$923
      // Bug showed: $4,000 (wrong - no scaling)

      const dateRange: DateRange = {
        startDate: new Date("2025-10-01"),
        endDate: new Date("2025-10-31"),
      };

      const monthlyExpenses = 4000;
      const weeklyAverage = getAveragePeriodValue(
        monthlyExpenses,
        dateRange,
        "weekly",
      );

      // Should be around $923 (not $4,000)
      expect(weeklyAverage).toBeCloseTo(933, 0); // Slightly higher than 923 due to 30.44 avg month
      expect(weeklyAverage).not.toBe(4000); // ✅ Bug is fixed!
    });
  });
});

describe("getPeriodLabel", () => {
  it("should return correct labels for each period", () => {
    expect(getPeriodLabel("daily")).toBe("Daily");
    expect(getPeriodLabel("weekly")).toBe("Weekly");
    expect(getPeriodLabel("monthly")).toBe("Monthly");
    expect(getPeriodLabel("yearly")).toBe("Yearly");
  });
});

describe("getDateRange offset navigation", () => {
  // Pin "today" to a 30th of a 30-day month, then a 31st of a 31-day month.
  // Both used to expose the setMonth-overflow bug that skipped February.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("monthly — month-end reference dates do not skip short months", () => {
    it("steps through every month going backward when today is April 30 (30-day month)", () => {
      vi.setSystemTime(new Date(2026, 3, 30, 12, 0, 0));

      // offset 0: April 2026
      let r = getDateRange("monthly", 0);
      expect(r.startDate.getFullYear()).toBe(2026);
      expect(r.startDate.getMonth()).toBe(3); // April

      // offset -1: March 2026
      r = getDateRange("monthly", -1);
      expect(r.startDate.getFullYear()).toBe(2026);
      expect(r.startDate.getMonth()).toBe(2); // March

      // offset -2: February 2026 — the regression case
      r = getDateRange("monthly", -2);
      expect(r.startDate.getFullYear()).toBe(2026);
      expect(r.startDate.getMonth()).toBe(1); // February
      // last day of Feb 2026 is the 28th
      expect(r.endDate.getDate()).toBe(28);

      // offset -3: January 2026
      r = getDateRange("monthly", -3);
      expect(r.startDate.getFullYear()).toBe(2026);
      expect(r.startDate.getMonth()).toBe(0); // January

      // crossing the year boundary
      r = getDateRange("monthly", -4);
      expect(r.startDate.getFullYear()).toBe(2025);
      expect(r.startDate.getMonth()).toBe(11); // December 2025
    });

    it("does not skip February when today is March 31 (31-day month)", () => {
      vi.setSystemTime(new Date(2026, 2, 31, 12, 0, 0));

      const feb = getDateRange("monthly", -1);
      expect(feb.startDate.getMonth()).toBe(1); // February
      expect(feb.startDate.getFullYear()).toBe(2026);
      expect(feb.endDate.getDate()).toBe(28);
    });

    it("does not skip April when today is May 31 (April has only 30 days)", () => {
      vi.setSystemTime(new Date(2026, 4, 31, 12, 0, 0));

      const apr = getDateRange("monthly", -1);
      expect(apr.startDate.getMonth()).toBe(3); // April
      expect(apr.endDate.getDate()).toBe(30);
    });
  });

  describe("MTD — same regression for the MTD period", () => {
    it("offset -2 from April 30 lands on February, not March", () => {
      vi.setSystemTime(new Date(2026, 3, 30, 12, 0, 0));

      const feb = getDateRange("MTD", -2);
      expect(feb.startDate.getMonth()).toBe(1); // February
      expect(feb.endDate.getMonth()).toBe(1);
      expect(feb.endDate.getDate()).toBe(28);
    });
  });

  describe("yearly — Feb 29 leap-year boundary", () => {
    it("yearly offset from Feb 29 of a leap year does not roll into March", () => {
      vi.setSystemTime(new Date(2024, 1, 29, 12, 0, 0));

      const lastYear = getDateRange("yearly", -1);
      expect(lastYear.startDate.getFullYear()).toBe(2023);
      expect(lastYear.startDate.getMonth()).toBe(0);
      expect(lastYear.startDate.getDate()).toBe(1);
      expect(lastYear.endDate.getFullYear()).toBe(2023);
      expect(lastYear.endDate.getMonth()).toBe(11);
      expect(lastYear.endDate.getDate()).toBe(31);
    });
  });
});
