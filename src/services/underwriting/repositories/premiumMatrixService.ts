// src/services/underwriting/premiumMatrixService.ts
// Service for managing premium matrix entries (age × face amount grid)
// Supports term_years for term life insurance products

import { supabase } from "@/services/base/supabase";
import type { Database } from "@/types/database.types";
import type { ProductUnderwritingConstraints } from "@/features/underwriting/types/product-constraints.types";

type PremiumMatrixRow = Database["public"]["Tables"]["premium_matrix"]["Row"];
type PremiumMatrixInsert =
  Database["public"]["Tables"]["premium_matrix"]["Insert"];

// =============================================================================
// Types
// =============================================================================

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

/**
 * Normalized health classes for premium quoting.
 * These are the only classes that can have rates in premium_matrix.
 * Matches HealthClass but explicitly named for quoting context.
 */
export type RateableHealthClass =
  | "preferred_plus"
  | "preferred"
  | "standard_plus"
  | "standard"
  | "table_rated";

/**
 * Non-rateable health classes that should not attempt premium lookup.
 * These require manual underwriting review.
 */
export type NonRateableHealthClass = "decline" | "refer";

/** Fallback order for rateable classes (best to worst) */
export const HEALTH_CLASS_FALLBACK_ORDER: RateableHealthClass[] = [
  "preferred_plus",
  "preferred",
  "standard_plus",
  "standard",
  "table_rated",
];

/**
 * Normalize DB/Stage2 health class to rateable class or null.
 * @param healthClass - Raw health class from database or Stage 2 approval
 * @returns Normalized rateable class, or null if non-rateable (decline, refer)
 */
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
    // Graded/modified/GI require their own rate tables —
    // return null so products without those rates show TBD instead of wrong rates
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

/**
 * Result of premium lookup with fallback information.
 */
export type PremiumLookupResult =
  | {
      premium: number;
      requested: RateableHealthClass;
      used: RateableHealthClass;
      wasExact: boolean;
      /** Term length in years used for the lookup (null for permanent products) */
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

export interface PremiumMatrix extends PremiumMatrixRow {
  product?: {
    id: string;
    name: string;
    product_type: string;
    carrier_id: string;
  };
}

// Extended type with full product and carrier info for Quick Quote
export interface PremiumMatrixWithCarrier extends PremiumMatrixRow {
  product: {
    id: string;
    name: string;
    product_type: string;
    carrier_id: string;
    min_age: number | null;
    max_age: number | null;
    min_face_amount: number | null;
    max_face_amount: number | null;
    is_active: boolean;
    metadata: ProductUnderwritingConstraints | null;
    carrier: {
      id: string;
      name: string;
    } | null;
  } | null;
}

export interface PremiumMatrixEntry {
  age: number;
  faceAmount: number;
  monthlyPremium: number;
}

export interface BulkPremiumEntry {
  productId: string;
  gender: GenderType;
  tobaccoClass: TobaccoClass;
  healthClass: HealthClass;
  termYears?: TermYears | null;
  entries: PremiumMatrixEntry[];
}

// =============================================================================
// Grid Dimensions
// =============================================================================

// Standard ages for the grid (5-year increments from 20 to 85)
export const GRID_AGES = [
  20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85,
] as const;

// Face amounts by product type
// Term Life: $50k to $500k in $10k increments
export const TERM_FACE_AMOUNTS = [
  50000, 60000, 70000, 80000, 90000, 100000, 110000, 120000, 130000, 140000,
  150000, 160000, 170000, 180000, 190000, 200000, 210000, 220000, 230000,
  240000, 250000, 260000, 270000, 280000, 290000, 300000, 310000, 320000,
  330000, 340000, 350000, 360000, 370000, 380000, 390000, 400000, 410000,
  420000, 430000, 440000, 450000, 460000, 470000, 480000, 490000, 500000,
] as const; // 46 columns

// Whole Life / Final Expense: $5k to $50k in $1k increments + outliers
export const WHOLE_LIFE_FACE_AMOUNTS = [
  5000,
  6000,
  7000,
  8000,
  9000,
  10000,
  11000,
  12000,
  13000,
  14000,
  15000,
  16000,
  17000,
  18000,
  19000,
  20000,
  21000,
  22000,
  23000,
  24000,
  25000,
  26000,
  27000,
  28000,
  29000,
  30000,
  31000,
  32000,
  33000,
  34000,
  35000,
  36000,
  37000,
  38000,
  39000,
  40000,
  41000,
  42000,
  43000,
  44000,
  45000,
  46000,
  47000,
  48000,
  49000,
  50000,
  75000,
  100000,
  125000,
  150000, // outliers at end
] as const; // 50 columns

// Participating Whole Life: 5k to 50k in 5k increments, then 75k to 300k in 25k increments
export const PARTICIPATING_WHOLE_LIFE_FACE_AMOUNTS = [
  5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 75000,
  100000, 125000, 150000, 175000, 200000, 225000, 250000, 275000, 300000,
] as const;

// Default face amounts (for backward compatibility)
export const GRID_FACE_AMOUNTS = TERM_FACE_AMOUNTS;

// =============================================================================
// Increment Configuration for UI
// =============================================================================

// Increment options for Whole Life products
export const WHOLE_LIFE_INCREMENT_OPTIONS = [
  { value: 1000, label: "$1k" },
  { value: 2500, label: "$2.5k" },
  { value: 5000, label: "$5k" },
] as const;

// Increment options for Term Life products
export const TERM_INCREMENT_OPTIONS = [
  { value: 10000, label: "$10k" },
  { value: 25000, label: "$25k" },
  { value: 50000, label: "$50k" },
] as const;

// Face amount ranges by product type
export const FACE_AMOUNT_RANGES = {
  whole_life: {
    min: 5000,
    max: 50000,
    outliers: [75000, 100000, 125000, 150000],
    defaultIncrement: 1000,
  },
  final_expense: {
    min: 5000,
    max: 50000,
    outliers: [75000, 100000, 125000, 150000],
    defaultIncrement: 1000,
  },
  term_life: { min: 50000, max: 500000, outliers: [], defaultIncrement: 10000 },
  participating_whole_life: {
    min: 5000,
    max: 300000,
    outliers: [],
    defaultIncrement: 5000,
  },
} as const;

/**
 * Generate face amounts for a given range and increment.
 * Includes outliers that are beyond the max value.
 */
export function generateFaceAmounts(
  min: number,
  max: number,
  increment: number,
  outliers: readonly number[] = [],
): number[] {
  const amounts: number[] = [];
  for (let amt = min; amt <= max; amt += increment) {
    amounts.push(amt);
  }
  // Add outliers that are beyond max
  for (const outlier of outliers) {
    if (outlier > max && !amounts.includes(outlier)) {
      amounts.push(outlier);
    }
  }
  return amounts;
}

/**
 * Get increment options for a product type.
 */
export function getIncrementOptionsForProductType(
  productType: string,
): readonly { value: number; label: string }[] {
  switch (productType) {
    case "whole_life":
    case "final_expense":
    case "participating_whole_life":
      return WHOLE_LIFE_INCREMENT_OPTIONS;
    case "term_life":
    default:
      return TERM_INCREMENT_OPTIONS;
  }
}

/**
 * Get the default increment for a product type.
 */
export function getDefaultIncrementForProductType(productType: string): number {
  const range =
    FACE_AMOUNT_RANGES[productType as keyof typeof FACE_AMOUNT_RANGES];
  return range?.defaultIncrement ?? 10000;
}

/**
 * Get the face amount range for a product type.
 */
export function getFaceAmountRangeForProductType(productType: string): {
  min: number;
  max: number;
  outliers: readonly number[];
} {
  const range =
    FACE_AMOUNT_RANGES[productType as keyof typeof FACE_AMOUNT_RANGES];
  return range ?? { min: 50000, max: 500000, outliers: [] };
}

// Get face amounts based on product type
export function getFaceAmountsForProductType(
  productType: string,
): readonly number[] {
  switch (productType) {
    case "whole_life":
    case "final_expense":
      return WHOLE_LIFE_FACE_AMOUNTS;
    case "participating_whole_life":
      return PARTICIPATING_WHOLE_LIFE_FACE_AMOUNTS;
    case "term_life":
    default:
      return TERM_FACE_AMOUNTS;
  }
}

// Standard term lengths
export const TERM_OPTIONS: { value: TermYears; label: string }[] = [
  { value: 10, label: "10 Year" },
  { value: 15, label: "15 Year" },
  { value: 20, label: "20 Year" },
  { value: 25, label: "25 Year" },
  { value: 30, label: "30 Year" },
];

// Format face amount for display
export function formatFaceAmount(amount: number): string {
  if (amount >= 1000000) {
    return `$${amount / 1000000}M`;
  }
  return `$${amount / 1000}k`;
}

// UI options
export const GENDER_OPTIONS: { value: GenderType; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export const TOBACCO_OPTIONS: { value: TobaccoClass; label: string }[] = [
  { value: "non_tobacco", label: "Non-Tobacco" },
  { value: "tobacco", label: "Tobacco" },
  { value: "preferred_non_tobacco", label: "Preferred Non-Tobacco" },
];

export const HEALTH_CLASS_OPTIONS: { value: HealthClass; label: string }[] = [
  { value: "preferred_plus", label: "Preferred Plus" },
  { value: "preferred", label: "Preferred" },
  { value: "standard_plus", label: "Standard Plus" },
  { value: "standard", label: "Standard" },
  { value: "table_rated", label: "Table Rated" },
];

// =============================================================================
// Fetch Functions
// =============================================================================

/**
 * Get all premium matrix entries for a product.
 * Uses pagination to bypass PostgREST's 1000 row default limit.
 */
export async function getPremiumMatrixForProduct(
  productId: string,
  imoId: string,
): Promise<PremiumMatrix[]> {
  const PAGE_SIZE = 1000;

  // OPTIMIZATION: Skip count query - fetch data directly and check if pagination needed
  // This eliminates one DB round-trip per product (~30-50ms savings each)
  const { data, error } = await supabase
    .from("premium_matrix")
    .select(
      `
      *,
      product:products(id, name, product_type, carrier_id)
    `,
    )
    .eq("product_id", productId)
    .eq("imo_id", imoId)
    .order("age", { ascending: true })
    .order("face_amount", { ascending: true })
    .limit(PAGE_SIZE);

  if (error) {
    console.error("Error fetching premium matrix:", error);
    throw new Error(`Failed to fetch premium matrix: ${error.message}`);
  }

  // If we got fewer than PAGE_SIZE rows, we have all the data
  if (!data || data.length < PAGE_SIZE) {
    const result = (data || []) as PremiumMatrix[];
    logPremiumMatrixDebug(result, productId, imoId);
    return result;
  }

  // If we hit the limit, we need to paginate - fetch remaining pages in parallel
  // First, get the actual count to know how many pages we need
  const { count, error: countError } = await supabase
    .from("premium_matrix")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId)
    .eq("imo_id", imoId);

  if (countError) {
    console.error("Error counting premium matrix:", countError);
    // Fall back to returning what we have
    const result = data as PremiumMatrix[];
    logPremiumMatrixDebug(result, productId, imoId);
    return result;
  }

  const totalRows = count || data.length;
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);

  // We already have page 0, fetch the rest in parallel
  const remainingPagePromises = Array.from({ length: totalPages - 1 }, (_, i) =>
    supabase
      .from("premium_matrix")
      .select(
        `
        *,
        product:products(id, name, product_type, carrier_id)
      `,
      )
      .eq("product_id", productId)
      .eq("imo_id", imoId)
      .order("age", { ascending: true })
      .order("face_amount", { ascending: true })
      .range((i + 1) * PAGE_SIZE, (i + 2) * PAGE_SIZE - 1),
  );

  const remainingResults = await Promise.all(remainingPagePromises);

  // Check for errors in any page
  for (let i = 0; i < remainingResults.length; i++) {
    if (remainingResults[i].error) {
      console.error(
        `Error fetching premium matrix page ${i + 1}:`,
        remainingResults[i].error,
      );
      throw new Error(
        `Failed to fetch premium matrix: ${remainingResults[i].error!.message}`,
      );
    }
  }

  // Combine first page with remaining pages
  const allData = [
    ...data,
    ...remainingResults.flatMap((result) => result.data || []),
  ];
  const result = allData as PremiumMatrix[];

  logPremiumMatrixDebug(result, productId, imoId);
  return result;
}

// Helper function for debug logging
function logPremiumMatrixDebug(
  result: PremiumMatrix[],
  productId: string,
  imoId: string,
): void {
  if (result.length === 0) {
    console.warn(
      `[PremiumMatrix] NO DATA for product ${productId} + imo ${imoId}`,
    );
  } else {
    const uniqueGenders = [...new Set(result.map((r) => r.gender))];
    const uniqueHealthClasses = [...new Set(result.map((r) => r.health_class))];
    const uniqueTobaccoClasses = [
      ...new Set(result.map((r) => r.tobacco_class)),
    ];
    const uniqueAges = [...new Set(result.map((r) => r.age))].sort(
      (a, b) => a - b,
    );
    const uniqueFaceAmounts = [
      ...new Set(result.map((r) => r.face_amount)),
    ].sort((a, b) => a - b);
    console.log(`[PremiumMatrix] Found ${result.length} rows for product`, {
      productId,
      imoId,
      genders: uniqueGenders,
      healthClasses: uniqueHealthClasses,
      tobaccoClasses: uniqueTobaccoClasses,
      ageRange: `${Math.min(...uniqueAges)}-${Math.max(...uniqueAges)}`,
      faceAmounts: uniqueFaceAmounts,
    });
  }
}

/**
 * Get premium matrix entries for a specific classification
 * For term products, pass termYears; for non-term products, pass null/undefined
 */
export async function getPremiumMatrixForClassification(
  productId: string,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: HealthClass,
  imoId: string,
  termYears?: TermYears | null,
): Promise<PremiumMatrix[]> {
  let query = supabase
    .from("premium_matrix")
    .select("*")
    .eq("product_id", productId)
    .eq("gender", gender)
    .eq("tobacco_class", tobaccoClass)
    .eq("health_class", healthClass)
    .eq("imo_id", imoId);

  // Filter by term_years (null for non-term products)
  if (termYears) {
    query = query.eq("term_years", termYears);
  } else {
    query = query.is("term_years", null);
  }

  const { data, error } = await query
    .order("age", { ascending: true })
    .order("face_amount", { ascending: true });

  if (error) {
    console.error("Error fetching premium matrix:", error);
    throw new Error(`Failed to fetch premium matrix: ${error.message}`);
  }

  return (data || []) as PremiumMatrix[];
}

/**
 * Get products that have premium matrix entries
 */
export async function getProductsWithPremiumMatrix(
  imoId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("premium_matrix")
    .select("product_id")
    .eq("imo_id", imoId);

  if (error) {
    console.error("Error fetching products with premium matrix:", error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return [...new Set((data || []).map((r) => r.product_id))];
}

/**
 * Get available term years for a product (for term products only)
 */
export async function getTermYearsForProduct(
  productId: string,
  imoId: string,
): Promise<TermYears[]> {
  const { data, error } = await supabase
    .from("premium_matrix")
    .select("term_years")
    .eq("product_id", productId)
    .eq("imo_id", imoId)
    .not("term_years", "is", null);

  if (error) {
    console.error("Error fetching term years:", error);
    return [];
  }

  const termYears = [
    ...new Set((data || []).map((r) => r.term_years as TermYears)),
  ];
  return termYears.sort((a, b) => a - b);
}

/**
 * Get ALL premium matrix entries for an IMO (batch fetch for Quick Quote).
 * Uses native SQL pagination (p_limit/p_offset) so each RPC call only
 * generates its own page of rows instead of the full 47K-row result set.
 */
export async function getAllPremiumMatricesForIMO(
  imoId: string,
): Promise<PremiumMatrixWithCarrier[]> {
  const PAGE_SIZE = 1000;

  // Step 1: Get total count
  const { count, error: countError } = await supabase
    .from("premium_matrix")
    .select("*", { count: "exact", head: true })
    .eq("imo_id", imoId);

  if (countError) {
    console.error("Error counting premium matrices:", countError);
    throw new Error(`Failed to count premium matrices: ${countError.message}`);
  }

  const totalRows = count || 0;

  if (totalRows === 0) {
    return [];
  }

  // Step 2: Single fetch for small datasets
  if (totalRows <= PAGE_SIZE) {
    const { data, error } = await supabase.rpc("get_premium_matrices_for_imo", {
      p_imo_id: imoId,
      p_limit: PAGE_SIZE,
      p_offset: 0,
    });

    if (error) {
      console.error("Error fetching premium matrices via RPC:", error);
      throw new Error(`Failed to fetch premium matrices: ${error.message}`);
    }

    return transformRPCResults(data || []);
  }

  // Step 3: Parallel pagination with native SQL LIMIT/OFFSET
  const totalPages = Math.ceil(totalRows / PAGE_SIZE);
  const pagePromises = Array.from({ length: totalPages }, (_, pageIndex) =>
    supabase.rpc("get_premium_matrices_for_imo", {
      p_imo_id: imoId,
      p_limit: PAGE_SIZE,
      p_offset: pageIndex * PAGE_SIZE,
    }),
  );

  const results = await Promise.all(pagePromises);

  for (let i = 0; i < results.length; i++) {
    if (results[i].error) {
      console.error(`Error fetching page ${i}:`, results[i].error);
      throw new Error(
        `Failed to fetch premium matrices: ${results[i].error!.message}`,
      );
    }
  }

  const allData = results.flatMap((result) => result.data || []);

  return transformRPCResults(allData);
}

// Helper function to transform flat RPC results to nested structure
function transformRPCResults(
  data: PremiumMatrixRPCRow[],
): PremiumMatrixWithCarrier[] {
  return data.map((row) => ({
    id: row.id,
    imo_id: row.imo_id,
    product_id: row.product_id,
    age: row.age,
    face_amount: row.face_amount,
    gender: row.gender as GenderType,
    tobacco_class: row.tobacco_class as TobaccoClass,
    health_class: row.health_class as HealthClass,
    term_years: row.term_years,
    monthly_premium: row.monthly_premium,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
    product: {
      id: row.product_id,
      name: row.product_name,
      product_type: row.product_type,
      carrier_id: row.carrier_id,
      min_age: row.min_age,
      max_age: row.max_age,
      min_face_amount: row.min_face_amount,
      max_face_amount: row.max_face_amount,
      is_active: row.is_active,
      metadata: row.product_metadata,
      carrier: row.carrier_name
        ? { id: row.carrier_id, name: row.carrier_name }
        : null,
    },
  }));
}

// Type for RPC response (flat structure from get_premium_matrices_for_imo)
interface PremiumMatrixRPCRow {
  id: string;
  imo_id: string;
  product_id: string;
  age: number;
  face_amount: number;
  gender: string;
  tobacco_class: string;
  health_class: string;
  term_years: number | null;
  monthly_premium: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  product_name: string;
  product_type: string;
  carrier_id: string;
  min_age: number | null;
  max_age: number | null;
  min_face_amount: number | null;
  max_face_amount: number | null;
  is_active: boolean;
  product_metadata: ProductUnderwritingConstraints | null;
  carrier_name: string | null;
}

// =============================================================================
// Mutation Functions
// =============================================================================

/**
 * Bulk upsert premium matrix entries for a classification
 */
export async function bulkUpsertPremiumMatrix(
  input: BulkPremiumEntry,
  imoId: string,
  userId: string,
): Promise<{ saved: number }> {
  // Delete existing entries for this classification first, then insert
  // This avoids issues with the COALESCE-based unique index
  let deleteQuery = supabase
    .from("premium_matrix")
    .delete()
    .eq("product_id", input.productId)
    .eq("gender", input.gender)
    .eq("tobacco_class", input.tobaccoClass)
    .eq("health_class", input.healthClass)
    .eq("imo_id", imoId);

  // Filter by term_years (NULL for non-term, specific value for term)
  if (input.termYears) {
    deleteQuery = deleteQuery.eq("term_years", input.termYears);
  } else {
    deleteQuery = deleteQuery.is("term_years", null);
  }

  // Only delete the specific age/face_amount combinations we're inserting
  const ageValues = [...new Set(input.entries.map((e) => e.age))];
  const faceValues = [...new Set(input.entries.map((e) => e.faceAmount))];
  deleteQuery = deleteQuery.in("age", ageValues).in("face_amount", faceValues);

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    console.error(
      "Error deleting existing premium matrix entries:",
      deleteError,
    );
    // Don't throw - continue with insert, it will fail if there's a real issue
  }

  // Insert the new entries
  const insertData: PremiumMatrixInsert[] = input.entries.map((entry) => ({
    product_id: input.productId,
    age: entry.age,
    face_amount: entry.faceAmount,
    gender: input.gender,
    tobacco_class: input.tobaccoClass,
    health_class: input.healthClass,
    term_years: input.termYears ?? null,
    monthly_premium: entry.monthlyPremium,
    imo_id: imoId,
    created_by: userId,
  }));

  const { data, error } = await supabase
    .from("premium_matrix")
    .insert(insertData)
    .select();

  if (error) {
    console.error("Error inserting premium matrix:", error);
    throw new Error(`Failed to save premium matrix: ${error.message}`);
  }

  return { saved: data?.length || 0 };
}

/**
 * Delete a single premium matrix entry
 */
export async function deletePremiumMatrixEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from("premium_matrix")
    .delete()
    .eq("id", entryId);

  if (error) {
    console.error("Error deleting premium matrix entry:", error);
    throw new Error(`Failed to delete entry: ${error.message}`);
  }
}

/**
 * Delete all premium matrix entries for a product
 */
export async function deletePremiumMatrixForProduct(
  productId: string,
  imoId: string,
): Promise<void> {
  const { error } = await supabase
    .from("premium_matrix")
    .delete()
    .eq("product_id", productId)
    .eq("imo_id", imoId);

  if (error) {
    console.error("Error deleting premium matrix:", error);
    throw new Error(`Failed to delete premium matrix: ${error.message}`);
  }
}

/**
 * Delete premium matrix entries for a specific term
 */
export async function deletePremiumMatrixForTerm(
  productId: string,
  termYears: TermYears,
  imoId: string,
): Promise<void> {
  const { error } = await supabase
    .from("premium_matrix")
    .delete()
    .eq("product_id", productId)
    .eq("term_years", termYears)
    .eq("imo_id", imoId);

  if (error) {
    console.error("Error deleting premium matrix for term:", error);
    throw new Error(`Failed to delete premium matrix: ${error.message}`);
  }
}

// =============================================================================
// Interpolation Functions
// =============================================================================

/**
 * Linear interpolation between two points
 */
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

/**
 * Validate a computed premium value.
 * Returns the premium if valid, null if invalid (NaN, Infinity, negative, unreasonably high).
 *
 * @param premium - The computed premium value
 * @param maxMonthlyPremium - Maximum reasonable monthly premium (default $100,000)
 * @returns The premium if valid, null otherwise
 */
function validatePremium(
  premium: number,
  maxMonthlyPremium: number = 100000,
): number | null {
  if (!Number.isFinite(premium)) {
    console.warn(
      `[InterpolatePremium] Invalid premium computed: ${premium} (not finite)`,
    );
    return null;
  }
  if (premium <= 0) {
    console.warn(
      `[InterpolatePremium] Non-positive premium computed: ${premium}`,
    );
    return null;
  }
  if (premium > maxMonthlyPremium) {
    console.warn(
      `[InterpolatePremium] Premium exceeds guardrail: $${premium} > $${maxMonthlyPremium}`,
    );
    return null;
  }
  return premium;
}

/**
 * Find the nearest lower and upper values in a sorted array
 */
function findBounds(
  value: number,
  sortedValues: number[],
): { lower: number | null; upper: number | null } {
  if (sortedValues.length === 0) {
    return { lower: null, upper: null };
  }

  // Exact match
  if (sortedValues.includes(value)) {
    return { lower: value, upper: value };
  }

  // Below minimum
  if (value < sortedValues[0]) {
    return { lower: null, upper: sortedValues[0] };
  }

  // Above maximum
  if (value > sortedValues[sortedValues.length - 1]) {
    return { lower: sortedValues[sortedValues.length - 1], upper: null };
  }

  // Find bracketing values
  let lower = sortedValues[0];
  let upper = sortedValues[sortedValues.length - 1];

  for (const v of sortedValues) {
    if (v <= value && v > lower) {
      lower = v;
    }
    if (v >= value && v < upper) {
      upper = v;
    }
  }

  return { lower, upper };
}

/**
 * Internal helper: Try to interpolate premium for a specific health class.
 * Returns the premium or null if no matching data exists.
 */
function tryInterpolatePremiumForClass(
  matrix: PremiumMatrix[],
  targetAge: number,
  targetFaceAmount: number,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: RateableHealthClass,
  termYears?: TermYears | null,
): number | null {
  // Filter to matching classification (including term_years)
  const filtered = matrix.filter(
    (m) =>
      m.gender === gender &&
      m.tobacco_class === tobaccoClass &&
      m.health_class === healthClass &&
      (termYears ? m.term_years === termYears : m.term_years === null),
  );

  // Debug: Log filter results for first few classes tried
  if (filtered.length === 0) {
    // Check what we DO have for this classification
    const matchingGenderTobacco = matrix.filter(
      (m) => m.gender === gender && m.tobacco_class === tobaccoClass,
    );
    const healthClassesInMatrix = [
      ...new Set(matchingGenderTobacco.map((m) => m.health_class)),
    ];
    const termYearsInMatrix = [
      ...new Set(matchingGenderTobacco.map((m) => m.term_years)),
    ];

    console.log(
      `[InterpolatePremium] No match for health_class="${healthClass}":`,
      {
        lookingFor: { gender, tobaccoClass, healthClass, termYears },
        availableHealthClasses: healthClassesInMatrix,
        availableTermYears: termYearsInMatrix,
        totalMatchingGenderTobacco: matchingGenderTobacco.length,
      },
    );
    return null; // Will try next health class in fallback
  }

  // Build lookup map
  const lookup = new Map<string, number>();
  for (const m of filtered) {
    lookup.set(`${m.age}-${m.face_amount}`, Number(m.monthly_premium));
  }

  // Get unique sorted ages and face amounts
  const ages = [...new Set(filtered.map((m) => m.age))].sort((a, b) => a - b);
  const faceAmounts = [...new Set(filtered.map((m) => m.face_amount))].sort(
    (a, b) => a - b,
  );

  // ==========================================================================
  // FIX 1: STRICT BOUNDS CHECKING
  // Reject out-of-range requests instead of silently clamping to boundary values.
  // This prevents "fake rates" for age/face amounts not actually in the matrix.
  // ==========================================================================
  const minAge = ages[0];
  const maxAge = ages[ages.length - 1];
  const minFaceAmount = faceAmounts[0];
  const maxFaceAmount = faceAmounts[faceAmounts.length - 1];

  if (targetAge < minAge || targetAge > maxAge) {
    console.warn(
      `[InterpolatePremium] Age ${targetAge} out of matrix range [${minAge}-${maxAge}] for health_class="${healthClass}"`,
    );
    return null;
  }

  if (targetFaceAmount < minFaceAmount || targetFaceAmount > maxFaceAmount) {
    console.warn(
      `[InterpolatePremium] Face $${targetFaceAmount} out of matrix range [$${minFaceAmount}-$${maxFaceAmount}] for health_class="${healthClass}"`,
    );
    return null;
  }

  // Exact match
  const exactKey = `${targetAge}-${targetFaceAmount}`;
  if (lookup.has(exactKey)) {
    const exactPremium = lookup.get(exactKey)!;
    return validatePremium(exactPremium);
  }

  // ==========================================================================
  // FIX 2: SINGLE-FACE-AMOUNT SAFETY GATE
  // When matrix has only one face amount, require EXACT MATCH only.
  // Linear rate-per-thousand scaling is DISABLED by default as it can produce
  // fake premiums for face amounts the carrier hasn't actually approved.
  // ==========================================================================
  if (faceAmounts.length === 1) {
    const knownFaceAmount = faceAmounts[0];

    // SAFETY: Only allow exact face amount match for single-face matrices
    if (targetFaceAmount !== knownFaceAmount) {
      console.warn(
        `[InterpolatePremium] Single-face matrix ($${knownFaceAmount}), requested $${targetFaceAmount}. ` +
          `Exact match required - linear scaling disabled for safety.`,
      );
      return null;
    }

    // Face amount matches exactly, only interpolate by age
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

    // Get the premium at target age (interpolate if needed)
    let premiumAtKnownFace: number;
    if (
      premiumLow !== undefined &&
      premiumHigh !== undefined &&
      ageLow !== ageHigh
    ) {
      // Interpolate between ages
      premiumAtKnownFace = lerp(
        targetAge,
        ageLow,
        ageHigh,
        premiumLow,
        premiumHigh,
      );
    } else {
      // Use the available premium
      premiumAtKnownFace = premiumLow ?? premiumHigh!;
    }

    return validatePremium(premiumAtKnownFace);
  }

  // Find bounds
  const ageBounds = findBounds(targetAge, ages);
  const faceBounds = findBounds(targetFaceAmount, faceAmounts);

  // Need at least some data points
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

  // Get the four corner values (some may be the same for boundary cases)
  const q11 = lookup.get(`${ageLow}-${faceLow}`);
  const q12 = lookup.get(`${ageLow}-${faceHigh}`);
  const q21 = lookup.get(`${ageHigh}-${faceLow}`);
  const q22 = lookup.get(`${ageHigh}-${faceHigh}`);

  // Need at least two corners for interpolation
  const corners = [q11, q12, q21, q22].filter((v) => v !== undefined);
  if (corners.length < 2) {
    // Return average of available corners (with validation)
    if (corners.length > 0) {
      const avgPremium = corners.reduce((a, b) => a + b!, 0) / corners.length;
      return validatePremium(avgPremium);
    }
    return null;
  }

  // If all four corners exist, do bilinear interpolation
  if (
    q11 !== undefined &&
    q12 !== undefined &&
    q21 !== undefined &&
    q22 !== undefined
  ) {
    // Interpolate along face amount for both ages
    const r1 = lerp(targetFaceAmount, faceLow, faceHigh, q11, q12);
    const r2 = lerp(targetFaceAmount, faceLow, faceHigh, q21, q22);
    // Interpolate along age
    const bilinearPremium = lerp(targetAge, ageLow, ageHigh, r1, r2);
    return validatePremium(bilinearPremium);
  }

  // Partial interpolation - use available corners
  // If we have same-age corners, interpolate along face amount
  if (q11 !== undefined && q12 !== undefined) {
    return validatePremium(lerp(targetFaceAmount, faceLow, faceHigh, q11, q12));
  }
  if (q21 !== undefined && q22 !== undefined) {
    return validatePremium(lerp(targetFaceAmount, faceLow, faceHigh, q21, q22));
  }

  // If we have same-face corners, interpolate along age
  if (q11 !== undefined && q21 !== undefined) {
    return validatePremium(lerp(targetAge, ageLow, ageHigh, q11, q21));
  }
  if (q12 !== undefined && q22 !== undefined) {
    return validatePremium(lerp(targetAge, ageLow, ageHigh, q12, q22));
  }

  // Fallback: average of available corners (with validation)
  const fallbackPremium = corners.reduce((a, b) => a + b!, 0) / corners.length;
  return validatePremium(fallbackPremium);
}

/**
 * Estimate monthly premium using bilinear interpolation with health class fallback.
 *
 * Normalizes the input health class and tries fallback classes if the exact class
 * has no rates. For non-rateable classes (decline, refer), returns null immediately.
 *
 * @param matrix - The premium matrix data
 * @param targetAge - Client age
 * @param targetFaceAmount - Requested face amount
 * @param gender - Client gender
 * @param tobaccoClass - Tobacco classification
 * @param healthClass - Raw health class from DB/Stage2 (will be normalized)
 * @param termYears - Term length for term products, null for permanent
 * @returns PremiumLookupResult with premium and metadata, or null reason
 */
export function interpolatePremium(
  matrix: PremiumMatrix[],
  targetAge: number,
  targetFaceAmount: number,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: string,
  termYears?: TermYears | null,
): PremiumLookupResult {
  // Handle empty matrix case
  if (!matrix || matrix.length === 0) {
    return { premium: null, reason: "NO_MATRIX" };
  }

  // Normalize the health class
  const normalizedClass = normalizeHealthClass(healthClass);

  // Non-rateable classes (decline, refer) should not attempt premium lookup
  if (normalizedClass === null) {
    console.log(
      `[InterpolatePremium] Non-rateable health class: ${healthClass}`,
    );
    return { premium: null, reason: "NON_RATEABLE_CLASS" };
  }

  // Get fallback order starting from the normalized class
  const startIndex = HEALTH_CLASS_FALLBACK_ORDER.indexOf(normalizedClass);
  const classesToTry = HEALTH_CLASS_FALLBACK_ORDER.slice(startIndex);

  // Try each health class from requested down to table_rated
  for (const tryClass of classesToTry) {
    const result = tryInterpolatePremiumForClass(
      matrix,
      targetAge,
      targetFaceAmount,
      gender,
      tobaccoClass,
      tryClass,
      termYears,
    );

    if (result !== null) {
      const wasExact = tryClass === normalizedClass;

      if (!wasExact) {
        console.log(
          `[InterpolatePremium] Fallback: ${normalizedClass} → ${tryClass}`,
        );
      }

      return {
        premium: result,
        requested: normalizedClass,
        used: tryClass,
        wasExact,
        termYears: termYears ?? null,
      };
    }
  }

  // No rates found for any health class - log debug info
  const matrixGenders = [...new Set(matrix.map((m) => m.gender))];
  const matrixTobacco = [...new Set(matrix.map((m) => m.tobacco_class))];
  const matrixHealth = [...new Set(matrix.map((m) => m.health_class))];
  const matrixTerms = [...new Set(matrix.map((m) => m.term_years))];

  console.warn(`[InterpolatePremium] No rates found after fallback`, {
    totalMatrixRows: matrix.length,
    requested: {
      gender,
      tobaccoClass,
      healthClass: normalizedClass,
      termYears,
    },
    triedClasses: classesToTry,
    available: {
      genders: matrixGenders,
      tobaccoClasses: matrixTobacco,
      healthClasses: matrixHealth,
      termYears: matrixTerms,
    },
  });

  return { premium: null, reason: "NO_MATCHING_RATES" };
}

/**
 * Get exact premium from matrix (no interpolation)
 */
export function getExactPremium(
  matrix: PremiumMatrix[],
  age: number,
  faceAmount: number,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: HealthClass,
  termYears?: TermYears | null,
): number | null {
  const match = matrix.find(
    (m) =>
      m.age === age &&
      m.face_amount === faceAmount &&
      m.gender === gender &&
      m.tobacco_class === tobaccoClass &&
      m.health_class === healthClass &&
      (termYears ? m.term_years === termYears : m.term_years === null),
  );

  return match ? Number(match.monthly_premium) : null;
}

/**
 * Get available term years from a premium matrix.
 * Returns sorted array of unique term years (excludes null for permanent products).
 */
export function getAvailableTerms(matrix: PremiumMatrix[]): number[] {
  const terms = new Set<number>();
  for (const row of matrix) {
    if (row.term_years !== null) {
      terms.add(row.term_years);
    }
  }
  return Array.from(terms).sort((a, b) => a - b);
}

/**
 * Get available term years from a premium matrix for a specific age.
 * Handles sparse age data by finding terms available at bracketing ages.
 *
 * A term is considered available if it exists at BOTH the lower and upper
 * bounding ages in the matrix. This prevents showing terms that would
 * require extrapolation beyond available data.
 *
 * For example, if matrix has ages 50 and 55:
 * - Age 50 has terms: 10, 15, 20, 25, 30
 * - Age 55 has terms: 10, 15, 20, 25
 * - For target age 53, available terms are: 10, 15, 20, 25 (intersection)
 *   because 30yr doesn't exist at the upper bound (age 55)
 */
export function getAvailableTermsForAge(
  matrix: PremiumMatrix[],
  age: number,
): number[] {
  // Get all unique ages in the matrix
  const matrixAges = [...new Set(matrix.map((m) => m.age))].sort(
    (a, b) => a - b,
  );

  if (matrixAges.length === 0) {
    return [];
  }

  // Find bracketing ages
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

  // Get terms at each bounding age
  const getTermsAtAge = (targetAge: number): Set<number> => {
    const terms = new Set<number>();
    for (const row of matrix) {
      if (row.term_years !== null && row.age === targetAge) {
        terms.add(row.term_years);
      }
    }
    return terms;
  };

  // If exact match, return terms at that age
  if (lowerAge === age || upperAge === age) {
    const exactAge = lowerAge === age ? lowerAge : upperAge!;
    return Array.from(getTermsAtAge(exactAge)).sort((a, b) => a - b);
  }

  // If we have both bounds, return intersection (terms that exist at BOTH ages)
  if (lowerAge !== null && upperAge !== null) {
    const lowerTerms = getTermsAtAge(lowerAge);
    const upperTerms = getTermsAtAge(upperAge);
    const intersection = new Set<number>();
    for (const term of lowerTerms) {
      if (upperTerms.has(term)) {
        intersection.add(term);
      }
    }
    return Array.from(intersection).sort((a, b) => a - b);
  }

  // If only one bound exists (age is outside matrix range), use that bound
  if (lowerAge !== null) {
    return Array.from(getTermsAtAge(lowerAge)).sort((a, b) => a - b);
  }
  if (upperAge !== null) {
    return Array.from(getTermsAtAge(upperAge)).sort((a, b) => a - b);
  }

  return [];
}

/**
 * Get rate classes that actually exist for a specific quote context.
 * This is used to distinguish the underwriting outcome from the product's
 * real quoteable classes in the premium matrix.
 */
export function getAvailableRateClassesForQuote(
  matrix: PremiumMatrix[],
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  termYears?: TermYears | null,
): RateableHealthClass[] {
  const classSet = new Set<RateableHealthClass>();

  for (const row of matrix) {
    if (row.gender !== gender || row.tobacco_class !== tobaccoClass) {
      continue;
    }

    if (termYears === null) {
      if (row.term_years !== null) continue;
    } else if (termYears !== undefined && row.term_years !== termYears) {
      continue;
    }

    const normalizedClass = normalizeHealthClass(row.health_class);
    if (normalizedClass) {
      classSet.add(normalizedClass);
    }
  }

  return HEALTH_CLASS_FALLBACK_ORDER.filter((healthClass) =>
    classSet.has(healthClass),
  );
}

/**
 * Get the longest available term from a premium matrix.
 * Returns null if no term products (permanent only).
 */
export function getLongestAvailableTerm(
  matrix: PremiumMatrix[],
): TermYears | null {
  const terms = getAvailableTerms(matrix);
  if (terms.length === 0) return null;
  return terms[terms.length - 1] as TermYears;
}

/**
 * Get the longest available term from a premium matrix for a specific age.
 * Only considers terms that have actual rate data for the given age.
 */
export function getLongestAvailableTermForAge(
  matrix: PremiumMatrix[],
  age: number,
): TermYears | null {
  const terms = getAvailableTermsForAge(matrix, age);
  if (terms.length === 0) return null;
  return terms[terms.length - 1] as TermYears;
}

/**
 * Alternative quote for a different face amount.
 */
export interface AlternativeQuote {
  faceAmount: number;
  monthlyPremium: number;
  costPerThousand: number;
}

/**
 * Calculate alternative quotes for different face amounts.
 * Returns quotes for the specified face amounts using the same parameters.
 */
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

    if (result.premium !== null) {
      const annualPremium = result.premium * 12;
      const coverageInThousands = faceAmount / 1000;
      const costPerThousand = annualPremium / coverageInThousands;

      quotes.push({
        faceAmount,
        monthlyPremium: result.premium,
        costPerThousand: Math.round(costPerThousand * 100) / 100,
      });
    }
  }

  return quotes;
}

/**
 * Determine face amounts to show for comparison.
 * Returns 3 face amounts: one lower, the requested, and one higher.
 * Respects product min/max limits.
 */
export function getComparisonFaceAmounts(
  requestedFaceAmount: number,
  minFaceAmount?: number | null,
  maxFaceAmount?: number | null,
): number[] {
  // Standard comparison amounts
  const standardAmounts = [
    50000, 75000, 100000, 150000, 200000, 250000, 300000, 400000, 500000,
    750000, 1000000, 1500000, 2000000,
  ];

  const min = minFaceAmount ?? 50000;
  const max = maxFaceAmount ?? 10000000;

  // Filter to amounts within product limits
  const validAmounts = standardAmounts.filter((a) => a >= min && a <= max);

  // Find amounts around the requested amount
  const lowerAmounts = validAmounts.filter((a) => a < requestedFaceAmount);
  const higherAmounts = validAmounts.filter((a) => a > requestedFaceAmount);

  // Pick one lower and one higher
  const lower =
    lowerAmounts.length > 0 ? lowerAmounts[lowerAmounts.length - 1] : null;
  const higher = higherAmounts.length > 0 ? higherAmounts[0] : null;

  // Build result array (always include requested amount in middle)
  const result: number[] = [];
  if (lower !== null) result.push(lower);
  result.push(requestedFaceAmount);
  if (higher !== null) result.push(higher);

  // If we only have 2, try to add another
  if (result.length === 2) {
    if (lower === null && higherAmounts.length > 1) {
      result.push(higherAmounts[1]);
    } else if (higher === null && lowerAmounts.length > 1) {
      result.unshift(lowerAmounts[lowerAmounts.length - 2]);
    }
  }

  return result;
}
