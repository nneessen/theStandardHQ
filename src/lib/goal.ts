// src/lib/goal.ts

export interface GoalPremiumAverages {
  personalMedianPolicyPremium?: number | null;
  personalAvgPolicyPremium?: number | null;
  medianPolicyPremium?: number | null;
  avgPolicyPremium?: number | null;
}

/**
 * Resolve the average premium used for the monthly AP goal.
 *
 * Returns a single, stable average rather than the MAX of every available
 * signal (the old behaviour, which biased the goal high). Prefers the
 * explicitly configured avgAP, then the agent's own median (robust to
 * outliers), then personal mean, then team median/mean. Returns 0 when no
 * signal is available (callers treat a 0 goal as "no goal set").
 *
 * Shared by the Dashboard hero and the Analytics hero so the monthly goal is
 * computed identically on both surfaces.
 */
export function resolveGoalAvgAP(
  configuredAvgAP: number | null | undefined,
  averages: GoalPremiumAverages,
): number {
  return (
    (configuredAvgAP ?? 0) ||
    (averages.personalMedianPolicyPremium ?? 0) ||
    (averages.personalAvgPolicyPremium ?? 0) ||
    (averages.medianPolicyPremium ?? 0) ||
    (averages.avgPolicyPremium ?? 0)
  );
}
