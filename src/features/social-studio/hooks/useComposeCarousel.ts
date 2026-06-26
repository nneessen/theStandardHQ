// src/features/social-studio/hooks/useComposeCarousel.ts
// Exposes the AI carousel composer + deck-aware caption writer to the carousel builder so
// the component never imports the service/infrastructure layer directly (architecture:
// features → hooks → services). Mirrors useMarketingCopyDraft.

import { useCallback } from "react";
import {
  composeCarousel,
  generateCarouselCaption,
  type ComposeCarouselRequest,
  type ComposeCarouselResult,
  type GenerateCarouselCaptionRequest,
} from "@/services/social-studio";

export type {
  ComposeCarouselRequest,
  ComposeCarouselResult,
  GenerateCarouselCaptionRequest,
};

export function useComposeCarousel() {
  const compose = useCallback(
    (req: ComposeCarouselRequest): Promise<ComposeCarouselResult> =>
      composeCarousel(req),
    [],
  );
  const caption = useCallback(
    (req: GenerateCarouselCaptionRequest): Promise<string> =>
      generateCarouselCaption(req),
    [],
  );
  return { composeCarousel: compose, generateCaption: caption };
}
