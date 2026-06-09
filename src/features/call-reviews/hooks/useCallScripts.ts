// src/features/call-reviews/hooks/useCallScripts.ts
// Shared word-track "scripts" for the script panel + per-recording word-track
// detections for the analysis panel. Both reads are IMO-wide.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useKpiIdentity, type WordTrackRow } from "@/features/kpi";
import { callReviewKeys } from "./callReviewKeys";

/** Shared (team/imo) active word tracks — the scripts agents should study. */
async function fetchScripts(imoId: string): Promise<WordTrackRow[]> {
  const { data, error } = await supabase
    .from("kpi_word_tracks")
    .select("*")
    .eq("imo_id", imoId)
    .eq("is_active", true)
    .in("scope", ["team", "imo"])
    .order("category", { ascending: true })
    .order("priority", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WordTrackRow[];
}

export function useCallScripts() {
  const { imoId } = useKpiIdentity();
  return useQuery({
    queryKey: callReviewKeys.scripts(imoId ?? "none"),
    queryFn: () => fetchScripts(imoId as string),
    enabled: !!imoId,
    staleTime: 5 * 60_000,
  });
}

export interface RecordingDetection {
  id: string;
  word_track_id: string;
  detected_phrase: string;
  time_start_seconds: number | null;
  position_pct: number | null;
  timing_bucket: string | null;
  on_expected_timing: boolean | null;
  led_to_sale: boolean | null;
  word_track: { label: string; category: string } | null;
}

async function fetchDetections(
  recordingId: string,
): Promise<RecordingDetection[]> {
  const { data, error } = await supabase
    .from("kpi_word_track_detections")
    .select(
      "id, word_track_id, detected_phrase, time_start_seconds, position_pct, timing_bucket, on_expected_timing, led_to_sale, word_track:kpi_word_tracks(label, category)",
    )
    .eq("recording_id", recordingId)
    .order("time_start_seconds", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RecordingDetection[];
}

export function useRecordingDetections(recordingId: string | undefined) {
  return useQuery({
    queryKey: callReviewKeys.detections(recordingId ?? "none"),
    queryFn: () => fetchDetections(recordingId as string),
    enabled: !!recordingId,
    staleTime: 30_000,
  });
}
