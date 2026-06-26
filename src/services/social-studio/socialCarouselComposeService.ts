// src/services/social-studio/socialCarouselComposeService.ts
// Thin client for the social-carousel-compose edge function. Two calls:
//   • composeCarousel()        — one idea → a whole ordered deck (slides + caption)
//   • generateCarouselCaption() — an existing deck's slides → a deck-aware caption
// In the service layer so the feature/UI never calls supabase.functions directly. Mirrors
// socialMarketingCopyService + socialCaptionService.

import { supabase } from "../base/supabase";
import type { MarketingVariant } from "@/features/social-cards";
import type { SocialView } from "@/features/social-studio/types";
import type { DeckSlideSpec } from "./socialDeckService";

// Reuse the canonical types instead of redeclaring the string unions (review #15: avoids
// drift if a new variant/view is ever added).
export type ComposeVariant = MarketingVariant;
export type ComposeView = SocialView;

/** One AI-composed slide IS a DeckSlideSpec (data slide = just a view, the app fills its live
 *  numbers; marketing slide = AI-written copy). The AI never writes metrics or images. */
export type ComposedSlide = DeckSlideSpec;

export interface ComposeCarouselRequest {
  /** What the carousel is about — the single steer the whole deck is built from. */
  idea: string;
  /** Exact number of slides to build (server clamps to Instagram's 2–10). */
  slideCount: number;
  agencyName: string;
  network?: string;
  /** Allow real-person attributed quotes (default off → quote attributions blanked). */
  allowRealAttribution?: boolean;
  /** Allow the AI to insert live-metric data slides (default on). */
  allowDataSlides?: boolean;
  /** Views that currently have data, so the AI won't pick an empty one. */
  availableViews?: ComposeView[];
}

export interface ComposeCarouselResult {
  slides: ComposedSlide[];
  caption: string;
}

/** A compact descriptor of one already-built slide, for caption-only generation. */
export interface CaptionSlideDescriptor {
  view?: ComposeView;
  variant?: ComposeVariant;
  headline?: string;
  text?: string;
  body?: string;
}

export interface GenerateCarouselCaptionRequest {
  agencyName: string;
  network?: string;
  slides: CaptionSlideDescriptor[];
}

/**
 * Ask the edge function to compose a whole carousel from one idea. Throws on transport
 * error or an empty deck so the caller can toast + keep the current deck.
 */
export async function composeCarousel(
  req: ComposeCarouselRequest,
): Promise<ComposeCarouselResult> {
  const { data, error } = await supabase.functions.invoke(
    "social-carousel-compose",
    { body: { mode: "compose", ...req } },
  );
  if (error) throw error;
  const result = data as { slides?: ComposedSlide[]; caption?: string } | null;
  const slides = Array.isArray(result?.slides) ? result.slides : [];
  if (slides.length === 0) throw new Error("empty carousel");
  return {
    slides,
    caption: typeof result?.caption === "string" ? result.caption : "",
  };
}

/**
 * Ask the edge function for a deck-aware caption over the current slides. Throws on
 * transport error or an empty caption.
 */
export async function generateCarouselCaption(
  req: GenerateCarouselCaptionRequest,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke(
    "social-carousel-compose",
    { body: { mode: "caption", ...req } },
  );
  if (error) throw error;
  const caption = (data as { caption?: string } | null)?.caption;
  if (typeof caption !== "string" || !caption.trim())
    throw new Error("empty caption");
  return caption;
}
