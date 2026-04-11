// src/features/agent-roadmap/hooks/useUpsertProgress.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { roadmapProgressService } from "../services/roadmapProgressService";
import { roadmapKeys } from "./queryKeys";
import type {
  RoadmapItemProgressRow,
  RoadmapProgressMap,
  UpsertProgressInput,
} from "../types/roadmap";

/**
 * Upsert progress on an item. Optimistically updates the progress map
 * so checkbox toggles feel instant.
 */
export function useUpsertProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      input,
    }: {
      userId: string;
      input: UpsertProgressInput;
      roadmapId: string;
    }) => roadmapProgressService.upsertProgress(userId, input),
    onMutate: async ({ userId, input, roadmapId }) => {
      const key = roadmapKeys.progress(userId, roadmapId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RoadmapProgressMap>(key);

      // Optimistic update: synthesize a progress row
      queryClient.setQueryData<RoadmapProgressMap>(key, (old) => {
        const map = new Map(old ?? new Map());
        const existing = map.get(input.item_id);
        const now = new Date().toISOString();
        const optimistic: RoadmapItemProgressRow = existing
          ? {
              ...existing,
              status: input.status,
              notes: input.notes ?? existing.notes,
              updated_at: now,
              completed_at: input.status === "completed" ? now : null,
              started_at:
                input.status === "in_progress" || input.status === "completed"
                  ? (existing.started_at ?? now)
                  : input.status === "not_started"
                    ? null
                    : existing.started_at,
            }
          : {
              id: `optimistic-${input.item_id}`,
              user_id: userId,
              item_id: input.item_id,
              roadmap_id: roadmapId,
              agency_id: "",
              status: input.status,
              notes: input.notes ?? null,
              started_at: input.status !== "not_started" ? now : null,
              completed_at: input.status === "completed" ? now : null,
              created_at: now,
              updated_at: now,
            };
        map.set(input.item_id, optimistic);
        return map;
      });

      return { previous, userId, roadmapId };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous && context.userId && context.roadmapId) {
        queryClient.setQueryData(
          roadmapKeys.progress(context.userId, context.roadmapId),
          context.previous,
        );
      }
      toast.error(error.message);
    },
    onSettled: (_data, _error, { userId, roadmapId }) => {
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.progress(userId, roadmapId),
      });
      // Super-admin monitoring view: invalidate if they're watching
      queryClient.invalidateQueries({
        queryKey: roadmapKeys.teamOverview(roadmapId),
      });
    },
  });
}

/**
 * Update agent's private notes on an item. Debounced from the UI via
 * useDebouncedField so this fires at most once per ~500ms.
 */
export function useUpdateProgressNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      itemId,
      notes,
    }: {
      userId: string;
      itemId: string;
      notes: string | null;
      roadmapId: string;
    }) => roadmapProgressService.updateNotes(userId, itemId, notes),
    onMutate: async ({ userId, itemId, notes, roadmapId }) => {
      const key = roadmapKeys.progress(userId, roadmapId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<RoadmapProgressMap>(key);

      queryClient.setQueryData<RoadmapProgressMap>(key, (old) => {
        const map = new Map(old ?? new Map());
        const existing = map.get(itemId);
        const now = new Date().toISOString();
        if (existing) {
          map.set(itemId, { ...existing, notes, updated_at: now });
        } else {
          map.set(itemId, {
            id: `optimistic-${itemId}`,
            user_id: userId,
            item_id: itemId,
            roadmap_id: roadmapId,
            agency_id: "",
            status: "not_started",
            notes,
            started_at: null,
            completed_at: null,
            created_at: now,
            updated_at: now,
          });
        }
        return map;
      });

      return { previous, userId, roadmapId };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous && context.userId && context.roadmapId) {
        queryClient.setQueryData(
          roadmapKeys.progress(context.userId, context.roadmapId),
          context.previous,
        );
      }
      toast.error(error.message);
    },
  });
}
