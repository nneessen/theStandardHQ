// src/features/recruiting/layouts/shells/CoverHeroShell.tsx
//
// The "cover-hero" layout — a bold, editorial CONVERSION page. A full-bleed COVER
// hero (~70svh) uses theme.hero_image_url as a cover background under a dark scrim
// so the overlaid eyebrow + large headline + subhead + circular headshot + CTA all
// stay readable. Below the cover, on a normal surface, the supporting content
// blocks stream into a centered column, then the lead form sits as a prominent
// inline section, then contact + footer.
//
// Composes ShellRoot DIRECTLY (not NaturalScrollShell) because the cover must
// break out of the padded max-w column to bleed edge-to-edge. Single-column,
// natural document scroll — the form flows inline, so it can never clip the
// viewport. Tolerates a missing hero (rich primary fill), headshot, and logo.

import { ArrowRight } from "lucide-react";
import {
  ShellRoot,
  ShellHeader,
  Headshot,
  ContentStream,
  FormSlot,
  splitFormAndContent,
} from "./shellKit";
import type { ShellProps } from "./types";

export function CoverHeroShell(props: ShellProps) {
  const { spec, theme, ctx, styleVars, mode } = props;
  const { formBlock } = splitFormAndContent(props.spec);

  // Hero is rendered by hand (custom cover treatment); the rest excludes BOTH the
  // hero and the form so neither renders twice. Contact + footer are pulled to the
  // very end (after the form) regardless of authored order, so the page reads
  // content → form → contact → footer.
  const hero = spec.blocks.find((b) => b.type === "hero");
  const rest = spec.blocks.filter(
    (b) => b.type !== "hero" && b.type !== "form",
  );
  const isTail = (t: string) => t === "contact" || t === "footer";
  const mainBlocks = rest.filter((b) => !isTail(b.type));
  const tailBlocks = rest.filter((b) => isTail(b.type));

  const heroImage = theme.hero_image_url
    ? encodeURI(theme.hero_image_url)
    : null;

  // The recruiter's circular headshot sits over the cover; tolerate its absence.
  const recruiterName = ctx.recruiterFullName || ctx.displayName;

  // .theme-landing hardcodes h1/eyebrow colors to a DARK token that beats class
  // colors — only an INLINE style overrides it. Over an image we go light; on the
  // image-less fallback we sit on --spec-primary and use its readable foreground.
  const overlayColor = heroImage
    ? "var(--landing-icy-blue)"
    : "var(--spec-primary-fg)";

  const primaryLabel =
    (hero?.type === "hero" && hero.primary_cta) || ctx.ctaText;
  const showSecondary =
    hero?.type === "hero" &&
    hero.secondary_cta === "book_call" &&
    !!ctx.calendlyUrl;

  // In dark mode the below-cover content reads on a dark surface; the form always
  // needs a LIGHT card (LeadInterestForm renders light fields with no surface of
  // its own) — so wrap FormSlot in surface-paper, which also gives the prominent
  // inline-section look the archetype wants.
  const belowSurface = mode === "dark" ? "surface-dark" : "surface-base";

  return (
    <ShellRoot styleVars={styleVars} mode={mode} backgroundStyle="flat">
      {/* ─────────────────── FULL-BLEED COVER HERO ─────────────────── */}
      <section
        className="relative flex min-h-[70svh] flex-col"
        style={{
          color: overlayColor,
          background: heroImage ? undefined : "var(--spec-primary)",
        }}
      >
        {/* Cover image layer */}
        {heroImage && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
        )}
        {/* Dark scrim so overlaid text stays readable on any image. Image-less
            fallback gets a subtle primary→deeper-primary wash instead. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: heroImage
              ? "linear-gradient(180deg, rgba(10,12,14,0.55) 0%, rgba(10,12,14,0.40) 35%, rgba(10,12,14,0.78) 100%)"
              : "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.22) 100%)",
          }}
        />

        {/* Header chrome (logo / wordmark + Agent Login) over the cover */}
        <div className="relative z-10 mx-auto w-full max-w-[1240px] px-5 pt-5 sm:px-8 lg:pt-7">
          <ShellHeader ctx={ctx} theme={theme} />
        </div>

        {/* Overlaid hero copy — pinned toward the bottom for an editorial feel */}
        <div className="relative z-10 mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-end px-5 pb-12 pt-16 sm:px-8 lg:pb-16">
          {hero?.type === "hero" ? (
            <div className="flex max-w-[24ch] flex-col">
              {hero.eyebrow && (
                <div className="mb-5 flex items-center gap-3">
                  <span
                    className="h-px w-9"
                    style={{ background: "currentColor", opacity: 0.7 }}
                  />
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]">
                    {hero.eyebrow}
                  </span>
                </div>
              )}

              <h1 className="text-display-3xl" style={{ color: overlayColor }}>
                {hero.headline}
              </h1>

              {hero.subhead && (
                <p
                  className="text-fluid-lg mt-5 max-w-[46ch]"
                  style={{ opacity: 0.92 }}
                >
                  {hero.subhead}
                </p>
              )}

              {/* Recruiter identity + CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
                {ctx.headshotUrl && (
                  <div className="flex items-center gap-3">
                    <Headshot
                      ctx={ctx}
                      shape="circle"
                      className="h-14 w-14 shrink-0 ring-2 ring-white/70"
                    />
                    <span className="font-mono text-sm font-medium leading-tight">
                      {recruiterName}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={ctx.onOpenForm}
                    className="btn btn-lg"
                    style={{
                      background: "var(--spec-primary)",
                      color: "var(--spec-primary-fg)",
                      borderColor: "var(--spec-primary)",
                    }}
                  >
                    {primaryLabel}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  {showSecondary && (
                    <button
                      type="button"
                      onClick={ctx.onBookCall}
                      className="btn btn-lg"
                      style={{
                        background: "transparent",
                        color: overlayColor,
                        borderColor: "currentColor",
                      }}
                    >
                      Schedule a Call
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Missing hero — keep a usable cover with at least an open-form CTA.
            <div className="flex max-w-[24ch] flex-col">
              <h1 className="text-display-3xl" style={{ color: overlayColor }}>
                {ctx.displayName}
              </h1>
              <button
                type="button"
                onClick={ctx.onOpenForm}
                className="btn btn-lg mt-7 self-start"
                style={{
                  background: "var(--spec-primary)",
                  color: "var(--spec-primary-fg)",
                  borderColor: "var(--spec-primary)",
                }}
              >
                {ctx.ctaText}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────── BELOW THE COVER ─────────────────── */}
      <div className={belowSurface}>
        <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 lg:py-20">
          {mainBlocks.length > 0 && (
            <ContentStream
              blocks={mainBlocks}
              ctx={ctx}
              className="flex flex-col gap-12 lg:gap-16"
            />
          )}

          {/* Lead form — prominent inline section on its own light card. */}
          <div className="surface-paper card mt-12 p-6 sm:p-8 lg:mt-16 lg:p-10">
            <FormSlot formBlock={formBlock} ctx={ctx} theme={theme} />
          </div>

          {tailBlocks.length > 0 && (
            <ContentStream
              blocks={tailBlocks}
              ctx={ctx}
              className="mt-12 flex flex-col gap-8 lg:mt-16"
            />
          )}
        </div>
      </div>
    </ShellRoot>
  );
}

export default CoverHeroShell;
