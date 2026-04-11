// src/features/agent-roadmap/hooks/useUpsertItem.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { roadmapService } from "../services/roadmapService";
import { roadmapKeys } from "./queryKeys";
import type {
  CreateItemInput,
  UpdateItemInput,
  RoadmapTree,
  RoadmapItem,
} from "../types/roadmap";

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      input,
    }: {
      input: CreateItemInput;
      roadmapId: string;
    }) => roadmapService.createItem(input),
    onSuccess: (_item, { roadmapId }) => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(roadmapId) });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Duplicate an item. Clones title, content blocks, flags, and estimated
 * minutes into a new row appended to the same section. Used by the
 * item row's "Duplicate" dropdown action.
 */
export function useDuplicateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId }: { itemId: string; roadmapId: string }) =>
      roadmapService.duplicateItem(itemId),
    onSuccess: (_item, { roadmapId }) => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(roadmapId) });
      toast.success("Item duplicated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

/**
 * Update an item. Optimistic in the tree cache so debounced text edits
 * feel instant and don't fight with query-cache refetches.
 */
export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      patch,
    }: {
      itemId: string;
      patch: UpdateItemInput;
      roadmapId: string;
    }) => roadmapService.updateItem(itemId, patch),
    onMutate: async ({ itemId, patch, roadmapId }) => {
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
            sections: old.sections.map((s) => ({
              ...s,
              items: s.items.map((i) =>
                i.id === itemId
                  ? ({
                      ...i,
                      ...patch,
                      content_blocks:
                        patch.content_blocks !== undefined
                          ? patch.content_blocks
                          : i.content_blocks,
                    } as RoadmapItem)
                  : i,
              ),
            })),
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

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId }: { itemId: string; roadmapId: string }) =>
      roadmapService.deleteItem(itemId),
    onSuccess: (_void, { roadmapId }) => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(roadmapId) });
      toast.success("Item deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useReorderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sectionId,
      orderedIds,
    }: {
      sectionId: string;
      orderedIds: string[];
      roadmapId: string;
    }) => roadmapService.reorderItems(sectionId, orderedIds),
    onMutate: async ({ sectionId, orderedIds, roadmapId }) => {
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
            sections: old.sections.map((s) => {
              if (s.id !== sectionId) return s;
              const byId = new Map(s.items.map((i) => [i.id, i]));
              const reordered: RoadmapItem[] = orderedIds
                .map((id, idx) => {
                  const item = byId.get(id);
                  return item ? { ...item, sort_order: idx } : null;
                })
                .filter((i): i is RoadmapItem => i !== null);
              return { ...s, items: reordered };
            }),
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
    onSettled: (_data, _error, { roadmapId }) => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(roadmapId) });
    },
  });
}

export function useMoveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      targetSectionId,
      newIndex,
    }: {
      itemId: string;
      targetSectionId: string;
      newIndex: number;
      roadmapId: string;
    }) => roadmapService.moveItem(itemId, targetSectionId, newIndex),
    onSuccess: (_void, { roadmapId }) => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.tree(roadmapId) });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
