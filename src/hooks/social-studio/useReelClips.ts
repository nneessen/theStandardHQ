// src/hooks/social-studio/useReelClips.ts
// TanStack Query hook for the clips belonging to a specific reel job.

import { useQuery } from "@tanstack/react-query";
import { getReelClips } from "@/services/social-studio/reelService";
import { reelKeys } from "@/types/reel.types";
import type { ReelClip } from "@/types/reel.types";

export function useReelClips(jobId?: string, enabled?: boolean) {
  return useQuery({
    queryKey: reelKeys.clips(jobId ?? ""),
    queryFn: (): Promise<ReelClip[]> => getReelClips(jobId!),
    enabled: !!jobId && enabled !== false,
  });
}
