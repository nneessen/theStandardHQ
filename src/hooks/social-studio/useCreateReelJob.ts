// src/hooks/social-studio/useCreateReelJob.ts
// Mutation hook that calls generate-reels and invalidates the jobs list.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReelJob } from "@/services/social-studio/reelService";
import { reelKeys } from "@/types/reel.types";

export function useCreateReelJob(imoId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReelJob,
    onSuccess: () => {
      if (imoId) {
        queryClient.invalidateQueries({ queryKey: reelKeys.jobs(imoId) });
      }
    },
  });
}
