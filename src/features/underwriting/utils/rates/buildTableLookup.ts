// src/features/underwriting/utils/buildTableLookup.ts

import type {
  BuildTableData,
  BuildTableRow,
  BuildRatingClass,
  BuildRatingLookupResult,
  BmiTableData,
  BuildTableType,
  WeightRange,
  BmiRange,
} from "../../types/build-table.types.ts";
import { BUILD_RATING_CLASS_ORDER } from "../../types/build-table.types.ts";
import {
  feetAndInchesToInches,
  calculateBMI,
} from "../shared/bmiCalculator.ts";

/**
 * Finds the build table row for a given height.
 * Uses exact match first, then falls back to nearest height.
 */
function findRowForHeight(
  heightInches: number,
  buildTable: BuildTableData,
): BuildTableRow | null {
  if (!buildTable || buildTable.length === 0) {
    return null;
  }

  // Sort by height for consistent processing
  const sortedTable = [...buildTable].sort(
    (a, b) => a.heightInches - b.heightInches,
  );

  // Try exact match first
  const exactMatch = sortedTable.find(
    (row) => row.heightInches === heightInches,
  );
  if (exactMatch) {
    return exactMatch;
  }

  // If height is below minimum, use minimum
  if (heightInches < sortedTable[0].heightInches) {
    return sortedTable[0];
  }

  // If height is above maximum, use maximum
  if (heightInches > sortedTable[sortedTable.length - 1].heightInches) {
    return sortedTable[sortedTable.length - 1];
  }

  // Find nearest row (round to nearest)
  let nearestRow = sortedTable[0];
  let minDiff = Math.abs(sortedTable[0].heightInches - heightInches);

  for (const row of sortedTable) {
    const diff = Math.abs(row.heightInches - heightInches);
    if (diff < minDiff) {
      minDiff = diff;
      nearestRow = row;
    }
  }

  return nearestRow;
}

/**
 * Checks if a weight falls within a weight range
 */
function isInWeightRange(
  weight: number,
  range: WeightRange | undefined,
): boolean {
  if (!range) return false;
  const min = range.min ?? 0;
  const max = range.max ?? Infinity;
  return weight >= min && weight <= max;
}

/**
 * Determines the rating class based on weight and a build table row.
 * Works from best to worst rating class, returning the first match.
 *
 * @param weightLbs - Client's weight in pounds
 * @param row - The build table row for the client's height
 * @returns The rating class and any threshold info
 */
function getRatingFromRow(
  weightLbs: number,
  row: BuildTableRow,
): BuildRatingLookupResult {
  const { weightRanges } = row;

  // Check from best to worst rating class
  // Weight must fall within the min/max range for that class

  if (weightRanges.preferredPlus) {
    if (isInWeightRange(weightLbs, weightRanges.preferredPlus)) {
      return {
        ratingClass: "preferred_plus",
        hasTable: true,
      };
    }
  }

  if (weightRanges.preferred) {
    if (isInWeightRange(weightLbs, weightRanges.preferred)) {
      return {
        ratingClass: "preferred",
        hasTable: true,
        thresholdExceeded: weightRanges.preferredPlus?.max,
        thresholdClass: "preferred_plus",
      };
    }
  }

  if (weightRanges.standardPlus) {
    if (isInWeightRange(weightLbs, weightRanges.standardPlus)) {
      return {
        ratingClass: "standard_plus",
        hasTable: true,
        thresholdExceeded: weightRanges.preferred?.max,
        thresholdClass: "preferred",
      };
    }
  }

  if (weightRanges.standard) {
    if (isInWeightRange(weightLbs, weightRanges.standard)) {
      return {
        ratingClass: "standard",
        hasTable: true,
        thresholdExceeded: weightRanges.standardPlus?.max,
        thresholdClass: "standard_plus",
      };
    }
  }

  // Check table ratings A through P (substandard)
  const tableRatingKeys = [
    "tableA",
    "tableB",
    "tableC",
    "tableD",
    "tableE",
    "tableF",
    "tableG",
    "tableH",
    "tableI",
    "tableJ",
    "tableK",
    "tableL",
    "tableM",
    "tableN",
    "tableO",
    "tableP",
  ] as const;
  const tableRatingClasses: Record<string, BuildRatingClass> = {
    tableA: "table_a",
    tableB: "table_b",
    tableC: "table_c",
    tableD: "table_d",
    tableE: "table_e",
    tableF: "table_f",
    tableG: "table_g",
    tableH: "table_h",
    tableI: "table_i",
    tableJ: "table_j",
    tableK: "table_k",
    tableL: "table_l",
    tableM: "table_m",
    tableN: "table_n",
    tableO: "table_o",
    tableP: "table_p",
  };

  let prevClass: BuildRatingClass = "standard";
  for (const key of tableRatingKeys) {
    const range = weightRanges[key];
    if (range) {
      if (isInWeightRange(weightLbs, range)) {
        return {
          ratingClass: tableRatingClasses[key],
          hasTable: true,
          thresholdExceeded: weightRanges.standard?.max,
          thresholdClass: prevClass,
        };
      }
      prevClass = tableRatingClasses[key];
    }
  }

  // Weight exceeds all defined thresholds = generic table rated
  return {
    ratingClass: "table_rated",
    hasTable: true,
    thresholdExceeded: weightRanges.standard?.max,
    thresholdClass: prevClass,
  };
}

/**
 * Looks up the rating class for a client based on their height and weight
 * using a carrier's build table.
 *
 * @param heightFeet - Client's height (feet component)
 * @param heightInches - Client's height (inches component, 0-11)
 * @param weightLbs - Client's weight in pounds
 * @param buildTable - The carrier's build table data
 * @returns The rating class and lookup metadata
 *
 * @example
 * const result = lookupBuildRating(5, 10, 195, carrierBuildTable);
 * // result.ratingClass = "standard_plus"
 * // result.hasTable = true
 */
export function lookupBuildRating(
  heightFeet: number,
  heightInches: number,
  weightLbs: number,
  buildTable: BuildTableData | null | undefined,
): BuildRatingLookupResult {
  // No build table = unknown rating
  if (!buildTable || buildTable.length === 0) {
    return {
      ratingClass: "unknown",
      hasTable: false,
    };
  }

  // Convert to total inches
  const totalHeightInches = feetAndInchesToInches(heightFeet, heightInches);

  // Find the row for this height
  const row = findRowForHeight(totalHeightInches, buildTable);
  if (!row) {
    return {
      ratingClass: "unknown",
      hasTable: true, // Table exists but no matching row (shouldn't happen)
    };
  }

  // Check if row has any weight data
  const hasAnyWeights =
    row.weightRanges.preferredPlus !== undefined ||
    row.weightRanges.preferred !== undefined ||
    row.weightRanges.standardPlus !== undefined ||
    row.weightRanges.standard !== undefined;

  if (!hasAnyWeights) {
    return {
      ratingClass: "unknown",
      hasTable: true,
    };
  }

  // Determine rating from weight vs thresholds
  return getRatingFromRow(weightLbs, row);
}

/**
 * Compares AI-predicted rating with build table rating
 * Returns true if they match or are within 1 tier
 */
export function ratingsMatch(
  aiRating: string,
  buildRating: BuildRatingClass,
): boolean {
  const normalizedAi = aiRating.toLowerCase().replace(/[\s_-]+/g, "_");

  // Exact match
  if (normalizedAi === buildRating) {
    return true;
  }

  const aiIndex = BUILD_RATING_CLASS_ORDER.indexOf(
    normalizedAi as BuildRatingClass,
  );
  const buildIndex = BUILD_RATING_CLASS_ORDER.indexOf(buildRating);

  // If either is not found, consider it not matching
  if (aiIndex === -1 || buildIndex === -1) {
    return false;
  }

  // Within 1 tier is considered a match
  return Math.abs(aiIndex - buildIndex) <= 1;
}

/**
 * Gets a user-friendly description of the rating comparison
 */
export function getRatingComparisonMessage(
  aiRating: string,
  buildRating: BuildRatingClass,
): string | null {
  if (buildRating === "unknown") {
    return null; // No build table configured
  }

  const matches = ratingsMatch(aiRating, buildRating);
  if (matches) {
    return null; // Ratings match, no message needed
  }

  // Determine which is more favorable
  const normalizedAi = aiRating.toLowerCase().replace(/[\s_-]+/g, "_");

  const aiIndex = BUILD_RATING_CLASS_ORDER.indexOf(
    normalizedAi as BuildRatingClass,
  );
  const buildIndex = BUILD_RATING_CLASS_ORDER.indexOf(buildRating);

  if (buildIndex > aiIndex) {
    return `Build table indicates ${buildRating.replace(/_/g, " ")} (less favorable than AI estimate)`;
  }
  return `Build table indicates ${buildRating.replace(/_/g, " ")} (more favorable than AI estimate)`;
}

/**
 * Gets the max weight that would achieve a target rating class for a given height
 * Useful for showing "lose X lbs to reach Preferred" messages
 */
export function getWeightForRating(
  heightFeet: number,
  heightInches: number,
  targetRating: BuildRatingClass,
  buildTable: BuildTableData | null | undefined,
): number | null {
  if (!buildTable || buildTable.length === 0) {
    return null;
  }

  const totalHeightInches = feetAndInchesToInches(heightFeet, heightInches);
  const row = findRowForHeight(totalHeightInches, buildTable);

  if (!row) {
    return null;
  }

  const { weightRanges } = row;

  switch (targetRating) {
    case "preferred_plus":
      return weightRanges.preferredPlus?.max ?? null;
    case "preferred":
      return weightRanges.preferred?.max ?? null;
    case "standard_plus":
      return weightRanges.standardPlus?.max ?? null;
    case "standard":
      return weightRanges.standard?.max ?? null;
    default:
      return null;
  }
}

/**
 * Weight guidance result for showing "X lbs to reach Y rating" messages
 */
export interface WeightGuidance {
  /** Current rating class based on weight */
  currentRating: BuildRatingClass;
  /** Next better rating class, or null if already at best */
  nextBetterRating: BuildRatingClass | null;
  /** Pounds to lose to reach next rating, null if already at best or data unavailable */
  weightToNextRating: number | null;
  /** Max weight allowed for next better rating class */
  maxWeightForNextRating: number | null;
}

/**
 * Gets actionable weight guidance for reaching a better rating class.
 * Shows how many pounds to lose to qualify for the next better tier.
 *
 * @param heightFeet - Client's height (feet component)
 * @param heightInches - Client's height (inches component, 0-11)
 * @param weightLbs - Client's weight in pounds
 * @param buildTable - The carrier's build table data
 * @returns Guidance object or null if no table exists
 *
 * @example
 * const guidance = getWeightGuidance(5, 10, 195, carrierBuildTable);
 * // guidance.currentRating = "standard_plus"
 * // guidance.nextBetterRating = "preferred"
 * // guidance.weightToNextRating = 12 (lbs to lose)
 */
export function getWeightGuidance(
  heightFeet: number,
  heightInches: number,
  weightLbs: number,
  buildTable: BuildTableData | null | undefined,
): WeightGuidance | null {
  // Get current rating
  const currentResult = lookupBuildRating(
    heightFeet,
    heightInches,
    weightLbs,
    buildTable,
  );

  if (!currentResult.hasTable || currentResult.ratingClass === "unknown") {
    return null;
  }

  // Already at best rating - no guidance needed
  if (currentResult.ratingClass === "preferred_plus") {
    return {
      currentRating: "preferred_plus",
      nextBetterRating: null,
      weightToNextRating: null,
      maxWeightForNextRating: null,
    };
  }

  const currentIndex = BUILD_RATING_CLASS_ORDER.indexOf(
    currentResult.ratingClass,
  );
  if (currentIndex <= 0) {
    return null; // At best or not found
  }

  // Find the next better rating class
  const nextBetterRating = BUILD_RATING_CLASS_ORDER[currentIndex - 1];
  const maxWeightForNext = getWeightForRating(
    heightFeet,
    heightInches,
    nextBetterRating,
    buildTable,
  );

  // If max weight for next tier isn't defined, still return what we know
  if (maxWeightForNext === null) {
    return {
      currentRating: currentResult.ratingClass,
      nextBetterRating,
      weightToNextRating: null,
      maxWeightForNextRating: null,
    };
  }

  // Calculate pounds to lose
  const weightToLose = weightLbs - maxWeightForNext;

  return {
    currentRating: currentResult.ratingClass,
    nextBetterRating,
    weightToNextRating: weightToLose > 0 ? weightToLose : null,
    maxWeightForNextRating: maxWeightForNext,
  };
}

// ============================================================================
// BMI-Based Lookup Functions
// ============================================================================

/**
 * Checks if a BMI falls within a BMI range
 */
function isInBmiRange(bmi: number, range: BmiRange | undefined): boolean {
  if (!range) return false;
  const min = range.min ?? 0;
  const max = range.max ?? Infinity;
  return bmi >= min && bmi <= max;
}

/**
 * Looks up the rating class based on BMI using a BMI table.
 * Compares the client's BMI against min/max BMI ranges for each rating class.
 *
 * @param heightFeet - Client's height (feet component)
 * @param heightInches - Client's height (inches component, 0-11)
 * @param weightLbs - Client's weight in pounds
 * @param bmiTable - The BMI table data with min/max BMI per rating class
 * @returns The rating class and lookup metadata
 *
 * @example
 * const result = lookupBmiRating(5, 10, 175, { preferredPlus: { max: 25 }, preferred: { min: 25.1, max: 28 }, ... });
 * // result.ratingClass = "preferred"
 */
export function lookupBmiRating(
  heightFeet: number,
  heightInches: number,
  weightLbs: number,
  bmiTable: BmiTableData | null | undefined,
): BuildRatingLookupResult {
  // No BMI table = unknown rating
  if (!bmiTable) {
    return {
      ratingClass: "unknown",
      hasTable: false,
    };
  }

  // Check if any BMI ranges are defined
  const hasAnyRanges =
    bmiTable.preferredPlus !== undefined ||
    bmiTable.preferred !== undefined ||
    bmiTable.standardPlus !== undefined ||
    bmiTable.standard !== undefined ||
    bmiTable.tableA !== undefined ||
    bmiTable.tableB !== undefined ||
    bmiTable.tableC !== undefined ||
    bmiTable.tableD !== undefined ||
    bmiTable.tableE !== undefined ||
    bmiTable.tableF !== undefined ||
    bmiTable.tableG !== undefined ||
    bmiTable.tableH !== undefined ||
    bmiTable.tableI !== undefined ||
    bmiTable.tableJ !== undefined ||
    bmiTable.tableK !== undefined ||
    bmiTable.tableL !== undefined ||
    bmiTable.tableM !== undefined ||
    bmiTable.tableN !== undefined ||
    bmiTable.tableO !== undefined ||
    bmiTable.tableP !== undefined;

  if (!hasAnyRanges) {
    return {
      ratingClass: "unknown",
      hasTable: true,
    };
  }

  // Calculate client's BMI
  const clientBmi = calculateBMI(heightFeet, heightInches, weightLbs);

  if (clientBmi <= 0) {
    return {
      ratingClass: "unknown",
      hasTable: true,
    };
  }

  // Check from best to worst rating class
  // BMI must fall within the min/max range for that class

  if (bmiTable.preferredPlus) {
    if (isInBmiRange(clientBmi, bmiTable.preferredPlus)) {
      return {
        ratingClass: "preferred_plus",
        hasTable: true,
      };
    }
  }

  if (bmiTable.preferred) {
    if (isInBmiRange(clientBmi, bmiTable.preferred)) {
      return {
        ratingClass: "preferred",
        hasTable: true,
        thresholdExceeded: bmiTable.preferredPlus?.max,
        thresholdClass: "preferred_plus",
      };
    }
  }

  if (bmiTable.standardPlus) {
    if (isInBmiRange(clientBmi, bmiTable.standardPlus)) {
      return {
        ratingClass: "standard_plus",
        hasTable: true,
        thresholdExceeded: bmiTable.preferred?.max,
        thresholdClass: "preferred",
      };
    }
  }

  if (bmiTable.standard) {
    if (isInBmiRange(clientBmi, bmiTable.standard)) {
      return {
        ratingClass: "standard",
        hasTable: true,
        thresholdExceeded: bmiTable.standardPlus?.max,
        thresholdClass: "standard_plus",
      };
    }
  }

  // Check table ratings A through P (substandard)
  const bmiTableKeys = [
    "tableA",
    "tableB",
    "tableC",
    "tableD",
    "tableE",
    "tableF",
    "tableG",
    "tableH",
    "tableI",
    "tableJ",
    "tableK",
    "tableL",
    "tableM",
    "tableN",
    "tableO",
    "tableP",
  ] as const;
  const bmiTableRatingClasses: Record<string, BuildRatingClass> = {
    tableA: "table_a",
    tableB: "table_b",
    tableC: "table_c",
    tableD: "table_d",
    tableE: "table_e",
    tableF: "table_f",
    tableG: "table_g",
    tableH: "table_h",
    tableI: "table_i",
    tableJ: "table_j",
    tableK: "table_k",
    tableL: "table_l",
    tableM: "table_m",
    tableN: "table_n",
    tableO: "table_o",
    tableP: "table_p",
  };

  let bmiPrevClass: BuildRatingClass = "standard";
  for (const key of bmiTableKeys) {
    const range = bmiTable[key];
    if (range) {
      if (isInBmiRange(clientBmi, range)) {
        return {
          ratingClass: bmiTableRatingClasses[key],
          hasTable: true,
          thresholdExceeded: bmiTable.standard?.max,
          thresholdClass: bmiPrevClass,
        };
      }
      bmiPrevClass = bmiTableRatingClasses[key];
    }
  }

  // BMI exceeds all defined thresholds = generic table rated
  return {
    ratingClass: "table_rated",
    hasTable: true,
    thresholdExceeded: bmiTable.standard?.max,
    thresholdClass: bmiPrevClass,
  };
}

// ============================================================================
// Unified Lookup Functions
// ============================================================================

/**
 * Unified build rating lookup that handles both height/weight and BMI tables.
 * Automatically selects the appropriate lookup method based on table type.
 *
 * @param heightFeet - Client's height (feet component)
 * @param heightInches - Client's height (inches component, 0-11)
 * @param weightLbs - Client's weight in pounds
 * @param tableType - Type of build table ("height_weight" or "bmi")
 * @param buildData - Height/weight table data (for height_weight type)
 * @param bmiData - BMI table data (for bmi type)
 * @returns The rating class and lookup metadata
 */
export function lookupBuildRatingUnified(
  heightFeet: number,
  heightInches: number,
  weightLbs: number,
  tableType: BuildTableType,
  buildData: BuildTableData | null | undefined,
  bmiData: BmiTableData | null | undefined,
): BuildRatingLookupResult {
  if (tableType === "bmi") {
    return lookupBmiRating(heightFeet, heightInches, weightLbs, bmiData);
  }

  // Default to height/weight lookup
  return lookupBuildRating(heightFeet, heightInches, weightLbs, buildData);
}

/**
 * BMI guidance result for showing "reduce BMI by X to reach Y rating" messages
 */
export interface BmiGuidance {
  /** Current rating class based on BMI */
  currentRating: BuildRatingClass;
  /** Current BMI value */
  currentBmi: number;
  /** Next better rating class, or null if already at best */
  nextBetterRating: BuildRatingClass | null;
  /** BMI reduction needed to reach next rating */
  bmiToNextRating: number | null;
  /** Max BMI allowed for next better rating class */
  maxBmiForNextRating: number | null;
}

/**
 * Gets actionable BMI guidance for reaching a better rating class.
 * Shows how much BMI reduction is needed to qualify for the next better tier.
 *
 * @param heightFeet - Client's height (feet component)
 * @param heightInches - Client's height (inches component, 0-11)
 * @param weightLbs - Client's weight in pounds
 * @param bmiTable - The BMI table data
 * @returns Guidance object or null if no table exists
 */
export function getBmiGuidance(
  heightFeet: number,
  heightInches: number,
  weightLbs: number,
  bmiTable: BmiTableData | null | undefined,
): BmiGuidance | null {
  // Get current rating
  const currentResult = lookupBmiRating(
    heightFeet,
    heightInches,
    weightLbs,
    bmiTable,
  );

  if (!currentResult.hasTable || currentResult.ratingClass === "unknown") {
    return null;
  }

  const currentBmi = calculateBMI(heightFeet, heightInches, weightLbs);

  // Already at best rating - no guidance needed
  if (currentResult.ratingClass === "preferred_plus") {
    return {
      currentRating: "preferred_plus",
      currentBmi,
      nextBetterRating: null,
      bmiToNextRating: null,
      maxBmiForNextRating: null,
    };
  }

  const currentIndex = BUILD_RATING_CLASS_ORDER.indexOf(
    currentResult.ratingClass,
  );
  if (currentIndex <= 0) {
    return null;
  }

  // Find the next better rating class
  const nextBetterRating = BUILD_RATING_CLASS_ORDER[currentIndex - 1];

  // Get max BMI for next rating
  let maxBmiForNext: number | undefined;
  switch (nextBetterRating) {
    case "preferred_plus":
      maxBmiForNext = bmiTable?.preferredPlus?.max;
      break;
    case "preferred":
      maxBmiForNext = bmiTable?.preferred?.max;
      break;
    case "standard_plus":
      maxBmiForNext = bmiTable?.standardPlus?.max;
      break;
    case "standard":
      maxBmiForNext = bmiTable?.standard?.max;
      break;
  }

  if (maxBmiForNext === undefined) {
    return {
      currentRating: currentResult.ratingClass,
      currentBmi,
      nextBetterRating,
      bmiToNextRating: null,
      maxBmiForNextRating: null,
    };
  }

  // Calculate BMI reduction needed
  const bmiReduction = currentBmi - maxBmiForNext;

  return {
    currentRating: currentResult.ratingClass,
    currentBmi,
    nextBetterRating,
    bmiToNextRating:
      bmiReduction > 0 ? Math.round(bmiReduction * 10) / 10 : null,
    maxBmiForNextRating: maxBmiForNext,
  };
}
