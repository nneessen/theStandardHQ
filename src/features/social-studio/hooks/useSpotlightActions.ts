// src/features/social-studio/hooks/useSpotlightActions.ts
// Imperative Spotlight actions (agent-photo upload/remove, background-image read,
// AI caption generation) exposed through a hook so the page never imports the
// service/infrastructure layer directly (architecture: features → hooks → services).

import { useMemo } from "react";
import {
  uploadAgentPhoto,
  removeAgentPhoto,
  readFileAsDataUrl,
  generateSocialCaption,
  generateProAotwImage,
  type CaptionContext,
  type ProImageContext,
} from "@/services/social-studio";

export type { CaptionContext, ProImageContext };

export function useSpotlightActions() {
  // The targets are module-level functions; memoize so the returned object identity
  // is stable across renders.
  return useMemo(
    () => ({
      uploadAgentPhoto,
      removeAgentPhoto,
      readFileAsDataUrl,
      generateCaption: generateSocialCaption,
      generateProImage: generateProAotwImage,
    }),
    [],
  );
}
