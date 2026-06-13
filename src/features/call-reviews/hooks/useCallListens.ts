// src/features/call-reviews/hooks/useCallListens.ts
// "I've listened to this call" marker — a private, per-user read/unread flag on a
// recording. Unlike likes (public, IMO-wide, counted), a listen marker is visible
// only to its owner (RLS is self-scoped), so we only ever fetch/maintain the
// CURRENT user's own set. The marker is created the first time they press play on
// the detail page; presence of the row IS the flag (no counter, no edit).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useKpiIdentity } from "@/features/kpi";
import { callReviewKeys } from "./callReviewKeys";

/** The set of recording ids the current user has listened to. Cheap and fetched
 *  once for the whole library (an agent marks at most a few dozen calls). */
export function useMyListenedRecordingIds() {
  const { imoId, userId } = useKpiIdentity();
  return useQuery({
    queryKey: callReviewKeys.myListens(imoId ?? "none", userId ?? "none"),
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("kpi_call_listens")
        .select("recording_id")
        .eq("user_id", userId as string);
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((r) => r.recording_id));
    },
    enabled: !!imoId && !!userId,
    staleTime: 60_000,
  });
}

/** Mark a recording as listened for the current user. Idempotent: a repeat insert
 *  hits the (recording_id, user_id) unique constraint and is swallowed (23505).
 *  Optimistically fills the marker so the detail page reflects it instantly, and
 *  invalidates the set on settle so the library row updates on navigate-back. */
export function useMarkListened() {
  const queryClient = useQueryClient();
  const { imoId, userId } = useKpiIdentity();
  const myListensKey = callReviewKeys.myListens(
    imoId ?? "none",
    userId ?? "none",
  );

  return useMutation({
    mutationFn: async (recordingId: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("kpi_call_listens")
        .insert({ recording_id: recordingId, user_id: userId });
      // Unique-violation = already marked; that's the success case for a flag.
      if (error && error.code !== "23505") throw new Error(error.message);
    },
    onMutate: async (recordingId) => {
      await queryClient.cancelQueries({ queryKey: myListensKey });
      const prev = queryClient.getQueryData<Set<string>>(myListensKey);
      const next = new Set(prev ?? []);
      next.add(recordingId);
      queryClient.setQueryData(myListensKey, next);
      return { prev };
    },
    onError: (_err, _recordingId, ctx) => {
      // Silent rollback — a failed listen marker must never interrupt playback.
      if (ctx?.prev) queryClient.setQueryData(myListensKey, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: myListensKey });
    },
  });
}
