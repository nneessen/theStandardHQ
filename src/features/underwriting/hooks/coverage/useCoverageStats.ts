// src/features/underwriting/hooks/useCoverageStats.ts
// Hook to query coverage stats: how many conditions each carrier/product has configured

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/services/base/supabase";

export const coverageStatsKeys = {
  all: ["coverage-stats"] as const,
  byImo: (imoId: string) => [...coverageStatsKeys.all, imoId] as const,
};

/** Composite key for coverage map: carrierId:productId (or carrierId:all for carrier-wide) */
export function getCoverageKey(
  carrierId: string,
  productId: string | null,
): string {
  return `${carrierId}:${productId ?? "all"}`;
}

/** Get condition codes covered for a specific carrier+product combo */
export function getProductCoverage(
  map: Map<string, Set<string>> | undefined,
  carrierId: string,
  productId: string | null,
): Set<string> {
  if (!map) return new Set<string>();
  return map.get(getCoverageKey(carrierId, productId)) ?? new Set<string>();
}

/**
 * Returns a Map<compositeKey, Set<conditionCode>> of all configured (approved, active)
 * condition-scoped rule sets. Key format: "carrierId:productId" or "carrierId:all".
 */
export function useCoverageStats() {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: coverageStatsKeys.byImo(imoId ?? ""),
    queryFn: async () => {
      if (!imoId) return new Map<string, Set<string>>();

      const { data, error } = await supabase
        .from("underwriting_rule_sets")
        .select("carrier_id, product_id, condition_code")
        .eq("imo_id", imoId)
        .eq("scope", "condition")
        .eq("review_status", "approved")
        .eq("is_active", true)
        .not("condition_code", "is", null);

      if (error) {
        console.error("Error fetching coverage stats:", error);
        throw error;
      }

      const map = new Map<string, Set<string>>();
      for (const row of data ?? []) {
        if (!row.carrier_id || !row.condition_code) continue;
        const key = getCoverageKey(row.carrier_id, row.product_id);
        if (!map.has(key)) {
          map.set(key, new Set());
        }
        map.get(key)!.add(row.condition_code);
      }
      return map;
    },
    enabled: !!imoId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Get aggregate coverage count for a carrier across all its products.
 * Returns unique condition codes configured for any product under this carrier.
 */
export function getCarrierAggregateCoverage(
  map: Map<string, Set<string>> | undefined,
  carrierId: string,
): Set<string> {
  if (!map) return new Set<string>();
  const aggregated = new Set<string>();
  for (const [key, codes] of map) {
    if (key.startsWith(`${carrierId}:`)) {
      for (const code of codes) {
        aggregated.add(code);
      }
    }
  }
  return aggregated;
}
