// src/features/recruiting/layouts/index.ts
// Recruiting page layouts. A validated design spec is rendered by the shell
// dispatcher (RecruitingPageRenderer), which picks one of the layout shells in
// ./shells based on spec.layout (default "split-form"). The legacy hand-built
// layouts and the single AiComposedLayout shell were folded into this system.

export { RecruitingPageRenderer, SHELL_REGISTRY } from "./shells";
export type { ShellProps, ShellComponent } from "./shells";
export type { LayoutProps, ActiveSocialLink } from "./types";
export { getActiveSocialLinks } from "./types";
