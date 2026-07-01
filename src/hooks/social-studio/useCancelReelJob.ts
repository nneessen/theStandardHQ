// src/hooks/social-studio/useCancelReelJob.ts
// Mutation hook that cancels/dismisses a reel job and refreshes the jobs list.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelReelJob } from "@/services/social-studio/reelService";
import { reelKeys } from "@/types/reel.types";

export function useCancelReelJob(imoId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => cancelReelJob(jobId),
    onSuccess: () => {
      if (imoId) {
        queryClient.invalidateQueries({ queryKey: reelKeys.jobs(imoId) });
      }
    },
  });
}
