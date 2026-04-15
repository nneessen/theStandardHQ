// src/features/training-modules/hooks/usePresentationMarkers.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { presentationMarkerService } from "../services/presentationMarkerService";
import type {
  PresentationMarker,
  PresentationMarkerInsert,
  PresentationMarkerUpdate,
} from "../types/presentation-marker.types";

export const markerKeys = {
  all: ["presentation-markers"] as const,
  bySubmission: (submissionId: string) =>
    [...markerKeys.all, "submission", submissionId] as const,
};

export function usePresentationMarkers(submissionId: string | undefined) {
  return useQuery({
    queryKey: markerKeys.bySubmission(submissionId || ""),
    queryFn: () => presentationMarkerService.listBySubmission(submissionId!),
    enabled: !!submissionId,
    staleTime: 1000 * 30,
  });
}

export function useCreateMarker(submissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PresentationMarkerInsert) =>
      presentationMarkerService.create(input),
    onSuccess: (created) => {
      qc.setQueryData<PresentationMarker[]>(
        markerKeys.bySubmission(submissionId),
        (prev) => {
          const list = prev ? [...prev, created] : [created];
          return list.sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
        },
      );
    },
  });
}

export function useUpdateMarker(submissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: PresentationMarkerUpdate;
    }) => presentationMarkerService.update(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<PresentationMarker[]>(
        markerKeys.bySubmission(submissionId),
        (prev) =>
          prev
            ? prev
                .map((m) => (m.id === updated.id ? updated : m))
                .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
            : [updated],
      );
    },
  });
}

export function useDeleteMarker(submissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => presentationMarkerService.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({
        queryKey: markerKeys.bySubmission(submissionId),
      });
      const prev = qc.getQueryData<PresentationMarker[]>(
        markerKeys.bySubmission(submissionId),
      );
      qc.setQueryData<PresentationMarker[]>(
        markerKeys.bySubmission(submissionId),
        (curr) => (curr ? curr.filter((m) => m.id !== id) : []),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(markerKeys.bySubmission(submissionId), ctx.prev);
      }
    },
  });
}
