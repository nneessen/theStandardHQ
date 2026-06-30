// src/types/reel.types.ts
// Types for the Reels feature in Social Studio.

import type { Database } from "./database.types";

// ============================================================================
// Row Types (derived from generated DB types)
// ============================================================================

export type ReelJob = Database["public"]["Tables"]["reel_jobs"]["Row"];
export type ReelClip = Database["public"]["Tables"]["reel_clips"]["Row"];

// ============================================================================
// Status helpers
// ============================================================================

export type ReelJobStatus = "processing" | "ready" | "failed";

// ============================================================================
// Query Key Factory
// ============================================================================

export const reelKeys = {
  all: ["reels"] as const,
  jobs: (imoId: string) => [...reelKeys.all, "jobs", imoId] as const,
  clips: (jobId: string) => [...reelKeys.all, "clips", jobId] as const,
};
