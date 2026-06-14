// src/features/recruiting/layouts/shells/PosterImpactShell.tsx
//
// The "poster-impact" layout — a HIGH-ENERGY page built like an event flyer /
// movie poster. The first screen is an oversized POSTER: a giant display headline
// on a solid color block (var(--spec-primary)), a punchy subhead, and a big CTA,
// with an optional small headshot tucked in a corner. Below the poster, a tight
// run of supporting blocks (inline stats, value list, cta) then the lead form and
// footer — all in a single NATURAL-scroll column so the form never clips.
//
// Composition rules (see shellKit / scaffolds): the form is mounted ONLY through
// FormSlot; the hero is rendered here from the hero block's data; everything else
// flows through ContentStream. Tolerates a missing hero, headshot, and logo.

import { ArrowRight } from "lucide-react";
import {
  ShellRoot,
  Headshot,
  ContentStream,
  FormSlot,
  splitFormAndContent,
  LOGO_HEADER_HEIGHT,
} from "./shellKit";
import type { ShellProps } from "./types";

export function PosterImpactShell(props: ShellProps) {
  const { spec, theme, ctx, styleVars, mode } = props;
  const { formBlock, contentBlocks } = splitFormAndContent(spec);

  const hero = spec.blocks.find((b) => b.type === "hero");
  // Supporting content sits between the poster and the form (hero is custom-drawn,
  // the form is mounted via FormSlot). The footer is pulled to the very bottom so
  // the running order reads poster → support → form → footer.
  const support = contentBlocks.filter(
    (b) => b.type !== "hero" && b.type !== "footer",
  );
  const footerBlocks = contentBlocks.filter((b) => b.type === "footer");

  // Content beneath the poster reads on a dark surface in dark mode, base in light.
  const bodySurface = mode === "dark" ? "surface-dark" : "surface-base";

  return (
    <ShellRoot
      styleVars={styleVars}
      mode={mode}
      backgroundStyle={spec.theme.background_style}
    >
      {/* ============================ POSTER ============================ */}
      <section
        className="relative isolate overflow-hidden"
        style={{
          background: "var(--spec-primary)",
          color: "var(--spec-primary-fg)",
        }}
      >
        {/* Oversized faint ghost initial in the corner for poster energy. */}
        <span
          aria-hidden="true"
          className="font-display pointer-events-none absolute -right-6 -top-16 select-none leading-none opacity-[0.08] sm:-top-24"
          style={{
            fontSize: "clamp(14rem, 34vw, 30rem)",
            color: "var(--spec-primary-fg)",
          }}
        >
          {(ctx.displayName?.trim()?.[0] ?? "A").toUpperCase()}
        </span>

        <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-6xl flex-col px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
          {/* Header — a poster-specific header: ShellHeader's wordmark fallback is
              tinted var(--spec-primary), which would vanish on the primary block,
              so the no-logo wordmark is recolored to the contrasting fg here. The
              /login Agent Login affordance is preserved (rule 8). */}
          <header className="flex items-center justify-between gap-4">
            {ctx.logoUrl ? (
              <img
                src={ctx.logoUrl}
                alt={ctx.displayName}
                className="w-auto object-contain"
                style={{
                  height: LOGO_HEADER_HEIGHT[theme.logo_size ?? "medium"] ?? 36,
                }}
              />
            ) : (
              <span
                className="font-display text-xl font-black uppercase tracking-tight"
                style={{ color: "var(--spec-primary-fg)" }}
              >
                {ctx.displayName}
              </span>
            )}
            <a href="/login" className="landing-badge-pill transition-colors">
              Agent Login
              <ArrowRight className="h-3 w-3" />
            </a>
          </header>

          {/* Poster body — headline dominates the first screen. */}
          <div className="flex flex-1 flex-col justify-center py-10 lg:py-14">
            {hero && hero.type === "hero" && (
              <div className="flex flex-col items-start gap-6">
                {hero.eyebrow && (
                  <span
                    className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.28em] opacity-90 sm:text-xs"
                    style={{ color: "var(--spec-primary-fg)" }}
                  >
                    {hero.eyebrow}
                  </span>
                )}

                <h1
                  className="font-display uppercase"
                  style={{
                    fontSize: "clamp(2.5rem, 8vw, 6rem)",
                    lineHeight: 0.86,
                    letterSpacing: "-0.02em",
                    color: "var(--spec-primary-fg)",
                  }}
                >
                  {hero.headline}
                </h1>

                {hero.subhead && (
                  <p
                    className="text-fluid-lg max-w-[40ch] font-medium opacity-95"
                    style={{ color: "var(--spec-primary-fg)" }}
                  >
                    {hero.subhead}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={ctx.onOpenForm}
                    className="btn btn-lg"
                    style={{
                      background: "var(--spec-accent)",
                      color: "var(--spec-accent-fg)",
                      borderColor: "var(--spec-accent)",
                    }}
                  >
                    {hero.primary_cta || ctx.ctaText}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  {hero.secondary_cta === "book_call" && ctx.calendlyUrl && (
                    <button
                      type="button"
                      onClick={ctx.onBookCall}
                      className="btn btn-lg"
                      style={{
                        background: "transparent",
                        color: "var(--spec-primary-fg)",
                        borderColor: "var(--spec-primary-fg)",
                      }}
                    >
                      Schedule a Call
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Headshot tucked in the poster's bottom corner (renders nothing if absent). */}
          <Headshot
            ctx={ctx}
            shape="rounded"
            className="h-16 w-16 self-start border-2 sm:h-20 sm:w-20"
          />
        </div>
      </section>

      {/* ===================== SUPPORTING CONTENT ===================== */}
      {support.length > 0 && (
        <section className={bodySurface}>
          <ContentStream
            blocks={support}
            ctx={ctx}
            className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-5 py-14 sm:px-8 lg:gap-16 lg:px-12 lg:py-20"
          />
        </section>
      )}

      {/* ============================ FORM ============================ */}
      <section className={bodySurface}>
        <div className="mx-auto w-full max-w-2xl px-5 pb-16 sm:px-8 lg:pb-24">
          <div className="surface-paper rounded-[var(--landing-radius)] border border-[var(--landing-border-strong)] p-6 shadow-[var(--landing-shadow-card)] sm:p-8 lg:p-10">
            <FormSlot formBlock={formBlock} ctx={ctx} theme={theme} />
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      {footerBlocks.length > 0 && (
        <section className={bodySurface}>
          <ContentStream
            blocks={footerBlocks}
            ctx={ctx}
            className="mx-auto w-full max-w-5xl px-5 pb-10 sm:px-8 lg:px-12"
          />
        </section>
      )}
    </ShellRoot>
  );
}

export default PosterImpactShell;
