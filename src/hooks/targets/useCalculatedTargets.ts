// src/hooks/targets/useCalculatedTargets.ts

import { useMemo } from "react";
import { useTargets } from "./useTargets";
import { useHistoricalAverages } from "./useHistoricalAverages";
import {
  targetsCalculationService,
  type CalculatedTargets,
} from "../../services/targets/targetsCalculationService";

interface UseCalculatedTargetsResult {
  /** Full optimistic + realistic calculation, or null when no target set yet. */
  calculated: CalculatedTargets | null;
  isLoading: boolean;
  error: Error | null;
  /** True once targets row exists with annualIncomeTarget > 0. */
  hasTargets: boolean;
}

/**
 * Single source of truth for target math across the app.
 *
 * Combines the user's saved targets + saved realism knobs + historical
 * averages into one `CalculatedTargets` object via
 * `targetsCalculationService.calculateTargets()`.
 *
 * Use this anywhere a dashboard, KPI, or pace meter needs to compare actual
 * commission/policies against a goal. Replaces direct reads of
 * `userTargets.monthly_income_target` (which is the NET take-home goal,
 * not a commission target).
 *
 * Key returned fields:
 * - `realisticGrossCommissionNeeded` — gross commission needed annually to
 *   take home `annualIncomeTarget` after persistency, tax, and NTO drag.
 *   Divide by 12 for the realistic monthly commission target.
 * - `realisticAnnualAppsToWrite` — apps to write/year (the activity ask).
 * - `effectiveCommissionRate` — first-year rate × persistency.
 * - Optimistic counterparts (`annualPoliciesTarget`, `monthlyIncomeTarget`,
 *   etc.) for surfaces that want to show both.
 */
export function useCalculatedTargets(): UseCalculatedTargetsResult {
  const { data: targets, isLoading: targetsLoading, error } = useTargets();
  const { averages, isLoading: averagesLoading } = useHistoricalAverages();

  const calculated = useMemo<CalculatedTargets | null>(() => {
    if (!targets || targets.annualIncomeTarget <= 0) return null;
    return targetsCalculationService.calculateTargets({
      annualIncomeTarget: targets.annualIncomeTarget,
      historicalAverages: averages,
      realism: {
        persistencyRate: targets.persistencyAssumption,
        taxReserveRate: targets.taxReserveRate,
        ntoBufferRate: targets.ntoBufferRate,
        premiumStat: targets.premiumStatPreference,
      },
    });
  }, [targets, averages]);

  return {
    calculated,
    isLoading: targetsLoading || averagesLoading,
    error: (error as Error | null) ?? null,
    hasTargets: !!targets && targets.annualIncomeTarget > 0,
  };
}
