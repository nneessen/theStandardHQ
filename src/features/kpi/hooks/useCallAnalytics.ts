// src/features/kpi/hooks/useCallAnalytics.ts
// Aggregation hooks over kpi_call_recordings + kpi_word_track_detections.
//
// Scope: these power the team-aware analytical sections (states, time-of-day,
// demographics, length, word-tracks, team leaderboard), so — unlike the
// self-scoped daily-metric hooks — they intentionally do NOT pin agent_id and
// let RLS return everything the caller may see (own + downline + IMO admin).
// Aggregation is client-side via the pure helpers in lib/call-analytics.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/base/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { kpiKeys } from "./kpiKeys";
import {
  aggregateCallAnalytics,
  aggregateWordTrackEffectiveness,
  type AnalyticsRecording,
  type CallAnalytics,
  type DetectionRow,
  type TrackMeta,
  type WordTrackEffectiveness,
} from "../lib/call-analytics";
import type { DateRange } from "../types/kpi.types";

const RECORDING_COLS =
  "id, agent_id, call_at, duration_seconds, caller_state, caller_age_band, caller_gender, outcome, premium_amount, policies_count";

/** Inclusive [from 00:00, to 23:59:59.999] bounds for a yyyy-mm-dd range. */
function callAtBounds(range: DateRange): { lo: string; hi: string } {
  return { lo: `${range.from}T00:00:00.000`, hi: `${range.to}T23:59:59.999` };
}

// ─── Call analytics (recordings) ─────────────────────────────────────────────

async function fetchCallAnalytics(range: DateRange): Promise<CallAnalytics> {
  const { lo, hi } = callAtBounds(range);
  const { data, error } = await supabase
    .from("kpi_call_recordings")
    .select(RECORDING_COLS)
    .gte("call_at", lo)
    .lte("call_at", hi)
    .order("call_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AnalyticsRecording[];

  // Resolve display names for the agent leaderboard.
  const agentIds = [...new Set(rows.map((r) => r.agent_id))];
  const names = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: profiles, error: pErr } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name")
      .in("id", agentIds);
    if (pErr) throw new Error(pErr.message);
    for (const p of profiles ?? []) {
      const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      names.set(p.id, name || `Agent ${p.id.slice(0, 4)}`);
    }
  }

  return aggregateCallAnalytics(rows, names);
}

export function useKpiCallAnalytics(range: DateRange) {
  const { user } = useAuth();
  return useQuery({
    queryKey: kpiKeys.callAnalytics(range),
    queryFn: () => fetchCallAnalytics(range),
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

// ─── Word-track effectiveness (detections ⨝ recordings) ──────────────────────

async function fetchWordTrackEffectiveness(
  range: DateRange,
): Promise<WordTrackEffectiveness> {
  const { lo, hi } = callAtBounds(range);

  // 1. In-range recordings (id + outcome) → baseline + sold lookup.
  const { data: recs, error: rErr } = await supabase
    .from("kpi_call_recordings")
    .select("id, outcome")
    .gte("call_at", lo)
    .lte("call_at", hi);
  if (rErr) throw new Error(rErr.message);
  const recordings = recs ?? [];
  const recIds = recordings.map((r) => r.id);
  if (recIds.length === 0) {
    return { rows: [], baseline: 0, totalDetections: 0 };
  }

  // 2. Detections on those recordings.
  const { data: dets, error: dErr } = await supabase
    .from("kpi_word_track_detections")
    .select("recording_id, word_track_id, position_pct, timing_bucket")
    .in("recording_id", recIds);
  if (dErr) throw new Error(dErr.message);
  const detections = (dets ?? []) as DetectionRow[];

  // 3. Track metadata for the detected tracks.
  const trackIds = [...new Set(detections.map((d) => d.word_track_id))];
  let tracks: TrackMeta[] = [];
  if (trackIds.length > 0) {
    const { data: t, error: tErr } = await supabase
      .from("kpi_word_tracks")
      .select("id, label, category")
      .in("id", trackIds);
    if (tErr) throw new Error(tErr.message);
    tracks = (t ?? []) as TrackMeta[];
  }

  return aggregateWordTrackEffectiveness(recordings, detections, tracks);
}

export function useWordTrackEffectiveness(range: DateRange) {
  const { user } = useAuth();
  return useQuery({
    queryKey: kpiKeys.wordTrackEffectiveness(range),
    queryFn: () => fetchWordTrackEffectiveness(range),
    enabled: !!user?.id,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}
