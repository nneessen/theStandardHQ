import { useQuery } from "@tanstack/react-query";
import { compGuideService } from "../../services/settings/comp-guide";

interface CompGuideResult {
  commission_percentage: number;
  bonus_percentage: number | null;
}

export const useCompGuide = (
  productId: string,
  contractLevel: number,
  carrierId?: string,
) => {
  return useQuery({
    queryKey: ["comp_guide", productId, contractLevel, carrierId],
    queryFn: async (): Promise<CompGuideResult | null> => {
      if (!productId || !contractLevel) return null;

      const { data, error } = await compGuideService.getCurrentRate({
        productId,
        contractLevel,
        carrierId,
      });

      if (error) {
        console.error("comp_guide query error:", error);
        return null;
      }

      return data;
    },
    enabled:
      !!productId &&
      !!contractLevel &&
      (carrierId === undefined || !!carrierId),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};
