// src/features/training-modules/hooks/useTrainingQuizzes.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trainingQuizService } from "../services/trainingQuizService";
import type {
  CreateQuizInput,
  CreateQuestionInput,
  CreateOptionInput,
  TrainingQuizWithQuestions,
  TrainingQuizQuestion,
} from "../types/training-module.types";
import { useImo } from "@/contexts/ImoContext";
import { toast } from "sonner";
import { trainingLessonKeys } from "./useTrainingLessons";

export const quizKeys = {
  all: ["training-quizzes"] as const,
  byLesson: (lessonId: string) =>
    [...quizKeys.all, "lesson", lessonId] as const,
  attempts: (quizId: string, userId: string) =>
    [...quizKeys.all, "attempts", quizId, userId] as const,
};

// ----------------------------------------------------------------------------
// Optimistic patch helpers (local, pure). Each returns a shallowly-cloned
// TrainingQuizWithQuestions with the requested patch applied at the right
// nesting level. Used by the three update mutations' onMutate handlers to
// keep the query cache in sync with user input while the server catches up.
// ----------------------------------------------------------------------------

type QuizCache = TrainingQuizWithQuestions | null | undefined;

function patchQuiz(
  cache: QuizCache,
  patch: Partial<CreateQuizInput>,
): QuizCache {
  if (!cache) return cache;
  return { ...cache, ...patch } as TrainingQuizWithQuestions;
}

function patchQuestion(
  cache: QuizCache,
  questionId: string,
  patch: Partial<Omit<CreateQuestionInput, "quiz_id">>,
): QuizCache {
  if (!cache) return cache;
  return {
    ...cache,
    questions: cache.questions.map((q) =>
      q.id === questionId ? ({ ...q, ...patch } as TrainingQuizQuestion) : q,
    ),
  };
}

function patchOption(
  cache: QuizCache,
  optionId: string,
  patch: Partial<Omit<CreateOptionInput, "question_id">>,
): QuizCache {
  if (!cache) return cache;
  return {
    ...cache,
    questions: cache.questions.map((q) => ({
      ...q,
      options: (q.options ?? []).map((o) =>
        o.id === optionId ? { ...o, ...patch } : o,
      ),
    })),
  };
}

export function useTrainingQuiz(lessonId: string | undefined) {
  return useQuery({
    queryKey: quizKeys.byLesson(lessonId!),
    queryFn: () => trainingQuizService.getByLessonId(lessonId!),
    enabled: !!lessonId,
  });
}

export function useCreateQuiz() {
  const queryClient = useQueryClient();
  const { imo } = useImo();

  return useMutation({
    mutationFn: (input: CreateQuizInput) =>
      trainingQuizService.createQuiz(input, imo!.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: quizKeys.byLesson(data.lesson_id),
      });
      queryClient.invalidateQueries({
        queryKey: trainingLessonKeys.withContent(data.lesson_id),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      lessonId,
      input,
    }: {
      id: string;
      lessonId: string;
      input: Partial<CreateQuizInput>;
    }) => trainingQuizService.updateQuiz(id, input).then(() => lessonId),
    onMutate: async ({ lessonId, input }) => {
      const key = quizKeys.byLesson(lessonId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient.getQueryData<TrainingQuizWithQuestions | null>(key);
      queryClient.setQueryData<TrainingQuizWithQuestions | null>(
        key,
        (old) => patchQuiz(old, input) ?? null,
      );
      return { previous };
    },
    onError: (error: Error, { lessonId }, context) => {
      if (context && "previous" in context) {
        queryClient.setQueryData(quizKeys.byLesson(lessonId), context.previous);
      }
      toast.error(error.message);
    },
    onSuccess: (lessonId) => {
      queryClient.invalidateQueries({
        queryKey: quizKeys.byLesson(lessonId),
      });
    },
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  const { imo } = useImo();

  return useMutation({
    mutationFn: ({
      input,
      lessonId,
    }: {
      input: CreateQuestionInput;
      lessonId: string;
    }) =>
      trainingQuizService.createQuestion(input, imo!.id).then((q) => ({
        question: q,
        lessonId,
      })),
    onSuccess: ({ lessonId }) => {
      queryClient.invalidateQueries({
        queryKey: quizKeys.byLesson(lessonId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      lessonId,
      input,
    }: {
      id: string;
      lessonId: string;
      input: Partial<Omit<CreateQuestionInput, "quiz_id">>;
    }) => trainingQuizService.updateQuestion(id, input).then(() => lessonId),
    onMutate: async ({ id, lessonId, input }) => {
      const key = quizKeys.byLesson(lessonId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient.getQueryData<TrainingQuizWithQuestions | null>(key);
      queryClient.setQueryData<TrainingQuizWithQuestions | null>(
        key,
        (old) => patchQuestion(old, id, input) ?? null,
      );
      return { previous };
    },
    onError: (error: Error, { lessonId }, context) => {
      if (context && "previous" in context) {
        queryClient.setQueryData(quizKeys.byLesson(lessonId), context.previous);
      }
      toast.error(error.message);
    },
    onSuccess: (lessonId) => {
      queryClient.invalidateQueries({
        queryKey: quizKeys.byLesson(lessonId),
      });
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, lessonId }: { id: string; lessonId: string }) =>
      trainingQuizService.deleteQuestion(id).then(() => lessonId),
    onSuccess: (lessonId) => {
      queryClient.invalidateQueries({
        queryKey: quizKeys.byLesson(lessonId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useCreateOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      input,
      lessonId,
    }: {
      input: CreateOptionInput;
      lessonId: string;
    }) =>
      trainingQuizService.createOption(input).then((o) => ({
        option: o,
        lessonId,
      })),
    onSuccess: ({ lessonId }) => {
      queryClient.invalidateQueries({
        queryKey: quizKeys.byLesson(lessonId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      lessonId,
      input,
    }: {
      id: string;
      lessonId: string;
      input: Partial<Omit<CreateOptionInput, "question_id">>;
    }) => trainingQuizService.updateOption(id, input).then(() => lessonId),
    onMutate: async ({ id, lessonId, input }) => {
      const key = quizKeys.byLesson(lessonId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous =
        queryClient.getQueryData<TrainingQuizWithQuestions | null>(key);
      queryClient.setQueryData<TrainingQuizWithQuestions | null>(
        key,
        (old) => patchOption(old, id, input) ?? null,
      );
      return { previous };
    },
    onError: (error: Error, { lessonId }, context) => {
      if (context && "previous" in context) {
        queryClient.setQueryData(quizKeys.byLesson(lessonId), context.previous);
      }
      toast.error(error.message);
    },
    onSuccess: (lessonId) => {
      queryClient.invalidateQueries({
        queryKey: quizKeys.byLesson(lessonId),
      });
    },
  });
}

export function useDeleteOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, lessonId }: { id: string; lessonId: string }) =>
      trainingQuizService.deleteOption(id).then(() => lessonId),
    onSuccess: (lessonId) => {
      queryClient.invalidateQueries({
        queryKey: quizKeys.byLesson(lessonId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
