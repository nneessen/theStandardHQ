import { useMutation, useQueryClient } from "@tanstack/react-query";
import { compGuideService } from "../../services/settings/comp-guide";
import { CreateCompData } from "../../types/commission.types";

// TODO: signature issue

export const useCreateComp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newComp: CreateCompData) => {
      const { data, error } = await compGuideService.createEntry(newComp);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comps"] });
    },
  });
};
