// src/features/recruiting/layouts/AiComposedLayout.tsx
//
// Renders a validated RecruitingDesignSpec. Replaces the old hand-built layouts.
//
// VIEWPORT-CORRECT BY CONSTRUCTION (this is what fixes the "form overflows the
// viewport" bug). Desktop (lg+): an h-svh, overflow-hidden, two-pane grid —
// content column and form panel EACH scroll internally via
// `flex-1 min-h-0 overflow-y-auto` (top-aligned, never `items-center`, so tall
// content is always reachable). Mobile: natural document scroll, form inline.
//
// THEMING: the agent's palette / fonts / radius are injected as CSS variables on
// the root; blocks read `var(--spec-*)` for brand accents while inheriting the
// .theme-landing editorial neutrals, so any agent color stays legible.

import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import {
  FONT_PAIRING_MAP,
  RADIUS_MAP,
  type RecruitingDesignSpec,
  type BackgroundStyle,
} from "@/types/recruiting-design-spec.types";
import {
  getContrastingTextColor,
  getRecruiterFullName,
} from "@/lib/recruiting-theme";
// eslint-disable-next-line no-restricted-imports -- scoped .theme-landing tokens shared with the public landing page
import "@/features/landing/styles/landing-theme.css";
import type { LayoutProps } from "./types";
import { BlockRenderer, type BlockRenderContext } from "./blocks";

function Decoration({ style }: { style: BackgroundStyle }) {
  if (style === "flat") return null;
  if (style === "floating-shapes") {
    return (
      <>
        <div className="topo-grid absolute inset-0 pointer-events-none opacity-60" />
        <div
          className="floating-shape floating-shape-1 hidden md:block"
          style={{ top: "-6%", right: "-4%" }}
        />
        <div
          className="floating-shape floating-shape-2 hidden md:block"
          style={{ bottom: "8%", left: "-3%" }}
        />
      </>
    );
  }
  if (style === "lattice") {
    return (
      <>
        <div className="topo-grid absolute inset-0 pointer-events-none" />
        <div
          className="floating-shape floating-shape-ring hidden lg:block"
          style={{ top: "12%", left: "46%" }}
        />
      </>
    );
  }
  return <div className="topo-grid absolute inset-0 pointer-events-none" />;
}

// Header logo height per the recruiter's chosen logo_size (honored from the
// legacy theme; the old layouts scaled the logo, so preserve that intent).
const LOGO_HEADER_HEIGHT: Record<string, number> = {
  small: 28,
  medium: 36,
  large: 48,
  xlarge: 64,
};

export function AiComposedLayout({
  spec,
  theme,
  recruiterId,
  onFormSuccess,
}: LayoutProps & { spec: RecruitingDesignSpec }) {
  const { palette, mode } = spec.theme;
  const logoHeight = LOGO_HEADER_HEIGHT[theme.logo_size ?? "medium"] ?? 36;

  const styleVars = {
    "--spec-primary": palette.primary,
    "--spec-accent": palette.accent,
    "--spec-primary-fg": getContrastingTextColor(palette.primary),
    "--spec-accent-fg": getContrastingTextColor(palette.accent),
    "--landing-radius": RADIUS_MAP[spec.theme.radius],
    "--landing-font-display": FONT_PAIRING_MAP[spec.theme.font_pairing].display,
    "--landing-font-mono": FONT_PAIRING_MAP[spec.theme.font_pairing].body,
  } as CSSProperties;

  const ctx: BlockRenderContext = {
    recruiterId,
    palette,
    displayName: theme.display_name,
    recruiterFullName: getRecruiterFullName(theme),
    logoUrl: theme.logo_light_url || theme.logo_dark_url || null,
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

  // The validator guarantees exactly one form block.
  const formBlock = spec.blocks.find((b) => b.type === "form");
  const contentBlocks = spec.blocks.filter((b) => b.type !== "form");
  const contentSurface = mode === "dark" ? "surface-dark" : "surface-base";

  return (
    <div
      className="theme-landing surface-base relative w-full lg:h-svh lg:overflow-hidden"
      style={styleVars}
      data-mode={mode}
    >
      <Decoration style={spec.theme.background_style} />

      <div className="relative z-10 lg:grid lg:h-full lg:grid-cols-[1.1fr_0.9fr]">
        {/* ============ LEFT / CONTENT (scrolls internally on desktop) ============ */}
        <div
          className={`${contentSurface} relative overflow-hidden lg:flex lg:h-full lg:min-h-0 lg:flex-col`}
        >
          {/* Optional hero background image (honored from the legacy theme). */}
          {theme.hero_image_url && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${encodeURI(theme.hero_image_url)})`,
                opacity: mode === "dark" ? 0.18 : 0.1,
              }}
            />
          )}
          <div className="relative z-10 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
            <div className="flex min-h-full flex-col gap-10 px-5 pt-5 pb-10 sm:px-8 lg:gap-12 lg:px-12 lg:py-10 xl:px-16">
              {/* Header: logo / wordmark + agent login */}
              <header className="flex items-center justify-between gap-4">
                {ctx.logoUrl ? (
                  <img
                    src={ctx.logoUrl}
                    alt={ctx.displayName}
                    className="w-auto object-contain"
                    style={{ height: logoHeight }}
                  />
                ) : (
                  <span
                    className="font-display font-black uppercase tracking-tight text-xl"
                    style={{ color: "var(--spec-primary)" }}
                  >
                    {ctx.displayName}
                  </span>
                )}
                <a
                  href="/login"
                  className="hidden sm:inline-flex landing-badge-pill transition-colors"
                >
                  Agent Login
                  <ArrowRight className="h-3 w-3" />
                </a>
              </header>

              {/* Content blocks, in spec order */}
              <div className="flex flex-1 flex-col justify-center gap-10 lg:gap-12">
                {contentBlocks.map((block) => (
                  <BlockRenderer key={block.id} block={block} ctx={ctx} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ============ RIGHT / FORM PANEL (scrolls internally on desktop) ============ */}
        <aside className="surface-paper lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:border-l lg:border-[var(--landing-border-strong)]">
          <div className="flex flex-col overflow-y-auto p-6 sm:p-8 xl:p-10 lg:min-h-0 lg:flex-1">
            {/* my-auto centers the short multi-step form; if a step is ever tall
                it still scrolls from the top (never clips). */}
            <div className="my-auto w-full">
              {formBlock && <BlockRenderer block={formBlock} ctx={ctx} />}
              {theme.disclaimer_text && (
                <p className="mt-6 text-eyebrow font-mono leading-relaxed opacity-80">
                  {theme.disclaimer_text}
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AiComposedLayout;
