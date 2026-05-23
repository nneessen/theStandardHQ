import { useQuery } from "@tanstack/react-query";
import { productService } from "../../services/settings/products";
import { Product } from "../../types/product.types";

/**
 * Hook to fetch products with optional filtering by carrier
 */
export function useProducts(carrierId?: string) {
  return useQuery({
    queryKey: ["products", carrierId],
    queryFn: async () => {
      if (!carrierId) {
        return [];
      }

      const result = await productService.getByCarrier(carrierId);
      if (!result.success) {
        throw result.error || new Error("Failed to fetch products");
      }

      return ((result.data || []) as Product[]).filter(
        (product) => product.is_active,
      );
    },
    enabled: !!carrierId, // Only run query when carrierId is provided
    staleTime: 1000 * 60 * 15, // 15 minutes (products don't change often)
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Hook to get commission rate for a specific product
 */
export function useProductCommission(productId?: string) {
  return useQuery({
    queryKey: ["product-commission", productId],
    queryFn: async () => {
      if (!productId) return null;

      const result = await productService.getById(productId);
      if (!result.success) {
        return null;
      }

      return result.data?.commission_percentage
        ? result.data.commission_percentage * 100
        : null;
    },
    enabled: !!productId,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
