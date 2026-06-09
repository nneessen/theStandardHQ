// src/features/call-reviews/hooks/useCallLibrary.ts
// IMO-wide call library + single-recording + signed-URL + retry/re-analyze hooks.
// Reads are IMO-wide (RLS widened in 20260609074223). Writes (retry/analyze) are
// edge-function invocations under the user JWT.

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export interface CallLibraryData {
  recordings: CallRecordingRow[];
  agentNames: Record<string, string>;
}

async function fetchLibrary(): Promise<CallLibraryData> {
  const { data, error } = await supabase
    .from("kpi_call_recordings")
    .select("*")
    .order("call_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const recordings = (data ?? []) as CallRecordingRow[];

  // Resolve agent display names (agent_id → user_profiles). agent_id references
  // auth.users, so there's no PostgREST embed — one extra scoped query.
  const agentIds = Array.from(new Set(recordings.map((r) => r.agent_id)));
  const agentNames: Record<string, string> = {};
  if (agentIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", agentIds);
    for (const p of profiles ?? []) {
      const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
      agentNames[p.id] = name || "Unknown agent";
    }
  }
  return { recordings, agentNames };
}

export function useCallLibrary() {
  const { imoId } = useKpiIdentity();
  return useQuery({
    queryKey: callReviewKeys.library(imoId ?? "none"),
    queryFn: fetchLibrary,
    enabled: !!imoId,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchInterval: (query) => {
      const data = query.state.data as CallLibraryData | undefined;
      return data?.recordings.some((r) => isSettling(r)) ? 5_000 : false;
    },
  });
}

async function fetchRecording(id: string): Promise<CallRecordingRow | null> {
  const { data, error } = await supabase
    .from("kpi_call_recordings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CallRecordingRow | null) ?? null;
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

/** Run (or re-run) the AI analysis pass on a completed transcript. */
export function useAnalyzeCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recordingId: string) => {
      const { error } = await supabase.functions.invoke(
        "analyze-call-transcript",
        { body: { recording_id: recordingId } },
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

/** Distinct agents present in the library (for the agent filter). */
export function useLibraryAgents(
  data: CallLibraryData | undefined,
): AgentName[] {
  return useMemo(() => {
    if (!data) return [];
    const ids = Array.from(new Set(data.recordings.map((r) => r.agent_id)));
    return ids
      .map((id) => ({ id, name: data.agentNames[id] ?? "Unknown agent" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
}
