import { useQuery } from "@tanstack/react-query";
import { compGuideService } from "../../services/settings/comp-guide";
import { CompFilters } from "../../types/commission.types";

// TODO:signature issue here

export const useComps = (filters?: CompFilters) => {
  return useQuery({
    queryKey: ["comps", filters],
    queryFn: async () => {
      const { data, error } = await compGuideService.getAllEntries();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
};
