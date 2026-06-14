// src/features/recruiting/layouts/shells/registry.tsx
//
// The shell DISPATCHER. Computes the render context + CSS variables ONCE, then
// picks the trusted shell for spec.layout and renders it. Adding a layout means:
//   1. add the name to LAYOUT_NAMES (client + server validator), and
//   2. add a row here pointing at its shell component.
// An unknown/missing layout falls back to SplitFormShell (back-compat).

import type { CSSProperties } from "react";
import {
  FONT_PAIRING_MAP,
  RADIUS_MAP,
  type RecruitingDesignSpec,
  type LayoutName,
} from "@/types/recruiting-design-spec.types";
import {
  getContrastingTextColor,
  getRecruiterFullName,
} from "@/lib/recruiting-theme";
// eslint-disable-next-line no-restricted-imports -- scoped .theme-landing tokens shared with the public landing page
import "@/features/landing/styles/landing-theme.css";
import type { LayoutProps } from "../types";
import type { BlockRenderContext } from "../blocks";
import type { ShellComponent } from "./types";
import { SplitFormShell } from "./SplitFormShell";
import { CoverHeroShell } from "./CoverHeroShell";
import { CenteredFunnelShell } from "./CenteredFunnelShell";
import { IdentitySidebarShell } from "./IdentitySidebarShell";
import { EditorialBandsShell } from "./EditorialBandsShell";
import { StackedCardShell } from "./StackedCardShell";
import { PosterImpactShell } from "./PosterImpactShell";
import { SplitHeroStackShell } from "./SplitHeroStackShell";

export const SHELL_REGISTRY: Record<LayoutName, ShellComponent> = {
  "split-form": SplitFormShell,
  "cover-hero": CoverHeroShell,
  "centered-funnel": CenteredFunnelShell,
  "identity-sidebar": IdentitySidebarShell,
  "editorial-bands": EditorialBandsShell,
  "stacked-card": StackedCardShell,
  "poster-impact": PosterImpactShell,
  "split-hero-stack": SplitHeroStackShell,
};

export function RecruitingPageRenderer({
  spec,
  theme,
  recruiterId,
  onFormSuccess,
}: LayoutProps & { spec: RecruitingDesignSpec }) {
  const { palette, mode } = spec.theme;

  const styleVars = {
    "--spec-primary": palette.primary,
    "--spec-accent": palette.accent,
    "--spec-primary-fg": getContrastingTextColor(palette.primary),
    "--spec-accent-fg": getContrastingTextColor(palette.accent),
    "--landing-radius": RADIUS_MAP[spec.theme.radius],
    "--landing-font-display": FONT_PAIRING_MAP[spec.theme.font_pairing].display,
    "--landing-font-mono": FONT_PAIRING_MAP[spec.theme.font_pairing].body,
    // Bump the fluid type scale modestly so the public prospect page reads larger.
    "--landing-fs-xs": "clamp(0.8125rem, 0.775rem + 0.25vw, 0.9375rem)",
    "--landing-fs-sm": "clamp(0.9375rem, 0.9rem + 0.25vw, 1.0625rem)",
    "--landing-fs-base": "clamp(1rem, 0.96rem + 0.2vw, 1.125rem)",
    "--landing-fs-lg": "clamp(1.1875rem, 1.1rem + 0.375vw, 1.4375rem)",
  } as CSSProperties;

  const ctx: BlockRenderContext = {
    recruiterId,
    palette,
    displayName: theme.display_name,
    recruiterFullName: getRecruiterFullName(theme),
    logoUrl: theme.logo_light_url || theme.logo_dark_url || null,
    headshotUrl: theme.headshot_url ?? null,
    calendlyUrl: theme.calendly_url,
    supportPhone: theme.support_phone,
    socialLinks: theme.social_links || {},
    ctaText: theme.cta_text || "Apply Now",
    onOpenForm: () =>
      document
        .getElementById("lead-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    onBookCall: () => {
      if (theme.calendly_url)
        window.open(theme.calendly_url, "_blank", "noopener,noreferrer");
    },
    onFormSuccess,
  };

  const Shell = SHELL_REGISTRY[spec.layout] ?? SplitFormShell;
  return (
    <Shell
      spec={spec}
      theme={theme}
      ctx={ctx}
      styleVars={styleVars}
      mode={mode}
    />
  );
}

export default RecruitingPageRenderer;
