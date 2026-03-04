// src/hooks/admin/useAdminSpotlights.ts
// Admin CRUD hooks for feature spotlights management

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  spotlightService,
  type FeatureSpotlight,
  type CreateSpotlightParams,
  type UpdateSpotlightParams,
} from "@/services/subscription";
import { spotlightKeys } from "@/hooks/subscription/useFeatureSpotlight";

export type { FeatureSpotlight, CreateSpotlightParams, UpdateSpotlightParams };

export const adminSpotlightKeys = {
  all: ["admin", "spotlights"] as const,
  list: () => [...adminSpotlightKeys.all, "list"] as const,
};

export function useAdminSpotlights() {
  return useQuery<FeatureSpotlight[], Error>({
    queryKey: adminSpotlightKeys.list(),
    queryFn: () => spotlightService.getAllSpotlights(),
  });
}

export function useCreateSpotlight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateSpotlightParams) =>
      spotlightService.createSpotlight(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSpotlightKeys.all });
      queryClient.invalidateQueries({ queryKey: spotlightKeys.active() });
      toast.success("Spotlight created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create spotlight: ${error.message}`);
    },
  });
}

export function useUpdateSpotlight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      params,
    }: {
      id: string;
      params: UpdateSpotlightParams;
    }) => spotlightService.updateSpotlight(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSpotlightKeys.all });
      queryClient.invalidateQueries({ queryKey: spotlightKeys.active() });
      toast.success("Spotlight updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update spotlight: ${error.message}`);
    },
  });
}

export function useDeleteSpotlight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => spotlightService.deleteSpotlight(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminSpotlightKeys.all });
      queryClient.invalidateQueries({ queryKey: spotlightKeys.active() });
      toast.success("Spotlight deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete spotlight: ${error.message}`);
    },
  });
}
