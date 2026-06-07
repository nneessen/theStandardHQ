// src/features/recruiting/layouts/index.ts
// Recruiting page layouts. The 4 old hand-built layouts were replaced by the
// AI block composer (AiComposedLayout); NickCustomLayout remains for the
// owner's hard-tuned `the-standard` page.

export { AiComposedLayout } from "./AiComposedLayout";
export { NickCustomLayout } from "./NickCustomLayout";
export type { LayoutProps, ActiveSocialLink } from "./types";
export { getActiveSocialLinks } from "./types";
