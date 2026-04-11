// src/features/training-modules/hooks/useTrainingLessons.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trainingLessonService } from "../services/trainingLessonService";
import type {
  CreateLessonInput,
  CreateContentBlockInput,
  TrainingLessonContent,
  TrainingLessonWithContent,
} from "../types/training-module.types";
import { useImo } from "@/contexts/ImoContext";
import { toast } from "sonner";
import { trainingModuleKeys } from "./useTrainingModules";
import { quizKeys } from "./useTrainingQuizzes";

// Optimistic patch helper: shallowly merges the input into the matching block
// inside a cached TrainingLessonWithContent payload. Used by
// useUpdateContentBlock's onMutate so the query cache reflects the user's
// in-flight edits before the mutation round-trips, which is what prevents the
// rich-text cursor from resetting while typing.
function patchContentBlock(
  cache: TrainingLessonWithContent | null | undefined,
  blockId: string,
  patch: Partial<CreateContentBlockInput>,
): TrainingLessonWithContent | null | undefined {
  if (!cache) return cache;
  return {
    ...cache,
    content_blocks: cache.content_blocks.map((b) =>
      b.id === blockId ? ({ ...b, ...patch } as TrainingLessonContent) : b,
    ),
  };
}

export const trainingLessonKeys = {
  all: ["training-lessons"] as const,
  byModule: (moduleId: string) =>
    [...trainingLessonKeys.all, "module", moduleId] as const,
  detail: (lessonId: string) =>
    [...trainingLessonKeys.all, "detail", lessonId] as const,
  withContent: (lessonId: string) =>
    [...trainingLessonKeys.all, "content", lessonId] as const,
};

export function useTrainingLessons(moduleId: string | undefined) {
  return useQuery({
    queryKey: trainingLessonKeys.byModule(moduleId!),
    queryFn: () => trainingLessonService.listByModule(moduleId!),
    enabled: !!moduleId,
  });
}

export function useTrainingLessonWithContent(lessonId: string | undefined) {
  return useQuery({
    queryKey: trainingLessonKeys.withContent(lessonId!),
    queryFn: () => trainingLessonService.getWithContent(lessonId!),
    enabled: !!lessonId,
  });
}

export function useCreateTrainingLesson() {
  const queryClient = useQueryClient();
  const { imo } = useImo();

  return useMutation({
    mutationFn: (input: CreateLessonInput) =>
      trainingLessonService.create(input, imo!.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: trainingLessonKeys.byModule(data.module_id),
      });
      queryClient.invalidateQueries({ queryKey: trainingModuleKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateTrainingLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<CreateLessonInput>;
    }) => trainingLessonService.update(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: trainingLessonKeys.byModule(data.module_id),
      });
      queryClient.invalidateQueries({
        queryKey: trainingLessonKeys.withContent(data.id),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteTrainingLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, moduleId }: { id: string; moduleId: string }) =>
      trainingLessonService.delete(id).then(() => moduleId),
    onSuccess: (moduleId) => {
      queryClient.invalidateQueries({
        queryKey: trainingLessonKeys.byModule(moduleId),
      });
      queryClient.invalidateQueries({ queryKey: trainingModuleKeys.all });
      queryClient.invalidateQueries({ queryKey: quizKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useReorderTrainingLessons() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      lessonIds,
      moduleId,
    }: {
      lessonIds: string[];
      moduleId: string;
    }) => trainingLessonService.reorder(lessonIds).then(() => moduleId),
    onSuccess: (moduleId) => {
      queryClient.invalidateQueries({
        queryKey: trainingLessonKeys.byModule(moduleId),
      });
    },
  });
}

export function useCreateContentBlock() {
  const queryClient = useQueryClient();
  const { imo } = useImo();

  return useMutation({
    mutationFn: (input: CreateContentBlockInput) =>
      trainingLessonService.createContentBlock(input, imo!.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: trainingLessonKeys.withContent(data.lesson_id),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateContentBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      lessonId,
      input,
    }: {
      id: string;
      lessonId: string;
      input: Partial<CreateContentBlockInput>;
    }) =>
      trainingLessonService.updateContentBlock(id, input).then(() => lessonId),
    // Optimistic update — keeps the cache in sync with what the user just
    // typed while the mutation is in flight. Without this, onSuccess
    // invalidation would refetch stale-relative-to-typing data and reset the
    // TipTap cursor mid-keystroke (see memory: Typing Glitch Pattern).
    onMutate: async ({ id, lessonId, input }) => {
      const key = trainingLessonKeys.withContent(lessonId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient.getQueryData<TrainingLessonWithContent | null>(key);
      queryClient.setQueryData<TrainingLessonWithContent | null>(
        key,
        (old) => patchContentBlock(old, id, input) ?? null,
      );
      return { previous };
    },
    onError: (error: Error, { lessonId }, context) => {
      if (context && "previous" in context) {
        queryClient.setQueryData(
          trainingLessonKeys.withContent(lessonId),
          context.previous,
        );
      }
      toast.error(error.message);
    },
    // NOTE: Intentionally no onSuccess invalidation. The optimistic patch
    // above already puts the new content in the cache. Invalidating here
    // would trigger a refetch that can race with fast typing and overwrite
    // in-flight edits.
  });
}

export function useDuplicateTrainingLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      lessonId,
      moduleId,
    }: {
      lessonId: string;
      moduleId: string;
    }) =>
      trainingLessonService
        .duplicate(lessonId)
        .then((data) => ({ data, moduleId })),
    onSuccess: ({ moduleId }) => {
      queryClient.invalidateQueries({
        queryKey: trainingLessonKeys.byModule(moduleId),
      });
      queryClient.invalidateQueries({ queryKey: trainingModuleKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteContentBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, lessonId }: { id: string; lessonId: string }) =>
      trainingLessonService.deleteContentBlock(id).then(() => lessonId),
    onSuccess: (lessonId) => {
      queryClient.invalidateQueries({
        queryKey: trainingLessonKeys.withContent(lessonId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
