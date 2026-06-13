// src/features/call-reviews/hooks/useCallLikes.ts
// "Heart / like" on a call recording. A like is public and IMO-wide: any agent
// can like any call in their IMO, one like per user per call (toggle = insert to
// like, delete to unlike). The denormalized kpi_call_recordings.like_count (kept
// in sync by a DB trigger) drives the "Most liked" sort; here we only track which
// recordings the CURRENT user has liked (to fill their own hearts) and toggle.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import { useKpiIdentity } from "@/features/kpi";
import { callReviewKeys } from "./callReviewKeys";
import type { CallLibraryRow } from "./useCallLibrary";

type LibraryPage = { rows: CallLibraryRow[]; nextFrom: number | undefined };

/** The set of recording ids the current user has liked. Cheap: a user likes at
 *  most a handful of training calls, so the whole set is fetched once. */
export function useMyLikedRecordingIds() {
  const { imoId, userId } = useKpiIdentity();
  return useQuery({
    queryKey: callReviewKeys.myLikes(imoId ?? "none", userId ?? "none"),
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("kpi_call_likes")
        .select("recording_id")
        .eq("user_id", userId as string);
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((r) => r.recording_id));
    },
    enabled: !!imoId && !!userId,
    staleTime: 60_000,
  });
}

/** Adjust the cached like_count for one recording everywhere it's displayed —
 *  every cached library page (across all filter/sort combos) and the single
 *  recording detail query — so the count moves instantly with the heart. */
function patchCachedLikeCount(
  queryClient: ReturnType<typeof useQueryClient>,
  recordingId: string,
  delta: number,
) {
  // All paginated library caches (key prefix: ["call-reviews","library",...]).
  queryClient.setQueriesData<InfiniteData<LibraryPage>>(
    { queryKey: [...callReviewKeys.all, "library"] },
    (old) => {
      // Only the paginated (InfiniteData) library caches live under this prefix;
      // guard anyway so a future non-infinite query here can't throw on .pages.
      if (!old || !Array.isArray(old.pages)) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          rows: page.rows.map((r) =>
            r.id === recordingId
              ? { ...r, like_count: Math.max(0, (r.like_count ?? 0) + delta) }
              : r,
          ),
        })),
      };
    },
  );
  // The single-recording (detail page) cache.
  queryClient.setQueryData<CallLibraryRow | null>(
    callReviewKeys.recording(recordingId),
    (old) =>
      old
        ? { ...old, like_count: Math.max(0, (old.like_count ?? 0) + delta) }
        : old,
  );
}

/** Toggle the current user's like on a recording. Optimistically flips the heart
 *  (my-likes set) and bumps the visible count; rolls back on error; reconciles
 *  with the server on settle. */
export function useToggleLike() {
  const queryClient = useQueryClient();
  const { imoId, userId } = useKpiIdentity();
  const myLikesKey = callReviewKeys.myLikes(imoId ?? "none", userId ?? "none");

  return useMutation({
    mutationFn: async ({
      recordingId,
      liked,
    }: {
      recordingId: string;
      liked: boolean;
    }) => {
      if (!userId) throw new Error("Not signed in");
      if (liked) {
        // Unlike: delete my row (RLS allows deleting only my own like).
        const { error } = await supabase
          .from("kpi_call_likes")
          .delete()
          .eq("recording_id", recordingId)
          .eq("user_id", userId);
        if (error) throw new Error(error.message);
      } else {
        // Like: imo_id is filled by the DB trigger; unique constraint makes a
        // double-like a harmless conflict.
        const { error } = await supabase
          .from("kpi_call_likes")
          .insert({ recording_id: recordingId, user_id: userId });
        if (error && error.code !== "23505") throw new Error(error.message);
      }
    },
    onMutate: async ({ recordingId, liked }) => {
      await queryClient.cancelQueries({ queryKey: myLikesKey });
      const prevSet = queryClient.getQueryData<Set<string>>(myLikesKey);
      const next = new Set(prevSet ?? []);
      if (liked) next.delete(recordingId);
      else next.add(recordingId);
      queryClient.setQueryData(myLikesKey, next);
      patchCachedLikeCount(queryClient, recordingId, liked ? -1 : 1);
      return { prevSet, recordingId, liked };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prevSet) queryClient.setQueryData(myLikesKey, ctx.prevSet);
      if (ctx)
        patchCachedLikeCount(queryClient, ctx.recordingId, ctx.liked ? 1 : -1);
      toast.error(err instanceof Error ? err.message : "Couldn't update like");
    },
    onSettled: (_d, _e, { recordingId }) => {
      // Reconcile heart membership and the authoritative count with the server.
      queryClient.invalidateQueries({ queryKey: myLikesKey });
      queryClient.invalidateQueries({
        queryKey: [...callReviewKeys.all, "library"],
      });
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.recording(recordingId),
      });
    },
  });
}
