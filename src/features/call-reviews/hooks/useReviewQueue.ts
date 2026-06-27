// src/features/call-reviews/hooks/useReviewQueue.ts
// Admin-only PII review workflow (Call Reviews redaction Phase 3): list the
// recordings awaiting review, approve them for IMO-wide sharing, edit the mute
// spans (re-mute), or reject (keep private). Approve + span edits go through edge
// functions; the DB trigger kpi_call_recordings_redaction_guard is the real
// guarantee, so these hooks are the ergonomic path, not the security boundary.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import { useKpiIdentity } from "@/features/kpi";
import { callReviewKeys } from "./callReviewKeys";
import type { CallLibraryRow } from "./useCallLibrary";

export interface RedactionSpan {
  start: number;
  end: number;
  type?: string;
}

/** Recordings in the acting IMO awaiting PII review (redaction_status='needs_review').
 *  RLS already restricts these to owner/upline/admin; the page is admin-gated too. */
export function useReviewQueue() {
  const { imoId } = useKpiIdentity();
  return useQuery({
    queryKey: callReviewKeys.reviewQueue(imoId ?? "none"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_call_recordings")
        .select("*, call_type:call_type_id(id,name)")
        .eq("imo_id", imoId as string)
        .eq("redaction_status", "needs_review")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as CallLibraryRow[];
    },
    enabled: !!imoId,
    staleTime: 15_000,
    // Muting runs asynchronously on the worker; poll so the Approve button
    // un-gates without a manual refresh once audio_redaction_status flips to done.
    refetchInterval: (query) => {
      const rows = query.state.data as CallLibraryRow[] | undefined;
      const anyMuting = rows?.some(
        (r) =>
          (r as { audio_redaction_status?: string }).audio_redaction_status ===
            "pending" ||
          (r as { audio_redaction_status?: string }).audio_redaction_status ===
            "processing",
      );
      return anyMuting ? 5_000 : false;
    },
  });
}

function invalidateReview(
  queryClient: ReturnType<typeof useQueryClient>,
  imoId: string | null,
  recordingId: string,
) {
  queryClient.invalidateQueries({
    queryKey: callReviewKeys.reviewQueue(imoId ?? "none"),
  });
  queryClient.invalidateQueries({
    queryKey: callReviewKeys.recording(recordingId),
  });
  queryClient.invalidateQueries({ queryKey: callReviewKeys.all });
}

/** Approve a redacted recording for IMO-wide sharing (admin only). The edge fn
 *  re-checks every precondition, flips redaction_status→approved, and purges the
 *  raw original. */
export function useApproveRedaction() {
  const queryClient = useQueryClient();
  const { imoId } = useKpiIdentity();
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { data, error } = await supabase.functions.invoke(
        "approve-call-redaction",
        { body: { recording_id: recordingId } },
      );
      if (error) throw new Error(error.message);
      // The fn returns { ok:false, status } with a 409 for precondition misses;
      // supabase-js only throws on non-2xx, so surface a soft failure too.
      if (data && (data as { ok?: boolean }).ok === false) {
        throw new Error(
          `Not ready to approve (${(data as { status?: string }).status ?? "unknown"}).`,
        );
      }
      return data;
    },
    onSuccess: (_d, recordingId) => {
      toast.success("Recording approved and shared with the team.");
      invalidateReview(queryClient, imoId, recordingId);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Approval failed."),
  });
}

/** Approve many recordings at once (admin only). Calls the approve edge fn per
 *  recording in small concurrent batches and reports per-id success/failure. */
export function useApproveMany() {
  const queryClient = useQueryClient();
  const { imoId } = useKpiIdentity();
  return useMutation({
    mutationFn: async (recordingIds: string[]) => {
      const ok: string[] = [];
      const failed: string[] = [];
      const CHUNK = 5;
      for (let i = 0; i < recordingIds.length; i += CHUNK) {
        const batch = recordingIds.slice(i, i + CHUNK);
        await Promise.all(
          batch.map(async (id) => {
            try {
              const { data, error } = await supabase.functions.invoke(
                "approve-call-redaction",
                { body: { recording_id: id } },
              );
              if (error) throw new Error(error.message);
              if (data && (data as { ok?: boolean }).ok === false) {
                throw new Error(
                  (data as { status?: string }).status ?? "not ready",
                );
              }
              ok.push(id);
            } catch {
              failed.push(id);
            }
          }),
        );
      }
      return { ok, failed };
    },
    onSuccess: (res) => {
      if (res.failed.length === 0) {
        toast.success(
          `Approved ${res.ok.length} recording${res.ok.length === 1 ? "" : "s"}.`,
        );
      } else {
        toast.warning(
          `Approved ${res.ok.length}; ${res.failed.length} not ready — re-mute or retry.`,
        );
      }
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.reviewQueue(imoId ?? "none"),
      });
      queryClient.invalidateQueries({ queryKey: callReviewKeys.all });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Bulk approve failed."),
  });
}

/** Replace the mute spans and re-mute from the raw original (admin only). */
export function useUpdateSpans() {
  const queryClient = useQueryClient();
  const { imoId } = useKpiIdentity();
  return useMutation({
    mutationFn: async (args: {
      recordingId: string;
      spans: RedactionSpan[];
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "update-redaction-spans",
        { body: { recording_id: args.recordingId, spans: args.spans } },
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_d, args) => {
      toast.success("Spans saved — re-muting the audio…");
      invalidateReview(queryClient, imoId, args.recordingId);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not update spans."),
  });
}

/** Retry muting with the CURRENT spans (e.g. after audio_redaction_status='failed'
 *  or to refresh a stale mute) — fires the audio worker via redact-call-audio. */
export function useRemuteAudio() {
  const queryClient = useQueryClient();
  const { imoId } = useKpiIdentity();
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { error } = await supabase.functions.invoke("redact-call-audio", {
        body: { recording_id: recordingId, force: true },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, recordingId) => {
      toast.success("Re-muting the audio…");
      invalidateReview(queryClient, imoId, recordingId);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not start muting."),
  });
}

/** Re-open a rejected recording for review (rejected → needs_review, admin). */
export function useReopenRecording() {
  const queryClient = useQueryClient();
  const { imoId } = useKpiIdentity();
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { error } = await supabase
        .from("kpi_call_recordings")
        .update({ redaction_status: "needs_review" })
        .eq("id", recordingId)
        .eq("redaction_status", "rejected");
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, recordingId) => {
      toast.success("Re-opened for review.");
      invalidateReview(queryClient, imoId, recordingId);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not re-open."),
  });
}

/** Save scrubbed free-text fields (caller_name / notes) before approval. These are
 *  never touched by the redaction pipeline and go IMO-wide on approval. */
export function useScrubFields() {
  const queryClient = useQueryClient();
  const { imoId } = useKpiIdentity();
  return useMutation({
    mutationFn: async (args: {
      recordingId: string;
      caller_name: string | null;
      notes: string | null;
    }) => {
      const { error } = await supabase
        .from("kpi_call_recordings")
        .update({ caller_name: args.caller_name, notes: args.notes })
        .eq("id", args.recordingId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, args) => {
      toast.success("Saved.");
      invalidateReview(queryClient, imoId, args.recordingId);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not save."),
  });
}

/** Reject a recording: keep it private forever (never shared). needs_review →
 *  rejected is a fail-safe transition (it only un-shares), enforced by RLS _rw +
 *  the guard trigger. */
export function useRejectRecording() {
  const queryClient = useQueryClient();
  const { imoId } = useKpiIdentity();
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { error } = await supabase
        .from("kpi_call_recordings")
        .update({ redaction_status: "rejected" })
        .eq("id", recordingId)
        .eq("redaction_status", "needs_review");
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, recordingId) => {
      toast.success("Recording rejected — it stays private.");
      invalidateReview(queryClient, imoId, recordingId);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not reject."),
  });
}
