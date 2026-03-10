// src/features/underwriting/hooks/useProductConstraints.ts

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import type { ProductUnderwritingConstraints } from "../../types/product-constraints.types";

/**
 * Query keys for product constraints
 */
export const productConstraintsQueryKeys = {
  all: ["product-constraints"] as const,
  byIds: (ids: string[]) =>
    [...productConstraintsQueryKeys.all, ...ids.sort()] as const,
};

interface ProductWithConstraints {
  id: string;
  name: string;
  metadata: ProductUnderwritingConstraints | null;
}

/**
 * Fetches product constraints (metadata) for a list of product IDs
 * Returns a Map of productId -> constraints for easy lookup
 */
export function useProductConstraints(productIds: string[]) {
  return useQuery({
    queryKey: productConstraintsQueryKeys.byIds(productIds),
    queryFn: async (): Promise<
      Map<string, ProductUnderwritingConstraints | null>
    > => {
      if (productIds.length === 0) {
        return new Map();
      }

      const { data, error } = await supabase
        .from("products")
        .select("id, name, metadata")
        .in("id", productIds);

      if (error) throw error;

      const constraintsMap = new Map<
        string,
        ProductUnderwritingConstraints | null
      >();

      for (const product of (data || []) as ProductWithConstraints[]) {
        // Constraints are stored directly on metadata, not nested under underwritingConstraints
        // The metadata object itself IS the ProductUnderwritingConstraints shape
        const constraints =
          product.metadata as ProductUnderwritingConstraints | null;
        constraintsMap.set(product.id, constraints ?? null);
      }

      // Ensure all requested IDs are in the map (even if product not found)
      for (const id of productIds) {
        if (!constraintsMap.has(id)) {
          constraintsMap.set(id, null);
        }
      }

      return constraintsMap;
    },
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes - constraints rarely change
  });
}
