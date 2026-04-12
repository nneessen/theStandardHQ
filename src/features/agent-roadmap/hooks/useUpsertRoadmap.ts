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

/**
 * Reorder roadmap templates in the admin list. Optimistic update rewrites
 * the listByAgency cache immediately so the drag feels instant; onError
 * rolls back; onSettled invalidates to converge on server truth.
 *
 * The default roadmap (is_default=true) is always placed first in the
 * orderedIds array by the caller — its sort_order ends up as 0, but the
 * list query's `is_default DESC` ordering still pins it at the top of
 * the render.
 */
export function useReorderRoadmaps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agencyId,
      orderedIds,
    }: {
      agencyId: string;
      orderedIds: string[];
    }) => roadmapService.reorderRoadmaps(agencyId, orderedIds),
    onMutate: async ({ agencyId, orderedIds }) => {
      const key = roadmapKeys.listByAgency(agencyId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RoadmapTemplateRow[]>(key);

      queryClient.setQueryData<RoadmapTemplateRow[]>(key, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((r) => [r.id, r]));
        return orderedIds
          .map((id, idx) => {
            const r = byId.get(id);
            return r ? { ...r, sort_order: idx } : null;
          })
          .filter((r): r is RoadmapTemplateRow => r !== null);
      });

      return { previous, agencyId };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous && context.agencyId) {
        queryClient.setQueryData(
          roadmapKeys.listByAgency(context.agencyId),
          context.previous,
        );
      }
      toast.error(error.message);
    },
    onSettled: (_data, _error, { agencyId }) => {
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.listByAgency(agencyId),
      });
    },
  });
}
