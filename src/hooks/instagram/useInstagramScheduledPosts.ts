// src/hooks/instagram/useInstagramScheduledPosts.ts
// TanStack Query hooks for Social Studio scheduled Instagram feed posts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  schedulePost,
  scheduleCarousel,
  cancelScheduledPost,
  getScheduledPosts,
  type SchedulePostInput,
  type ScheduleCarouselInput,
} from "@/services/social-studio";
import { instagramKeys } from "@/types/instagram.types";
import type { InstagramScheduledPost } from "@/types/instagram.types";

/** The agency's scheduled posts (RLS-scoped), soonest first. */
export function useScheduledPosts(imoId: string | undefined) {
  return useQuery({
    queryKey: instagramKeys.scheduledPosts(imoId ?? ""),
    queryFn: async (): Promise<InstagramScheduledPost[]> => {
      if (!imoId) return [];
      return getScheduledPosts(imoId);
    },
    enabled: !!imoId,
    staleTime: 60 * 1000,
  });
}

/** Schedule the current card for a future time. */
export function useSchedulePost(imoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SchedulePostInput) => schedulePost(input),
    onSuccess: () => {
      if (imoId) {
        queryClient.invalidateQueries({
          queryKey: instagramKeys.scheduledPosts(imoId),
        });
      }
    },
  });
}

/** Schedule the current deck as a CAROUSEL for a future time. */
export function useScheduleCarousel(imoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleCarouselInput) => scheduleCarousel(input),
    onSuccess: () => {
      if (imoId) {
        queryClient.invalidateQueries({
          queryKey: instagramKeys.scheduledPosts(imoId),
        });
      }
    },
  });
}

/** Cancel a pending scheduled post (deletes the row + GCs the image). */
export function useCancelScheduledPost(imoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelScheduledPost(id),
    onSuccess: () => {
      if (imoId) {
        queryClient.invalidateQueries({
          queryKey: instagramKeys.scheduledPosts(imoId),
        });
      }
    },
  });
}
