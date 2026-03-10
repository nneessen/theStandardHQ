// src/features/underwriting/hooks/useCarriersWithProducts.ts

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { CarrierWithProducts } from "../../types/underwriting.types";

/**
 * Query keys for carriers with products
 */
export const carriersWithProductsQueryKeys = {
  all: ["carriers-with-products"] as const,
  byImo: (imoId: string) =>
    [...carriersWithProductsQueryKeys.all, imoId] as const,
};

// Product type from join query
interface ProductFromQuery {
  id: string;
  name: string;
  product_type: string;
}

/**
 * Fetch carriers with their products for the current IMO
 * Used in decision tree editor for rule action configuration
 *
 * Security: Uses two queries instead of string interpolation in .or() filter
 * to avoid potential injection risks
 */
export function useCarriersWithProducts(limit = 100) {
  const { user } = useAuth();
  const imoId = user?.imo_id;

  return useQuery({
    queryKey: carriersWithProductsQueryKeys.byImo(imoId || ""),
    queryFn: async (): Promise<CarrierWithProducts[]> => {
      if (!imoId) return [];

      // Fetch IMO-specific carriers with proper parameterization
      const { data: imoCarriers, error: imoError } = await supabase
        .from("carriers")
        .select(
          `
          id,
          name,
          products (
            id,
            name,
            product_type
          )
        `,
        )
        .eq("is_active", true)
        .eq("imo_id", imoId)
        .limit(limit);

      if (imoError) throw imoError;

      // Fetch global carriers (imo_id is null)
      const { data: globalCarriers, error: globalError } = await supabase
        .from("carriers")
        .select(
          `
          id,
          name,
          products (
            id,
            name,
            product_type
          )
        `,
        )
        .eq("is_active", true)
        .is("imo_id", null)
        .limit(limit);

      if (globalError) throw globalError;

      // Combine and deduplicate by id
      const allCarriers = [...(imoCarriers || []), ...(globalCarriers || [])];
      const uniqueCarriers = Array.from(
        new Map(allCarriers.map((c) => [c.id, c])).values(),
      );

      return uniqueCarriers.map((c) => ({
        id: c.id,
        name: c.name,
        products: ((c.products as ProductFromQuery[]) || []).map((p) => ({
          id: p.id,
          name: p.name,
          product_type: p.product_type,
        })),
      }));
    },
    enabled: !!imoId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
