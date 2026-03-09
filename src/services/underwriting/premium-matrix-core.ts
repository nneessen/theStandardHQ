import type { Database } from "@/types/database.types.ts";

export type GenderType = "male" | "female";
export type TobaccoClass = "non_tobacco" | "tobacco" | "preferred_non_tobacco";
export type HealthClass =
  | "preferred_plus"
  | "preferred"
  | "standard"
  | "standard_plus"
  | "table_rated"
  | "graded"
  | "modified"
  | "guaranteed_issue";
export type TermYears = 10 | 15 | 20 | 25 | 30;

export type RateableHealthClass =
  | "preferred_plus"
  | "preferred"
  | "standard_plus"
  | "standard"
  | "table_rated";

export type PremiumLookupResult =
  | {
      premium: number;
      requested: RateableHealthClass;
      used: RateableHealthClass;
      wasExact: boolean;
      termYears: TermYears | null;
    }
  | {
      premium: null;
      reason:
        | "NO_MATRIX"
        | "NON_RATEABLE_CLASS"
        | "NO_MATCHING_RATES"
        | "OUT_OF_RANGE"
        | "INVALID_PREMIUM";
    };

export type PremiumMatrix =
  Database["public"]["Tables"]["premium_matrix"]["Row"] & {
    product?: {
      id: string;
      name: string;
      product_type: string;
      carrier_id: string;
    };
  };

export interface AlternativeQuote {
  faceAmount: number;
  monthlyPremium: number;
  costPerThousand: number;
}

export const HEALTH_CLASS_FALLBACK_ORDER: RateableHealthClass[] = [
  "preferred_plus",
  "preferred",
  "standard_plus",
  "standard",
  "table_rated",
];

export function normalizeHealthClass(
  healthClass: string,
): RateableHealthClass | null {
  switch (healthClass) {
    case "preferred_plus":
    case "preferred":
    case "standard_plus":
    case "standard":
      return healthClass;
    case "substandard":
    case "table_rated":
      return "table_rated";
    case "graded":
    case "modified":
    case "guaranteed_issue":
      return null;
    case "unknown":
      return "standard";
    case "decline":
    case "refer":
      return null;
    default:
      return "standard";
  }
}

function lerp(
  x: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number {
  if (x1 === x0) return y0;
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
}

function validatePremium(
  premium: number,
  maxMonthlyPremium: number = 100000,
): number | null {
  if (
    !Number.isFinite(premium) ||
    premium <= 0 ||
    premium > maxMonthlyPremium
  ) {
    return null;
  }

  return premium;
}

function findBounds(
  value: number,
  sortedValues: number[],
): { lower: number | null; upper: number | null } {
  if (sortedValues.length === 0) {
    return { lower: null, upper: null };
  }

  if (sortedValues.includes(value)) {
    return { lower: value, upper: value };
  }

  if (value < sortedValues[0]) {
    return { lower: null, upper: sortedValues[0] };
  }

  if (value > sortedValues[sortedValues.length - 1]) {
    return { lower: sortedValues[sortedValues.length - 1], upper: null };
  }

  let lower = sortedValues[0];
  let upper = sortedValues[sortedValues.length - 1];

  for (const candidate of sortedValues) {
    if (candidate <= value && candidate > lower) {
      lower = candidate;
    }
    if (candidate >= value && candidate < upper) {
      upper = candidate;
    }
  }

  return { lower, upper };
}

function tryInterpolatePremiumForClass(
  matrix: PremiumMatrix[],
  targetAge: number,
  targetFaceAmount: number,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: RateableHealthClass,
  termYears?: TermYears | null,
): number | null {
  const filtered = matrix.filter(
    (row) =>
      row.gender === gender &&
      row.tobacco_class === tobaccoClass &&
      row.health_class === healthClass &&
      (termYears ? row.term_years === termYears : row.term_years === null),
  );

  if (filtered.length === 0) {
    return null;
  }

  const lookup = new Map<string, number>();
  for (const row of filtered) {
    lookup.set(`${row.age}-${row.face_amount}`, Number(row.monthly_premium));
  }

  const ages = [...new Set(filtered.map((row) => row.age))].sort(
    (a, b) => a - b,
  );
  const faceAmounts = [...new Set(filtered.map((row) => row.face_amount))].sort(
    (a, b) => a - b,
  );

  if (
    targetAge < ages[0] ||
    targetAge > ages[ages.length - 1] ||
    targetFaceAmount < faceAmounts[0] ||
    targetFaceAmount > faceAmounts[faceAmounts.length - 1]
  ) {
    return null;
  }

  const exactKey = `${targetAge}-${targetFaceAmount}`;
  if (lookup.has(exactKey)) {
    return validatePremium(lookup.get(exactKey)!);
  }

  if (faceAmounts.length === 1) {
    const knownFaceAmount = faceAmounts[0];
    if (targetFaceAmount !== knownFaceAmount) {
      return null;
    }

    const ageBounds = findBounds(targetAge, ages);
    const ageLow = ageBounds.lower ?? ageBounds.upper;
    const ageHigh = ageBounds.upper ?? ageBounds.lower;

    if (ageLow === null || ageHigh === null) {
      return null;
    }

    const premiumLow = lookup.get(`${ageLow}-${knownFaceAmount}`);
    const premiumHigh = lookup.get(`${ageHigh}-${knownFaceAmount}`);

    if (premiumLow === undefined && premiumHigh === undefined) {
      return null;
    }

    if (
      premiumLow !== undefined &&
      premiumHigh !== undefined &&
      ageLow !== ageHigh
    ) {
      return validatePremium(
        lerp(targetAge, ageLow, ageHigh, premiumLow, premiumHigh),
      );
    }

    return validatePremium(premiumLow ?? premiumHigh!);
  }

  const ageBounds = findBounds(targetAge, ages);
  const faceBounds = findBounds(targetFaceAmount, faceAmounts);
  const ageLow = ageBounds.lower ?? ageBounds.upper;
  const ageHigh = ageBounds.upper ?? ageBounds.lower;
  const faceLow = faceBounds.lower ?? faceBounds.upper;
  const faceHigh = faceBounds.upper ?? faceBounds.lower;

  if (
    ageLow === null ||
    ageHigh === null ||
    faceLow === null ||
    faceHigh === null
  ) {
    return null;
  }

  const q11 = lookup.get(`${ageLow}-${faceLow}`);
  const q12 = lookup.get(`${ageLow}-${faceHigh}`);
  const q21 = lookup.get(`${ageHigh}-${faceLow}`);
  const q22 = lookup.get(`${ageHigh}-${faceHigh}`);
  const corners = [q11, q12, q21, q22].filter((value) => value !== undefined);

  if (corners.length < 2) {
    if (corners.length === 0) {
      return null;
    }

    return validatePremium(
      corners.reduce((a, b) => a + b!, 0) / corners.length,
    );
  }

  if (
    q11 !== undefined &&
    q12 !== undefined &&
    q21 !== undefined &&
    q22 !== undefined
  ) {
    const r1 = lerp(targetFaceAmount, faceLow, faceHigh, q11, q12);
    const r2 = lerp(targetFaceAmount, faceLow, faceHigh, q21, q22);
    return validatePremium(lerp(targetAge, ageLow, ageHigh, r1, r2));
  }

  if (q11 !== undefined && q12 !== undefined) {
    return validatePremium(lerp(targetFaceAmount, faceLow, faceHigh, q11, q12));
  }
  if (q21 !== undefined && q22 !== undefined) {
    return validatePremium(lerp(targetFaceAmount, faceLow, faceHigh, q21, q22));
  }
  if (q11 !== undefined && q21 !== undefined) {
    return validatePremium(lerp(targetAge, ageLow, ageHigh, q11, q21));
  }
  if (q12 !== undefined && q22 !== undefined) {
    return validatePremium(lerp(targetAge, ageLow, ageHigh, q12, q22));
  }

  return validatePremium(corners.reduce((a, b) => a + b!, 0) / corners.length);
}

export function interpolatePremium(
  matrix: PremiumMatrix[],
  targetAge: number,
  targetFaceAmount: number,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: string,
  termYears?: TermYears | null,
): PremiumLookupResult {
  if (matrix.length === 0) {
    return { premium: null, reason: "NO_MATRIX" };
  }

  const normalizedClass = normalizeHealthClass(healthClass);
  if (normalizedClass === null) {
    return { premium: null, reason: "NON_RATEABLE_CLASS" };
  }

  const startIndex = HEALTH_CLASS_FALLBACK_ORDER.indexOf(normalizedClass);
  const classesToTry = HEALTH_CLASS_FALLBACK_ORDER.slice(startIndex);

  for (const classToTry of classesToTry) {
    const premium = tryInterpolatePremiumForClass(
      matrix,
      targetAge,
      targetFaceAmount,
      gender,
      tobaccoClass,
      classToTry,
      termYears,
    );

    if (premium !== null) {
      return {
        premium,
        requested: normalizedClass,
        used: classToTry,
        wasExact: classToTry === normalizedClass,
        termYears: termYears ?? null,
      };
    }
  }

  return { premium: null, reason: "NO_MATCHING_RATES" };
}

export function getAvailableTermsForAge(
  matrix: PremiumMatrix[],
  age: number,
): number[] {
  const matrixAges = [...new Set(matrix.map((row) => row.age))].sort(
    (a, b) => a - b,
  );
  if (matrixAges.length === 0) {
    return [];
  }

  let lowerAge: number | null = null;
  let upperAge: number | null = null;

  for (const matrixAge of matrixAges) {
    if (matrixAge <= age) {
      lowerAge = matrixAge;
    }
    if (matrixAge >= age && upperAge === null) {
      upperAge = matrixAge;
    }
  }

  const getTermsAtAge = (targetAge: number): Set<number> => {
    const terms = new Set<number>();
    for (const row of matrix) {
      if (row.term_years !== null && row.age === targetAge) {
        terms.add(row.term_years);
      }
    }
    return terms;
  };

  if (lowerAge === age || upperAge === age) {
    const exactAge = lowerAge === age ? lowerAge : upperAge!;
    return Array.from(getTermsAtAge(exactAge)).sort((a, b) => a - b);
  }

  if (lowerAge !== null && upperAge !== null) {
    const lowerTerms = getTermsAtAge(lowerAge);
    const upperTerms = getTermsAtAge(upperAge);
    return Array.from(lowerTerms)
      .filter((term) => upperTerms.has(term))
      .sort((a, b) => a - b);
  }

  if (lowerAge !== null) {
    return Array.from(getTermsAtAge(lowerAge)).sort((a, b) => a - b);
  }
  if (upperAge !== null) {
    return Array.from(getTermsAtAge(upperAge)).sort((a, b) => a - b);
  }

  return [];
}

export function getAvailableRateClassesForQuote(
  matrix: PremiumMatrix[],
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  termYears?: TermYears | null,
): RateableHealthClass[] {
  const classes = new Set<RateableHealthClass>();

  for (const row of matrix) {
    if (row.gender !== gender || row.tobacco_class !== tobaccoClass) {
      continue;
    }

    if (termYears === null) {
      if (row.term_years !== null) continue;
    } else if (termYears !== undefined && row.term_years !== termYears) {
      continue;
    }

    const normalized = normalizeHealthClass(row.health_class);
    if (normalized) {
      classes.add(normalized);
    }
  }

  return HEALTH_CLASS_FALLBACK_ORDER.filter((healthClass) =>
    classes.has(healthClass),
  );
}

export function getLongestAvailableTermForAge(
  matrix: PremiumMatrix[],
  age: number,
): TermYears | null {
  const terms = getAvailableTermsForAge(matrix, age);
  if (terms.length === 0) {
    return null;
  }

  return terms[terms.length - 1] as TermYears;
}

export function calculateAlternativeQuotes(
  matrix: PremiumMatrix[],
  faceAmounts: number[],
  targetAge: number,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: string,
  termYears: TermYears | null,
): AlternativeQuote[] {
  const quotes: AlternativeQuote[] = [];

  for (const faceAmount of faceAmounts) {
    const result = interpolatePremium(
      matrix,
      targetAge,
      faceAmount,
      gender,
      tobaccoClass,
      healthClass,
      termYears,
    );

    if (result.premium === null) {
      continue;
    }

    const annualPremium = result.premium * 12;
    quotes.push({
      faceAmount,
      monthlyPremium: result.premium,
      costPerThousand:
        Math.round((annualPremium / (faceAmount / 1000)) * 100) / 100,
    });
  }

  return quotes;
}

export function getComparisonFaceAmounts(
  requestedFaceAmount: number,
  minFaceAmount?: number | null,
  maxFaceAmount?: number | null,
): number[] {
  const standardAmounts = [
    50000, 75000, 100000, 150000, 200000, 250000, 300000, 400000, 500000,
    750000, 1000000, 1500000, 2000000,
  ];
  const min = minFaceAmount ?? 50000;
  const max = maxFaceAmount ?? 10000000;
  const validAmounts = standardAmounts.filter(
    (amount) => amount >= min && amount <= max,
  );
  const lowerAmounts = validAmounts.filter(
    (amount) => amount < requestedFaceAmount,
  );
  const higherAmounts = validAmounts.filter(
    (amount) => amount > requestedFaceAmount,
  );
  const lower =
    lowerAmounts.length > 0 ? lowerAmounts[lowerAmounts.length - 1] : null;
  const higher = higherAmounts.length > 0 ? higherAmounts[0] : null;
  const result: number[] = [];

  if (lower !== null) result.push(lower);
  result.push(requestedFaceAmount);
  if (higher !== null) result.push(higher);

  if (result.length === 2) {
    if (lower === null && higherAmounts.length > 1) {
      result.push(higherAmounts[1]);
    } else if (higher === null && lowerAmounts.length > 1) {
      result.unshift(lowerAmounts[lowerAmounts.length - 2]);
    }
  }

  return result;
}
