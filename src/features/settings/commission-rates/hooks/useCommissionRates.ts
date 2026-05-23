import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  compGuideService,
  type CompGuideFormData,
} from "@/services/settings/comp-guide";
import { toast } from "sonner";
import type { Database } from "@/types/database.types";

type ProductType = Database["public"]["Enums"]["product_type"];

export interface CommissionRate {
  id: string;
  carrier_id: string;
  product_id: string | null;
  product_type: ProductType | null;
  contract_level: number;
  commission_percentage: number;
  effective_date: string;
  expiration_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductWithRates {
  productId: string;
  productName: string;
  carrierId: string;
  carrierName: string;
  productType: ProductType;
  rates: Record<number, { id: string; percentage: number }>;
  rateCoverage: string; // e.g., "8/14"
}

export interface CreateRateData {
  carrier_id: string;
  product_id: string | null;
  product_type: ProductType;
  contract_level: number;
  commission_percentage: number;
  effective_date: string;
  expiration_date?: string | null;
}

export interface UpdateRateData {
  commission_percentage?: number;
  effective_date?: string;
  expiration_date?: string | null;
}

// Contract levels from 80 to 145 in 5% increments
export const CONTRACT_LEVELS = Array.from({ length: 14 }, (_, i) => 80 + i * 5);

interface UseCommissionRatesOptions {
  imoId?: string;
  enabled?: boolean;
}

export function useCommissionRates(options: UseCommissionRatesOptions = {}) {
  const queryClient = useQueryClient();
  const { imoId, enabled = true } = options;

  // Fetch all commission data in grid format
  const {
    data: gridData = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["commission-grid", imoId],
    queryFn: async () => {
      const data = await compGuideService.getAllCommissionData(imoId);
      return data || [];
    },
    enabled,
  });

  // Transform grid data to product-with-rates format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- grid data type
  const productsWithRates: ProductWithRates[] = gridData.map((row: any) => {
    const ratesCount = Object.keys(row.rates || {}).length;
    return {
      productId: row.productId || "",
      productName: row.productName || "",
      carrierId: row.carrierId || "",
      carrierName: row.carrierName || "",
      productType: row.productType || "term_life",
      rates: Object.entries(row.rates || {}).reduce(
        (acc, [level, percentage]) => {
          acc[Number(level)] = {
            id: "", // We'll need to fetch this when editing
            percentage: Number(percentage),
          };
          return acc;
        },
        {} as Record<number, { id: string; percentage: number }>,
      ),
      rateCoverage: `${ratesCount}/${CONTRACT_LEVELS.length}`,
    };
  });

  // Get rates for a specific product
  const getProductRates = async (productId: string) => {
    const { data } = await compGuideService.getEntriesByProduct(productId);
    return data || [];
  };

  // Create rate mutation
  // Note: No success toast here - component handles batch success notifications
  const createRate = useMutation({
    mutationFn: async (data: CreateRateData) => {
      const result = await compGuideService.createEntry({
        carrier_id: data.carrier_id,
        product_id: data.product_id || undefined,
        product_type: data.product_type || undefined,
        contract_level: data.contract_level,
        commission_percentage: data.commission_percentage,
        effective_date: data.effective_date,
        expiration_date: data.expiration_date || undefined,
      });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create rate: ${error.message}`);
    },
  });

  // Update rate mutation
  // Note: No success toast here - component handles batch success notifications
  const updateRate = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRateData }) => {
      // Only include fields that are actually provided (not undefined)
      const updateData: Partial<CompGuideFormData> = {};
      if (data.commission_percentage !== undefined) {
        updateData.commission_percentage = data.commission_percentage;
      }
      if (data.effective_date !== undefined) {
        updateData.effective_date = data.effective_date;
      }
      if (data.expiration_date !== undefined) {
        updateData.expiration_date = data.expiration_date ?? undefined;
      }
      const result = await compGuideService.updateEntry(id, updateData);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update rate: ${error.message}`);
    },
  });

  // Delete rate mutation
  // Note: No success toast here - component handles batch success notifications
  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      const result = await compGuideService.deleteEntry(id);
      if (result.error) {
        const err = result.error as Error;
        throw new Error(err.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete rate: ${error.message}`);
    },
  });

  // Bulk create rates mutation
  const bulkCreateRates = useMutation({
    mutationFn: async (rates: CreateRateData[]) => {
      const result = await compGuideService.createBulkEntries(
        rates.map((r) => ({
          carrier_id: r.carrier_id,
          product_id: r.product_id || undefined,
          product_type: r.product_type || undefined,
          contract_level: r.contract_level,
          commission_percentage: r.commission_percentage,
          effective_date: r.effective_date,
          expiration_date: r.expiration_date || undefined,
        })),
      );
      if ("error" in result && result.error) {
        const err = result.error as Error;
        throw new Error(err.message);
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["commission-grid"] });
      toast.success(
        `Successfully imported ${data?.length || 0} commission rates`,
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to import rates: ${error.message}`);
    },
  });

  return {
    productsWithRates,
    isLoading,
    error,
    getProductRates,
    createRate,
    updateRate,
    deleteRate,
    bulkCreateRates,
  };
}
