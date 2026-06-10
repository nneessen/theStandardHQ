// src/features/call-reviews/hooks/useCallLibrary.ts
// IMO-wide call library + single-recording + signed-URL + retry/re-analyze hooks.
// Reads are IMO-wide (RLS widened in 20260609074223). Writes (retry/analyze) are
// edge-function invocations under the user JWT.

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/services/base/supabase";
import {
  useKpiIdentity,
  recordingStorageService,
  type CallRecordingRow,
} from "@/features/kpi";
import { callReviewKeys, isSettling } from "./callReviewKeys";

export interface AgentName {
  id: string;
  name: string;
}

// ── Server-side paginated library ───────────────────────────────────────────
// The IMO library can hold thousands of recordings, so it is NEVER loaded whole.
// Each page is a server-side .range() slice with every filter/search pushed into
// the query (trigram-indexed ILIKE for search). Signed URLs stay lazy (per row,
// only when a call is actually played) — never signed for a whole list.
export const LIBRARY_PAGE_SIZE = 25;

export interface CallLibraryFilters {
  search: string;
  outcome: string; // "all" | outcome value
  agentId: string; // "all" | agent uuid
  callTypeId: string; // "all" | call type uuid
  showArchived: boolean;
}

export const DEFAULT_LIBRARY_FILTERS: CallLibraryFilters = {
  search: "",
  outcome: "all",
  agentId: "all",
  callTypeId: "all",
  showArchived: false,
};

export type CallLibraryRow = CallRecordingRow & {
  call_type?: { id: string; name: string } | null;
};

// Strip PostgREST .or()/ILIKE control chars so a search string can't break the
// filter expression (the value is interpolated into a server-side filter).
function sanitizeSearch(term: string): string {
  return term
    .trim()
    .replace(/[%,()\\:*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchLibraryPage(
  imoId: string,
  filters: CallLibraryFilters,
  from: number,
): Promise<{ rows: CallLibraryRow[]; nextFrom: number | undefined }> {
  let q = supabase
    .from("kpi_call_recordings")
    .select("*, call_type:call_type_id(id,name)")
    .eq("imo_id", imoId)
    .order("call_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + LIBRARY_PAGE_SIZE - 1);

  if (!filters.showArchived) q = q.is("archived_at", null);
  if (filters.outcome !== "all") q = q.eq("outcome", filters.outcome);
  if (filters.agentId !== "all") q = q.eq("agent_id", filters.agentId);
  if (filters.callTypeId !== "all")
    q = q.eq("call_type_id", filters.callTypeId);

  const term = sanitizeSearch(filters.search);
  if (term) {
    q = q.or(
      `caller_name.ilike.%${term}%,original_filename.ilike.%${term}%,transcript_text.ilike.%${term}%`,
    );
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CallLibraryRow[];
  const nextFrom =
    rows.length === LIBRARY_PAGE_SIZE ? from + LIBRARY_PAGE_SIZE : undefined;
  return { rows, nextFrom };
}

/** Paginated, server-filtered call library (infinite scroll). */
export function useCallLibrary(filters: CallLibraryFilters) {
  const { imoId } = useKpiIdentity();
  return useInfiniteQuery({
    queryKey: callReviewKeys.libraryPaged(imoId ?? "none", filters),
    queryFn: ({ pageParam }) =>
      fetchLibraryPage(imoId as string, filters, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextFrom,
    enabled: !!imoId,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchInterval: (query) => {
      const data = query.state.data as
        | { pages: { rows: CallLibraryRow[] }[] }
        | undefined;
      const anySettling = data?.pages.some((p) =>
        p.rows.some((r) => isSettling(r)),
      );
      return anySettling ? 5_000 : false;
    },
  });
}

/**
 * Bounded roster of the IMO's agents — powers the agent filter dropdown AND
 * agent-name display (agent_id → name). A fixed-size set, NOT derived from the
 * paginated recordings (which only hold one page at a time).
 */
export function useImoAgents(imoIdArg?: string) {
  const { imoId: ctxImoId } = useKpiIdentity();
  const imoId = imoIdArg ?? ctxImoId;
  return useQuery({
    queryKey: callReviewKeys.imoAgents(imoId ?? "none"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .eq("imo_id", imoId as string)
        .order("first_name", { ascending: true });
      if (error) throw new Error(error.message);
      const names: Record<string, string> = {};
      const list: AgentName[] = [];
      for (const p of data ?? []) {
        const name =
          `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
          "Unknown agent";
        names[p.id] = name;
        list.push({ id: p.id, name });
      }
      return { names, list };
    },
    enabled: !!imoId,
    staleTime: 5 * 60_000,
  });
}

/** Archive (soft, reversible) or restore a recording. Governed by the recording
 *  UPDATE RLS (owner / upline / IMO admin / super-admin). */
export function useArchiveRecording() {
  const queryClient = useQueryClient();
  const { userId } = useKpiIdentity();
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase
        .from("kpi_call_recordings")
        .update(
          archive
            ? { archived_at: new Date().toISOString(), archived_by: userId }
            : { archived_at: null, archived_by: null },
        )
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, { archive }) => {
      toast.success(archive ? "Call archived" : "Call restored");
      queryClient.invalidateQueries({ queryKey: callReviewKeys.all });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't archive call"),
  });
}

/** Permanently delete a recording (row + audio object). Governed by the
 *  recording DELETE RLS (owner / upline / IMO admin / super-admin). */
export function useDeleteRecording() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rec: { id: string; storage_path: string }) => {
      // Remove the audio object first (best-effort), then the row.
      await recordingStorageService.remove(rec.storage_path).catch(() => {});
      const { error } = await supabase
        .from("kpi_call_recordings")
        .delete()
        .eq("id", rec.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Call deleted");
      queryClient.invalidateQueries({ queryKey: callReviewKeys.all });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't delete call"),
  });
}

async function fetchRecording(id: string): Promise<CallLibraryRow | null> {
  const { data, error } = await supabase
    .from("kpi_call_recordings")
    .select("*, call_type:call_type_id(id,name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CallLibraryRow | null) ?? null;
}

export function useCallRecording(id: string | undefined) {
  return useQuery({
    queryKey: callReviewKeys.recording(id ?? "none"),
    queryFn: () => fetchRecording(id as string),
    enabled: !!id,
    staleTime: 15_000,
    refetchInterval: (query) =>
      isSettling(query.state.data as CallRecordingRow | undefined)
        ? 5_000
        : false,
  });
}

export function useCallRecordingSignedUrl(storagePath: string | undefined) {
  return useQuery({
    queryKey: callReviewKeys.signedUrl(storagePath ?? "none"),
    queryFn: () => recordingStorageService.getSignedUrl(storagePath as string),
    enabled: !!storagePath,
    staleTime: 50 * 60_000, // URL lives 1h; refresh comfortably before expiry
    gcTime: 60 * 60_000,
  });
}

/** Re-invoke the transcription pipeline (for failed/stalled rows). */
export function useRetryTranscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { error } = await supabase.functions.invoke(
        "transcribe-call-recording",
        { body: { recording_id: recordingId } },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, recordingId) => {
      toast.success("Transcription restarted");
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.recording(recordingId),
      });
      queryClient.invalidateQueries({ queryKey: callReviewKeys.all });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Retry failed"),
  });
}

/** Run (or re-run) the AI analysis pass. User-initiated → force a re-run even
 * if a prior analysis already completed (e.g. after correcting speaker roles). */
export function useAnalyzeCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { error } = await supabase.functions.invoke(
        "analyze-call-transcript",
        { body: { recording_id: recordingId, force: true } },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, recordingId) => {
      toast.success("Analysis started");
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.recording(recordingId),
      });
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.detections(recordingId),
      });
      queryClient.invalidateQueries({ queryKey: callReviewKeys.all });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });
}

/**
 * Persist a corrected speaker→role map (the diarization "first speaker = agent"
 * heuristic can be wrong). Succeeds for the call owner / upline / IMO admin
 * (recording UPDATE RLS); a viewer without write access gets a clear error.
 */
export function useUpdateRoleMap(recordingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roleMap: Record<string, "agent" | "client">) => {
      const { error } = await supabase
        .from("kpi_call_recordings")
        .update({ speaker_role_map: roleMap })
        .eq("id", recordingId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, roleMap) => {
      // Optimistically patch the cached recording so the transcript doesn't flash
      // the old labels between setFlipped(false) and the background refetch.
      queryClient.setQueryData(
        callReviewKeys.recording(recordingId),
        (old: CallRecordingRow | null | undefined) =>
          old ? { ...old, speaker_role_map: roleMap } : old,
      );
      queryClient.invalidateQueries({
        queryKey: callReviewKeys.recording(recordingId),
      });
    },
    onError: (e) =>
      toast.error(
        e instanceof Error
          ? `Couldn't save speaker labels: ${e.message}`
          : "Couldn't save speaker labels",
      ),
  });
}
