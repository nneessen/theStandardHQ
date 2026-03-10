// src/services/underwriting/rateService.ts
// Service for managing product rate table entries

import { supabase } from "@/services/base/supabase";
import type { Database } from "@/types/database.types";

type ProductRateRow = Database["public"]["Tables"]["product_rate_table"]["Row"];
type ProductRateInsert =
  Database["public"]["Tables"]["product_rate_table"]["Insert"];
// ProductRateUpdate available if needed for partial updates
// type ProductRateUpdate = Database["public"]["Tables"]["product_rate_table"]["Update"];

// ============================================================================
// Types
// ============================================================================

export type GenderType = "male" | "female";
export type TobaccoClass = "non_tobacco" | "tobacco" | "preferred_non_tobacco";
export type HealthClass =
  | "preferred_plus"
  | "preferred"
  | "standard"
  | "standard_plus"
  | "table_rated";

export interface ProductRate extends ProductRateRow {
  product?: {
    id: string;
    name: string;
    product_type: string;
    carrier_id: string;
  };
}

export interface RateEntryInput {
  productId: string;
  ageBandStart: number;
  ageBandEnd: number;
  gender: GenderType;
  tobaccoClass: TobaccoClass;
  healthClass: HealthClass;
  ratePerThousand: number;
  effectiveDate?: string;
  notes?: string;
}

export interface BulkRateEntry {
  productId: string;
  rates: Array<{
    ageBandStart: number;
    ageBandEnd: number;
    gender: GenderType;
    tobaccoClass: TobaccoClass;
    healthClass: HealthClass;
    ratePerThousand: number;
  }>;
}

// Standard age bands for rate entry
export const AGE_BANDS = [
  { start: 18, end: 29, label: "18-29" },
  { start: 30, end: 34, label: "30-34" },
  { start: 35, end: 39, label: "35-39" },
  { start: 40, end: 44, label: "40-44" },
  { start: 45, end: 49, label: "45-49" },
  { start: 50, end: 54, label: "50-54" },
  { start: 55, end: 59, label: "55-59" },
  { start: 60, end: 64, label: "60-64" },
  { start: 65, end: 69, label: "65-69" },
  { start: 70, end: 74, label: "70-74" },
  { start: 75, end: 79, label: "75-79" },
  { start: 80, end: 85, label: "80-85" },
] as const;

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

// ============================================================================
// Fetch Functions
// ============================================================================

/**
 * Get all rates for a specific product
 */
export async function getRatesForProduct(
  productId: string,
  imoId: string,
): Promise<ProductRate[]> {
  const { data, error } = await supabase
    .from("product_rate_table")
    .select(
      `
      *,
      product:products(id, name, product_type, carrier_id)
    `,
    )
    .eq("product_id", productId)
    .eq("imo_id", imoId)
    .order("age_band_start", { ascending: true });

  if (error) {
    console.error("Error fetching product rates:", error);
    throw new Error(`Failed to fetch rates: ${error.message}`);
  }

  return (data || []) as ProductRate[];
}

/**
 * Get all rates for a carrier (all products)
 */
export async function getRatesForCarrier(
  carrierId: string,
  imoId: string,
): Promise<ProductRate[]> {
  const { data, error } = await supabase
    .from("product_rate_table")
    .select(
      `
      *,
      product:products!inner(id, name, product_type, carrier_id)
    `,
    )
    .eq("products.carrier_id", carrierId)
    .eq("imo_id", imoId)
    .order("age_band_start", { ascending: true });

  if (error) {
    console.error("Error fetching carrier rates:", error);
    throw new Error(`Failed to fetch rates: ${error.message}`);
  }

  return (data || []) as ProductRate[];
}

/**
 * Get a specific rate for lookup
 */
export async function getRate(
  productId: string,
  age: number,
  gender: GenderType,
  tobaccoClass: TobaccoClass,
  healthClass: HealthClass,
  imoId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("product_rate_table")
    .select("rate_per_thousand")
    .eq("product_id", productId)
    .eq("gender", gender)
    .eq("tobacco_class", tobaccoClass)
    .eq("health_class", healthClass)
    .eq("imo_id", imoId)
    .lte("age_band_start", age)
    .gte("age_band_end", age)
    .or("expiration_date.is.null,expiration_date.gt.now()")
    .order("effective_date", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // No rate found
    }
    console.error("Error fetching rate:", error);
    throw new Error(`Failed to fetch rate: ${error.message}`);
  }

  return data?.rate_per_thousand ?? null;
}

/**
 * Get products that have rates entered for an IMO
 */
export async function getProductsWithRates(imoId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("product_rate_table")
    .select("product_id")
    .eq("imo_id", imoId);

  if (error) {
    console.error("Error fetching products with rates:", error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  // Return unique product IDs
  return [...new Set((data || []).map((r) => r.product_id))];
}

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Create or update a single rate entry
 */
export async function upsertRate(
  input: RateEntryInput,
  imoId: string,
  userId: string,
): Promise<ProductRate> {
  const insertData: ProductRateInsert = {
    product_id: input.productId,
    age_band_start: input.ageBandStart,
    age_band_end: input.ageBandEnd,
    gender: input.gender,
    tobacco_class: input.tobaccoClass,
    health_class: input.healthClass,
    rate_per_thousand: input.ratePerThousand,
    effective_date:
      input.effectiveDate || new Date().toISOString().split("T")[0],
    notes: input.notes,
    imo_id: imoId,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from("product_rate_table")
    .upsert(insertData, {
      onConflict:
        "product_id,age_band_start,age_band_end,gender,tobacco_class,health_class,imo_id",
    })
    .select()
    .single();

  if (error) {
    console.error("Error upserting rate:", error);
    throw new Error(`Failed to save rate: ${error.message}`);
  }

  return data as ProductRate;
}

/**
 * Bulk upsert rates for a product
 */
export async function bulkUpsertRates(
  input: BulkRateEntry,
  imoId: string,
  userId: string,
): Promise<{ inserted: number; updated: number }> {
  const effectiveDate = new Date().toISOString().split("T")[0];

  const insertData: ProductRateInsert[] = input.rates.map((rate) => ({
    product_id: input.productId,
    age_band_start: rate.ageBandStart,
    age_band_end: rate.ageBandEnd,
    gender: rate.gender,
    tobacco_class: rate.tobaccoClass,
    health_class: rate.healthClass,
    rate_per_thousand: rate.ratePerThousand,
    effective_date: effectiveDate,
    imo_id: imoId,
    created_by: userId,
  }));

  const { data, error } = await supabase
    .from("product_rate_table")
    .upsert(insertData, {
      onConflict:
        "product_id,age_band_start,age_band_end,gender,tobacco_class,health_class,imo_id",
    })
    .select();

  if (error) {
    console.error("Error bulk upserting rates:", error);
    throw new Error(`Failed to save rates: ${error.message}`);
  }

  return {
    inserted: data?.length || 0,
    updated: 0, // Upsert doesn't distinguish
  };
}

/**
 * Delete a specific rate entry
 */
export async function deleteRate(rateId: string): Promise<void> {
  const { error } = await supabase
    .from("product_rate_table")
    .delete()
    .eq("id", rateId);

  if (error) {
    console.error("Error deleting rate:", error);
    throw new Error(`Failed to delete rate: ${error.message}`);
  }
}

/**
 * Delete all rates for a product
 */
export async function deleteRatesForProduct(
  productId: string,
  imoId: string,
): Promise<void> {
  const { error } = await supabase
    .from("product_rate_table")
    .delete()
    .eq("product_id", productId)
    .eq("imo_id", imoId);

  if (error) {
    console.error("Error deleting product rates:", error);
    throw new Error(`Failed to delete rates: ${error.message}`);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate monthly premium from rate and face amount
 */
export function calculatePremium(
  ratePerThousand: number,
  faceAmount: number,
): number {
  return ratePerThousand * (faceAmount / 1000);
}

/**
 * Get the age band for a given age
 */
export function getAgeBandForAge(
  age: number,
): { start: number; end: number } | null {
  const band = AGE_BANDS.find((b) => age >= b.start && age <= b.end);
  return band ? { start: band.start, end: band.end } : null;
}

/**
 * Parse CSV rate data
 * Expected format: age_start,age_end,gender,tobacco,health_class,rate
 */
export function parseRateCSV(
  csvContent: string,
  productId: string,
): BulkRateEntry {
  const lines = csvContent.trim().split("\n");
  const rates: BulkRateEntry["rates"] = [];

  // Skip header row if present
  const startIndex = lines[0].toLowerCase().includes("age") ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    if (parts.length < 6) continue;

    const [ageStart, ageEnd, gender, tobacco, healthClass, rate] = parts;

    rates.push({
      ageBandStart: parseInt(ageStart, 10),
      ageBandEnd: parseInt(ageEnd, 10),
      gender: gender.toLowerCase() as GenderType,
      tobaccoClass: tobacco
        .toLowerCase()
        .replace("-", "_")
        .replace(" ", "_") as TobaccoClass,
      healthClass: healthClass
        .toLowerCase()
        .replace("-", "_")
        .replace(" ", "_") as HealthClass,
      ratePerThousand: parseFloat(rate),
    });
  }

  return { productId, rates };
}
