import { describe, it, expect } from "vitest";
import { generateCacheKey } from "../cache-key";
import type { StatCardConfig } from "../../types/close-kpi.types";

describe("generateCacheKey", () => {
  const baseConfig: StatCardConfig = {
    metric: "lead_count",
    dateRange: "this_month",
    comparison: "none",
  };

  it("generates a non-empty string", () => {
    const key = generateCacheKey("stat_card", baseConfig);
    expect(key).toBeTruthy();
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  it("produces the same key for identical configs", () => {
    const key1 = generateCacheKey("stat_card", baseConfig);
    const key2 = generateCacheKey("stat_card", { ...baseConfig });
    expect(key1).toBe(key2);
  });

  it("produces different keys for different widget types", () => {
    const key1 = generateCacheKey("stat_card", baseConfig);
    const key2 = generateCacheKey("call_analytics", baseConfig);
    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different metrics", () => {
    const key1 = generateCacheKey("stat_card", baseConfig);
    const key2 = generateCacheKey("stat_card", {
      ...baseConfig,
      metric: "calls_total",
    });
    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different date ranges", () => {
    const key1 = generateCacheKey("stat_card", baseConfig);
    const key2 = generateCacheKey("stat_card", {
      ...baseConfig,
      dateRange: "this_week",
    });
    expect(key1).not.toBe(key2);
  });

  it("produces different keys when global date range differs", () => {
    const key1 = generateCacheKey("stat_card", baseConfig, "this_month");
    const key2 = generateCacheKey("stat_card", baseConfig, "this_week");
    expect(key1).not.toBe(key2);
  });

  it("is deterministic regardless of property order", () => {
    const config1 = {
      metric: "lead_count" as const,
      dateRange: "this_month" as const,
      comparison: "none" as const,
    };
    const config2 = {
      comparison: "none" as const,
      metric: "lead_count" as const,
      dateRange: "this_month" as const,
    };
    const key1 = generateCacheKey("stat_card", config1);
    const key2 = generateCacheKey("stat_card", config2);
    expect(key1).toBe(key2);
  });

  it("does not contain special characters from base64", () => {
    const key = generateCacheKey("stat_card", baseConfig);
    expect(key).not.toMatch(/[=+/]/);
  });
});
