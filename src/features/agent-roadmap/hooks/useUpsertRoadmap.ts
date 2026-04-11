// src/features/agent-roadmap/hooks/useUpsertRoadmap.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { roadmapService } from "../services/roadmapService";
import { roadmapKeys } from "./queryKeys";
import type {
  CreateRoadmapInput,
  UpdateRoadmapInput,
  RoadmapTemplateRow,
} from "../types/roadmap";

/**
 * Create a new roadmap. Requires the current user id (createdBy) and
 * agency_id in the input. Agent-roadmap is super-admin only; RLS enforces.
 */
export function useCreateRoadmap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      input,
      createdBy,
    }: {
      input: CreateRoadmapInput;
      createdBy: string;
    }) => roadmapService.createRoadmap(input, createdBy),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.listByAgency(created.agency_id),
      });
      toast.success(`Roadmap "${created.title}" created`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Update a roadmap. Optimistically patches both the list and the tree cache.
 */
export function useUpdateRoadmap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roadmapId,
      patch,
    }: {
      roadmapId: string;
      patch: UpdateRoadmapInput;
    }) => roadmapService.updateRoadmap(roadmapId, patch),
    onMutate: async ({ roadmapId, patch }) => {
      await queryClient.cancelQueries({
        queryKey: roadmapKeys.tree(roadmapId),
      });

      // Optimistic patch: update the tree cache
      const previousTree = queryClient.getQueryData(
        roadmapKeys.tree(roadmapId),
      );
      queryClient.setQueryData(roadmapKeys.tree(roadmapId), (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        return { ...old, ...patch };
      });
      return { previousTree, roadmapId };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousTree && context.roadmapId) {
        queryClient.setQueryData(
          roadmapKeys.tree(context.roadmapId),
          context.previousTree,
        );
      }
      toast.error(error.message);
    },
    onSuccess: (updated: RoadmapTemplateRow) => {
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.listByAgency(updated.agency_id),
      });
    },
  });
}

/**
 * Delete a roadmap. Cascades to sections → items → progress at the DB level.
 */
export function useDeleteRoadmap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roadmapId,
    }: {
      roadmapId: string;
      agencyId: string;
    }) => roadmapService.deleteRoadmap(roadmapId),
    onSuccess: (_void, { agencyId }) => {
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.listByAgency(agencyId),
      });
      toast.success("Roadmap deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Set a roadmap as the default for its agency (clears previous default atomically).
 */
export function useSetDefaultRoadmap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roadmapId,
    }: {
      roadmapId: string;
      agencyId: string;
    }) => roadmapService.setDefaultRoadmap(roadmapId),
    onSuccess: (_void, { agencyId }) => {
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.listByAgency(agencyId),
      });
      toast.success("Default roadmap updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
