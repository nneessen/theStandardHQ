// src/features/policies/hooks/usePolicyCommission.ts

import { useState, useEffect } from "react";
import { supabase } from "../../../services/base/supabase";
import { useCompGuide } from "../../../hooks/comps";
import {
  type TermCommissionModifiers,
  type TermLength,
  type ProductMetadata,
} from "../../../types/product.types";
import { formatDateForDB } from "../../../lib/date";

export interface Product {
  id: string;
  product_type: string;
  commission_percentage?: number;
  metadata?: ProductMetadata | null;
}

export interface UsePolicyCommissionOptions {
  productId: string | undefined;
  userContractLevel: number;
  products: Product[];
  termLength?: number;
  /** Whether we're in edit mode */
  isEditMode: boolean;
  /** The initial product ID when editing (to detect user changes) */
  initialProductId: string | null;
  /** Carrier ID to scope comp_guide lookup to the correct carrier */
  carrierId?: string;
}

export interface UsePolicyCommissionReturn {
  /** Calculated commission percentage (as whole number, e.g., 85 for 85%) */
  commissionPercentage: number;
  /** Term commission modifiers for the selected product */
  termModifiers: TermCommissionModifiers | null;
  /** Commission rates for all products (for display in dropdown) */
  productCommissionRates: Record<string, number>;
  /** Whether commission data is loading */
  isLoading: boolean;
}

/**
 * Custom hook for managing commission calculations and rates
 *
 * Handles:
 * - Fetching commission rates from comp_guide based on product and contract level
 * - Calculating term-adjusted commission rates
 * - Providing commission rates for product dropdown display
 */
export function usePolicyCommission({
  productId,
  userContractLevel,
  products,
  termLength,
  isEditMode,
  initialProductId,
  carrierId,
}: UsePolicyCommissionOptions): UsePolicyCommissionReturn {
  const [commissionPercentage, setCommissionPercentage] = useState(0);
  const [termModifiers, setTermModifiers] =
    useState<TermCommissionModifiers | null>(null);
  const [productCommissionRates, setProductCommissionRates] = useState<
    Record<string, number>
  >({});
  const [isLoading, setIsLoading] = useState(false);

  // Fetch commission rate from comp_guide based on product, contract level, and carrier
  const { data: compGuideData, isLoading: compGuideLoading } = useCompGuide(
    productId || "",
    userContractLevel,
    carrierId,
  );

  // Update term modifiers when product changes (for term_life products)
  useEffect(() => {
    const selectedProduct = products.find((p) => p.id === productId);

    if (
      selectedProduct?.product_type === "term_life" &&
      selectedProduct.metadata
    ) {
      const metadata = selectedProduct.metadata as ProductMetadata;
      if (metadata.termCommissionModifiers) {
        setTermModifiers(metadata.termCommissionModifiers);
      } else {
        setTermModifiers(null);
      }
    } else {
      setTermModifiers(null);
    }
  }, [productId, products]);

  // Recalculate commission when term length changes (applies term modifier)
  useEffect(() => {
    if (!termLength || !termModifiers || !compGuideData) {
      return;
    }

    const modifier = termModifiers[termLength as TermLength] ?? 0;
    const baseRate = compGuideData.commission_percentage;
    const adjustedRate = baseRate * (1 + modifier);

    // Only update if rate actually changed (to prevent infinite loops)
    const newPercentage = adjustedRate * 100;
    if (Math.abs(commissionPercentage - newPercentage) > 0.001) {
      setCommissionPercentage(newPercentage);
    }
  }, [termLength, termModifiers, compGuideData, commissionPercentage]);

  // Fetch commission rates for all products when products change (batch query)
  useEffect(() => {
    const fetchProductCommissionRates = async () => {
      if (products.length === 0) return;

      setIsLoading(true);
      const today = formatDateForDB(new Date());
      const productIds = products.map((p) => p.id);

      // Batch query: fetch all comp_guide entries for these products at once
      const { data: compGuideData, error } = await supabase
        .from("comp_guide")
        .select("product_id, commission_percentage, effective_date")
        .in("product_id", productIds)
        .eq("contract_level", userContractLevel)
        .lte("effective_date", today)
        .or(`expiration_date.is.null,expiration_date.gte.${today}`)
        .order("effective_date", { ascending: false });

      if (error) {
        console.error(
          "[usePolicyCommission] Failed to fetch commission rates:",
          error,
        );
        setIsLoading(false);
        return;
      }

      // Build rates map: for each product, use the most recent comp_guide entry
      // (already sorted by effective_date desc, so first match per product wins)
      const rates: Record<string, number> = {};
      const seenProducts = new Set<string>();

      for (const entry of compGuideData || []) {
        if (!seenProducts.has(entry.product_id)) {
          rates[entry.product_id] = entry.commission_percentage;
          seenProducts.add(entry.product_id);
        }
      }

      // Fallback to product commission_percentage for any products not in comp_guide
      for (const product of products) {
        if (!(product.id in rates)) {
          rates[product.id] = product.commission_percentage || 0;
        }
      }

      setProductCommissionRates(rates);
      setIsLoading(false);
    };

    fetchProductCommissionRates();
  }, [products, userContractLevel]);

  // Update commission percentage when comp_guide data changes
  useEffect(() => {
    // For edit mode: only skip update if product hasn't changed from initial
    if (isEditMode) {
      if (!productId || productId === initialProductId) {
        return;
      }
    }

    if (productId && compGuideData) {
      // Use comp_guide commission rate (contract-level based)
      setCommissionPercentage(compGuideData.commission_percentage * 100);
    } else if (productId && !compGuideData && !compGuideLoading) {
      // Fallback to product commission rate
      const selectedProduct = products.find((p) => p.id === productId);
      setCommissionPercentage(
        selectedProduct?.commission_percentage
          ? selectedProduct.commission_percentage * 100
          : 0,
      );
    }
  }, [
    productId,
    compGuideData,
    compGuideLoading,
    products,
    isEditMode,
    initialProductId,
  ]);

  return {
    commissionPercentage,
    termModifiers,
    productCommissionRates,
    isLoading: isLoading || compGuideLoading,
  };
}

/**
 * Hook to fetch user's contract level from the database
 */
export function useUserContractLevel(
  userId: string | undefined,
  fallbackLevel: number = 100,
): number {
  const [contractLevel, setContractLevel] = useState<number | null>(null);

  useEffect(() => {
    const fetchContractLevel = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from("user_profiles")
        .select("contract_level")
        .eq("id", userId)
        .single();

      if (error) {
        console.error(
          "[useUserContractLevel] Failed to fetch contract level:",
          error,
        );
        // Fall through to use fallback level
        return;
      }

      if (data?.contract_level) {
        setContractLevel(data.contract_level);
      }
    };

    fetchContractLevel();
  }, [userId]);

  return contractLevel ?? fallbackLevel;
}
