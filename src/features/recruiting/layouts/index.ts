// src/features/recruiting/layouts/index.ts
// Recruiting page layouts. The old hand-built layouts were replaced by the AI
// block composer (AiComposedLayout), which is now the single source of truth for
// every public recruiting page (validated design spec, or a legacy-theme fallback).

export { AiComposedLayout } from "./AiComposedLayout";
export type { LayoutProps, ActiveSocialLink } from "./types";
export { getActiveSocialLinks } from "./types";
