// src/hooks/reports/useReportFilterOptions.ts

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../services/base/supabase";
import { carrierService } from "../../services/settings/carriers";
import { productService } from "../../services/settings/products";
import { FilterOption } from "../../types/reports.types";

interface ReportFilterOptions {
  carriers: FilterOption[];
  products: FilterOption[];
  states: FilterOption[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch available filter options for reports
 * Returns carriers, products, and states that can be used to filter report data
 */
export function useReportFilterOptions(): ReportFilterOptions {
  // Fetch carriers
  const carriersQuery = useQuery<FilterOption[], Error>({
    queryKey: ["filter-options", "carriers"],
    queryFn: async () => {
      const result = await carrierService.getActive();
      if (!result.success) {
        throw result.error || new Error("Failed to fetch carriers");
      }
      return (result.data || []).map((c) => ({ id: c.id, name: c.name }));
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Fetch products
  const productsQuery = useQuery<FilterOption[], Error>({
    queryKey: ["filter-options", "products"],
    queryFn: async () => {
      const result = await productService.getActive();
      if (!result.success) {
        throw result.error || new Error("Failed to fetch products");
      }
      return (result.data || []).map((p) => ({ id: p.id, name: p.name }));
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Fetch unique states from policies
  const statesQuery = useQuery<FilterOption[], Error>({
    queryKey: ["filter-options", "states"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get unique states from policies
      const { data, error } = await supabase
        .from("policies")
        .select("state")
        .eq("user_id", user.id)
        .not("state", "is", null);

      if (error) throw error;

      // Extract unique states
      const uniqueStates = [
        ...new Set((data || []).map((p) => p.state).filter(Boolean)),
      ].sort();
      return uniqueStates.map((s) => ({ id: s, name: s }));
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return {
    carriers: carriersQuery.data || [],
    products: productsQuery.data || [],
    states: statesQuery.data || [],
    isLoading:
      carriersQuery.isLoading ||
      productsQuery.isLoading ||
      statesQuery.isLoading,
    error: carriersQuery.error || productsQuery.error || statesQuery.error,
  };
}
