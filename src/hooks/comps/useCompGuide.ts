import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../services/base/supabase";

interface CompGuideResult {
  commission_percentage: number;
  bonus_percentage: number;
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

      const today = new Date().toISOString().split("T")[0];

      let query = supabase
        .from("comp_guide")
        .select("commission_percentage, bonus_percentage")
        .eq("product_id", productId)
        .eq("contract_level", contractLevel)
        .lte("effective_date", today)
        .or(`expiration_date.is.null,expiration_date.gte.${today}`);

      if (carrierId) {
        query = query.eq("carrier_id", carrierId);
      }

      const { data, error } = await query
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();

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
