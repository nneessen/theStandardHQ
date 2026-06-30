// src/hooks/social-studio/useReelJobs.ts
// TanStack Query hook for a list of reel jobs for an agency.
// Auto-polls at 8 s whenever any job is still processing.

import { useQuery } from "@tanstack/react-query";
import { getReelJobs } from "@/services/social-studio/reelService";
import { reelKeys } from "@/types/reel.types";
import type { ReelJob } from "@/types/reel.types";

export function useReelJobs(imoId?: string) {
  return useQuery({
    queryKey: reelKeys.jobs(imoId ?? ""),
    queryFn: (): Promise<ReelJob[]> => getReelJobs(imoId!),
    enabled: !!imoId,
    refetchInterval: (query) => {
      const jobs = query.state.data as ReelJob[] | undefined;
      return jobs?.some((j) => j.status === "processing") ? 8_000 : false;
    },
  });
}
