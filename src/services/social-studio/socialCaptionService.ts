// src/services/social-studio/socialCaptionService.ts
// Thin client for the generate-social-caption edge function. In the service layer
// so the feature/UI never calls supabase.functions directly.

import { supabase } from "../base/supabase";

export interface CaptionContext {
  view: string;
  agencyName: string;
  network?: string;
  periodLabel: string;
  /** Already reduced to first-name + last-initial by the caller. */
  topAgent?: string;
  /** For AOTW this is the spotlighted agent's OWN premium, not an agency total. */
  totalAP?: number;
  policies?: number;
  /** Optional steer for the copy (e.g. the recruiting pitch for a recruiting post). */
  tone?: string;
}

/**
 * Ask the edge function for one Instagram caption built from the card's context.
 * Throws on transport error or an empty result so the caller can toast + keep the
 * existing caption.
 */
export async function generateSocialCaption(
  ctx: CaptionContext,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke(
    "generate-social-caption",
    { body: ctx },
  );
  if (error) throw error;
  const caption = (data as { caption?: string } | null)?.caption;
  if (!caption) throw new Error("empty caption");
  return caption;
}
