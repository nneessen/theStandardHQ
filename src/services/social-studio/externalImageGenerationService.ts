// src/services/social-studio/externalImageGenerationService.ts
// Thin client for the generate-social-image edge function (Creatomate render of
// the Agent-of-the-Week card). In the service layer so the feature/UI never calls
// supabase.functions directly. AOTW ONLY — the data-dense leaderboard/recap render
// faithfully IN-HOUSE (modern-screenshot) and are deliberately not sent off-tenant.

import { supabase } from "../base/supabase";

export interface ProImageContext {
  /** First-name + last-initial, exactly as shown on the card ("Marcus W."). */
  agentName: string;
  /** Pre-formatted for display, e.g. "$52,400" (matches the card's usd()). */
  premium: string;
  /** Policy count as a string, e.g. "31". */
  policies: string;
  /** e.g. "WEEK OF JUN 14–20". */
  periodLabel: string;
  agencyName: string;
  network?: string;
  /**
   * PUBLIC https Storage URL of the agent photo (spotlight-assets bucket) — NOT a
   * data: URL. Creatomate fetches it server-side, so it must be publicly reachable.
   */
  photoUrl?: string;
}

/**
 * Render the Agent-of-the-Week graphic via Creatomate and return the finished
 * image URL. Throws on transport error or an empty result so the caller can toast.
 */
export async function generateProAotwImage(
  ctx: ProImageContext,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke(
    "generate-social-image",
    { body: ctx },
  );
  if (error) throw error;
  const url = (data as { url?: string } | null)?.url;
  if (!url) throw new Error("no image url returned");
  return url;
}
