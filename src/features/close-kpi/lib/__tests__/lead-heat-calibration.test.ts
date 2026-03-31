import { describe, it, expect } from "vitest";
import {
  calibratePortfolio,
  percentileToHeatLevel,
} from "../lead-heat-calibration";

describe("calibratePortfolio", () => {
  it("returns empty array for empty input", () => {
    expect(calibratePortfolio([])).toEqual([]);
  });

  it("returns all neutral for fewer than 5 leads", () => {
    const scores = [
      { closeLeadId: "lead_1", rawScore: 80 },
      { closeLeadId: "lead_2", rawScore: 50 },
      { closeLeadId: "lead_3", rawScore: 20 },
    ];
    const result = calibratePortfolio(scores);
    expect(result).toHaveLength(3);
    result.forEach((r) => {
      expect(r.heatLevel).toBe("neutral");
      expect(r.percentileRank).toBe(50);
    });
  });

  it("assigns correct bands for a 20-lead portfolio", () => {
    // Create 20 leads with scores 5, 10, 15, ..., 100
    const scores = Array.from({ length: 20 }, (_, i) => ({
      closeLeadId: `lead_${i + 1}`,
      rawScore: (i + 1) * 5,
    }));

    const result = calibratePortfolio(scores);
    expect(result).toHaveLength(20);

    // Results are sorted descending (highest first)
    expect(result[0].rawScore).toBe(100);
    expect(result[19].rawScore).toBe(5);

    // Count by heat level
    const counts = { hot: 0, warming: 0, neutral: 0, cooling: 0, cold: 0 };
    result.forEach((r) => counts[r.heatLevel]++);

    // With 20 leads: hot=2 (10%), warming=3 (15%), neutral=5 (25%), cooling=5 (25%), cold=5 (25%)
    expect(counts.hot).toBe(2);
    expect(counts.warming).toBe(3);
    expect(counts.neutral).toBe(5);
    expect(counts.cooling).toBe(5);
    expect(counts.cold).toBe(5);
  });

  it("handles 100 leads with expected distribution", () => {
    const scores = Array.from({ length: 100 }, (_, i) => ({
      closeLeadId: `lead_${i}`,
      rawScore: i + 1,
    }));

    const result = calibratePortfolio(scores);
    const counts = { hot: 0, warming: 0, neutral: 0, cooling: 0, cold: 0 };
    result.forEach((r) => counts[r.heatLevel]++);

    // ~10% hot, ~15% warming, ~25% neutral, ~25% cooling, ~25% cold
    // Mid-rank percentile rounding at boundaries may shift +-1
    expect(counts.hot).toBeGreaterThanOrEqual(10);
    expect(counts.hot).toBeLessThanOrEqual(12);
    expect(counts.warming).toBeGreaterThanOrEqual(14);
    expect(counts.warming).toBeLessThanOrEqual(16);
    expect(counts.neutral).toBeGreaterThanOrEqual(24);
    expect(counts.neutral).toBeLessThanOrEqual(26);
    expect(counts.cooling).toBeGreaterThanOrEqual(24);
    expect(counts.cooling).toBeLessThanOrEqual(26);
    expect(counts.cold).toBeGreaterThanOrEqual(24);
    expect(counts.cold).toBeLessThanOrEqual(26);
    // Total must still be exactly 100
    expect(
      counts.hot +
        counts.warming +
        counts.neutral +
        counts.cooling +
        counts.cold,
    ).toBe(100);
  });

  it("handles all identical scores", () => {
    const scores = Array.from({ length: 10 }, (_, i) => ({
      closeLeadId: `lead_${i}`,
      rawScore: 50,
    }));

    const result = calibratePortfolio(scores);
    expect(result).toHaveLength(10);

    // All have the same raw score, but percentile varies by position
    // since sort is by raw score (stable order in JS for equal elements)
    result.forEach((r) => {
      expect(r.rawScore).toBe(50);
      expect(r.percentileRank).toBeGreaterThanOrEqual(0);
      expect(r.percentileRank).toBeLessThanOrEqual(100);
    });
  });

  it("preserves closeLeadId and rawScore", () => {
    const scores = Array.from({ length: 10 }, (_, i) => ({
      closeLeadId: `lead_${i}`,
      rawScore: (i + 1) * 10,
    }));

    const result = calibratePortfolio(scores);
    const leadIds = new Set(result.map((r) => r.closeLeadId));
    expect(leadIds.size).toBe(10);
    scores.forEach((s) => {
      expect(leadIds.has(s.closeLeadId)).toBe(true);
    });
  });

  it("exactly 5 leads (minimum threshold)", () => {
    const scores = Array.from({ length: 5 }, (_, i) => ({
      closeLeadId: `lead_${i}`,
      rawScore: (i + 1) * 20,
    }));

    const result = calibratePortfolio(scores);
    // Should NOT be all neutral — exactly 5 is the minimum
    const levels = new Set(result.map((r) => r.heatLevel));
    expect(levels.size).toBeGreaterThan(1);
  });
});

describe("percentileToHeatLevel", () => {
  it("returns hot for top 10%", () => {
    expect(percentileToHeatLevel(95, 100)).toBe("hot");
    expect(percentileToHeatLevel(90, 100)).toBe("hot");
    expect(percentileToHeatLevel(100, 100)).toBe("hot");
  });

  it("returns warming for 75-89th percentile", () => {
    expect(percentileToHeatLevel(89, 100)).toBe("warming");
    expect(percentileToHeatLevel(75, 100)).toBe("warming");
  });

  it("returns neutral for 50-74th percentile", () => {
    expect(percentileToHeatLevel(74, 100)).toBe("neutral");
    expect(percentileToHeatLevel(50, 100)).toBe("neutral");
  });

  it("returns cooling for 25-49th percentile", () => {
    expect(percentileToHeatLevel(49, 100)).toBe("cooling");
    expect(percentileToHeatLevel(25, 100)).toBe("cooling");
  });

  it("returns cold for below 25th percentile", () => {
    expect(percentileToHeatLevel(24, 100)).toBe("cold");
    expect(percentileToHeatLevel(0, 100)).toBe("cold");
  });

  it("returns neutral for small portfolios", () => {
    expect(percentileToHeatLevel(95, 3)).toBe("neutral");
  });
});
