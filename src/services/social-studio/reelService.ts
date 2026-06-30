// src/services/social-studio/reelService.ts
// Thin wrappers for the reels backend: edge functions + direct table reads.

import { supabase } from "../base/supabase";
import type { ReelJob, ReelClip } from "@/types/reel.types";

// ============================================================================
// Job management
// ============================================================================

/**
 * Invoke the generate-reels edge function, which enqueues a vizard job and
 * returns the new reel_jobs row id.
 */
export async function createReelJob(input: {
  url: string;
  maxClipNumber?: number;
  lang?: string;
}): Promise<{ jobId: string }> {
  const { data, error } = await supabase.functions.invoke<{ jobId: string }>(
    "generate-reels",
    { body: input },
  );
  if (error) throw new Error(error.message || "Couldn't start the reel job.");
  if (!data?.jobId) throw new Error("Unexpected response from generate-reels.");
  return { jobId: data.jobId };
}

/** All reel jobs for this agency, newest first. RLS-scoped by imo_id. */
export async function getReelJobs(imoId: string): Promise<ReelJob[]> {
  const { data, error } = await supabase
    .from("reel_jobs")
    .select("*")
    .eq("imo_id", imoId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ============================================================================
// Clip management
// ============================================================================

/** Clips for a given job, sorted by viral_score descending (nulls last). */
export async function getReelClips(jobId: string): Promise<ReelClip[]> {
  const { data, error } = await supabase
    .from("reel_clips")
    .select("*")
    .eq("job_id", jobId)
    .order("viral_score", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Invoke the reels-download edge function, which returns the clip as an mp4
 * Blob. Triggers a browser download.
 */
export async function downloadReelClip(
  clipId: string,
  filename: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("reels-download", {
    body: { clipId },
  });
  if (error) throw new Error(error.message || "Couldn't download the clip.");
  const blob = data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
