// src/hooks/surelc/useSureLcLinks.ts
// TanStack Query hooks for SureLC access links (Licensing hub).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sureLcLinkService } from "@/services/surelc";
import { useAuth } from "@/contexts/AuthContext";
import type {
  SureLcLink,
  CreateSureLcLinkData,
  UpdateSureLcLinkData,
} from "@/services/surelc";

export const sureLcLinkKeys = {
  all: ["surelc-links"] as const,
  shared: () => [...sureLcLinkKeys.all, "shared"] as const,
  mine: (userId: string | undefined) =>
    [...sureLcLinkKeys.all, "mine", userId] as const,
};

/** Company/shared SureLC links for the current user's IMO. */
export function useSharedSureLcLinks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: sureLcLinkKeys.shared(),
    queryFn: async () => {
      const result = await sureLcLinkService.getShared();
      if (!result.success) throw result.error;
      return result.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user?.id,
  });
}

/** The current user's own personal SureLC links. */
export function useMySureLcLinks() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: sureLcLinkKeys.mine(userId),
    queryFn: async () => {
      if (!userId) throw new Error("Not authenticated");
      const result = await sureLcLinkService.getMine(userId);
      if (!result.success) throw result.error;
      return result.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}

export function useCreateSureLcLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSureLcLinkData) => {
      const result = await sureLcLinkService.create(data);
      if (!result.success) throw result.error;
      return result.data as SureLcLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sureLcLinkKeys.all });
    },
  });
}

export function useUpdateSureLcLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateSureLcLinkData;
    }) => {
      const result = await sureLcLinkService.update(id, data);
      if (!result.success) throw result.error;
      return result.data as SureLcLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sureLcLinkKeys.all });
    },
  });
}

export function useDeleteSureLcLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await sureLcLinkService.delete(id);
      if (!result.success) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sureLcLinkKeys.all });
    },
  });
}
