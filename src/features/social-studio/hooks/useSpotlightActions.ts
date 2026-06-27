// src/features/social-studio/hooks/useSpotlightActions.ts
// Imperative Spotlight actions (agent-photo upload/remove, background-image read,
// AI caption generation) exposed through a hook so the page never imports the
// service/infrastructure layer directly (architecture: features → hooks → services).

import { useMemo } from "react";
import {
  uploadAgentPhoto,
  removeAgentPhoto,
  readFileAsDataUrl,
  fetchImageAsDataUrl,
  uploadGeneratedPost,
  uploadCarouselSlides,
  publishToInstagram,
  generateSocialCaption,
  type CaptionContext,
} from "@/services/social-studio";

export type { CaptionContext };

export function useSpotlightActions() {
  // The targets are module-level functions; memoize so the returned object identity
  // is stable across renders.
  return useMemo(
    () => ({
      uploadAgentPhoto,
      removeAgentPhoto,
      readFileAsDataUrl,
      fetchImageAsDataUrl,
      uploadGeneratedPost,
      uploadCarouselSlides,
      publishToInstagram,
      generateCaption: generateSocialCaption,
    }),
    [],
  );
}
