// Pure-function percentile-based calibration for lead heat scores.
// Converts raw heuristic scores into relative portfolio rankings.

import type { LeadHeatLevel } from "../types/close-kpi.types";

type HeatLevel = LeadHeatLevel;

export interface CalibratedScore {
  closeLeadId: string;
  rawScore: number;
  percentileRank: number; // 0-100
  heatLevel: HeatLevel;
}

const MIN_PORTFOLIO_SIZE = 5;

/**
 * Assign percentile-based heat bands to a portfolio of raw scores.
 *
 * Bands (from top of portfolio):
 *   Hot:     top 10%
 *   Warming: next 15% (10-25th percentile)
 *   Neutral: next 25% (25-50th percentile)
 *   Cooling: next 25% (50-75th percentile)
 *   Cold:    bottom 25%
 *
 * If portfolio has fewer than MIN_PORTFOLIO_SIZE leads, all are "neutral"
 * (not enough data for meaningful relative ranking).
 */
export function calibratePortfolio(
  scores: { closeLeadId: string; rawScore: number }[],
): CalibratedScore[] {
  if (scores.length === 0) return [];

  // Below minimum: all neutral
  if (scores.length < MIN_PORTFOLIO_SIZE) {
    return scores.map((s) => ({
      closeLeadId: s.closeLeadId,
      rawScore: s.rawScore,
      percentileRank: 50,
      heatLevel: "neutral" as HeatLevel,
    }));
  }

  // Sort descending by score (highest first)
  const sorted = [...scores].sort((a, b) => b.rawScore - a.rawScore);
  const n = sorted.length;

  return sorted.map((s, index) => {
    // Percentile rank: 100 = highest, 0 = lowest
    // Uses (n - index - 0.5) / n * 100 for mid-rank percentile
    const percentileRank = Math.round(((n - index - 0.5) / n) * 100);
    const heatLevel = percentileToHeatLevel(percentileRank, n);
    return {
      closeLeadId: s.closeLeadId,
      rawScore: s.rawScore,
      percentileRank,
      heatLevel,
    };
  });
}

/**
 * Convert a percentile rank to a heat level using the portfolio band thresholds.
 * Ties at boundaries go to the higher (more actionable) band.
 */
export function percentileToHeatLevel(
  percentileRank: number,
  portfolioSize: number,
): HeatLevel {
  if (portfolioSize < MIN_PORTFOLIO_SIZE) return "neutral";
  if (percentileRank >= 90) return "hot"; // top 10%
  if (percentileRank >= 75) return "warming"; // next 15%
  if (percentileRank >= 50) return "neutral"; // next 25%
  if (percentileRank >= 25) return "cooling"; // next 25%
  return "cold"; // bottom 25%
}

/**
 * Build a lookup map from calibrated scores for fast access by lead ID.
 */
export function buildCalibrationMap(
  calibrated: CalibratedScore[],
): Map<string, CalibratedScore> {
  return new Map(calibrated.map((c) => [c.closeLeadId, c]));
}
