import { useMutation, useQueryClient } from "@tanstack/react-query";
import { compGuideService } from "../../services/settings/comp-guide";

//TODO: signature issue

export const useDeleteComp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await compGuideService.deleteEntry(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comps"] });
    },
  });
};
