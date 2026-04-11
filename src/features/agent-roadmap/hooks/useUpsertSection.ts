// src/features/agent-roadmap/hooks/useUpsertSection.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { roadmapService } from "../services/roadmapService";
import { roadmapKeys } from "./queryKeys";
import type {
  CreateSectionInput,
  UpdateSectionInput,
  RoadmapTree,
  RoadmapSectionWithItems,
} from "../types/roadmap";

export function useCreateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSectionInput) =>
      roadmapService.createSection(input),
    onSuccess: (_section, input) => {
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.tree(input.roadmap_id),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sectionId,
      patch,
    }: {
      sectionId: string;
      patch: UpdateSectionInput;
      roadmapId: string;
    }) => roadmapService.updateSection(sectionId, patch),
    // Optimistic update in the tree cache
    onMutate: async ({ sectionId, patch, roadmapId }) => {
      await queryClient.cancelQueries({
        queryKey: roadmapKeys.tree(roadmapId),
      });
      const previous = queryClient.getQueryData<RoadmapTree | null>(
        roadmapKeys.tree(roadmapId),
      );

      queryClient.setQueryData<RoadmapTree | null>(
        roadmapKeys.tree(roadmapId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            sections: old.sections.map((s) =>
              s.id === sectionId ? { ...s, ...patch } : s,
            ),
          };
        },
      );
      return { previous, roadmapId };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous && context.roadmapId) {
        queryClient.setQueryData(
          roadmapKeys.tree(context.roadmapId),
          context.previous,
        );
      }
      toast.error(error.message);
    },
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sectionId,
    }: {
      sectionId: string;
      roadmapId: string;
    }) => roadmapService.deleteSection(sectionId),
    onSuccess: (_void, { roadmapId }) => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(roadmapId) });
      toast.success("Section deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useReorderSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roadmapId,
      orderedIds,
    }: {
      roadmapId: string;
      orderedIds: string[];
    }) => roadmapService.reorderSections(roadmapId, orderedIds),
    // Optimistic reorder in the tree cache
    onMutate: async ({ roadmapId, orderedIds }) => {
      await queryClient.cancelQueries({
        queryKey: roadmapKeys.tree(roadmapId),
      });
      const previous = queryClient.getQueryData<RoadmapTree | null>(
        roadmapKeys.tree(roadmapId),
      );

      queryClient.setQueryData<RoadmapTree | null>(
        roadmapKeys.tree(roadmapId),
        (old) => {
          if (!old) return old;
          const sectionById = new Map<string, RoadmapSectionWithItems>(
            old.sections.map((s) => [s.id, s]),
          );
          const reordered: RoadmapSectionWithItems[] = orderedIds
            .map((id, idx) => {
              const s = sectionById.get(id);
              return s ? { ...s, sort_order: idx } : null;
            })
            .filter((s): s is RoadmapSectionWithItems => s !== null);
          return { ...old, sections: reordered };
        },
      );
      return { previous, roadmapId };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous && context.roadmapId) {
        queryClient.setQueryData(
          roadmapKeys.tree(context.roadmapId),
          context.previous,
        );
      }
      toast.error(error.message);
    },
    onSettled: (_data, _error, { roadmapId }) => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(roadmapId) });
    },
  });
}
