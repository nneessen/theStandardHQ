// src/services/social-studio/socialMarketingCopyService.ts
// Thin client for the social-marketing-copy edge function — AI-drafts the copy for a
// marketing carousel slide (quote / tip / recruiting CTA / custom). In the service layer
// so the feature/UI never calls supabase.functions directly. Mirrors socialCaptionService.

import { supabase } from "../base/supabase";

export type MarketingCopyVariant = "quote" | "tip" | "cta" | "custom";

export interface MarketingCopyRequest {
  variant: MarketingCopyVariant;
  /** Optional user steer, e.g. "milestone: $1M month" or "team growth". */
  topic?: string;
  agencyName: string;
  network?: string;
}

/**
 * Discriminated result — only the requested variant's fields are populated.
 *   quote          → { text, attribution? }
 *   tip|cta|custom → { headline, body }
 * (custom's image is ALWAYS user-supplied, never AI.)
 */
export interface MarketingCopyResult {
  text?: string;
  attribution?: string;
  headline?: string;
  body?: string;
}

/**
 * Ask the edge function to draft the copy fields for one marketing slide. Throws on
 * transport error or an empty result so the caller can toast + keep the existing copy.
 */
export async function generateMarketingCopy(
  req: MarketingCopyRequest,
): Promise<MarketingCopyResult> {
  const { data, error } = await supabase.functions.invoke(
    "social-marketing-copy",
    { body: req },
  );
  if (error) throw error;
  const result = (data as { copy?: MarketingCopyResult } | null)?.copy;
  const hasContent =
    !!result &&
    [result.text, result.headline, result.body].some(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
  if (!hasContent) throw new Error("empty draft");
  return result;
}
