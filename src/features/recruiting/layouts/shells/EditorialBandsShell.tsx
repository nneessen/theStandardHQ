// src/features/recruiting/layouts/shells/EditorialBandsShell.tsx
//
// The "editorial-bands" layout — a premium, magazine-style "broadsheet". The page
// is a vertical stack of FULL-WIDTH horizontal bands whose surface tone alternates
// (base → a subtle var(--spec-primary) wash → paper) to build editorial rhythm.
// Single-column NATURAL document scroll (ShellRoot), so the lead form flows inline
// and can never clip the viewport. Each band centers an inner max-w container with
// generous vertical padding and editorial hairlines.
//
// Band sequence: header → hero (rendered custom from the hero block) → supporting
// content (stats / value grid) → an ABOUT band with an inset square headshot →
// testimonial pull-quote → the FORM (centered, light card) → footer.

import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import {
  ShellRoot,
  ShellHeader,
  Headshot,
  FormSlot,
  splitFormAndContent,
} from "./shellKit";
import { BlockRenderer } from "../blocks";
import type { ShellProps } from "./types";

/** Alternating full-width band tones. The form band always sits on paper so the
 * form's own dark-on-light chrome stays readable in either mode. */
type BandTone = "base" | "wash" | "paper";

function Band({
  tone,
  mode,
  className = "",
  innerClassName = "",
  topRule = false,
  children,
}: {
  tone: BandTone;
  mode: "light" | "dark";
  className?: string;
  innerClassName?: string;
  /** Draw a hairline along the top edge of the band (editorial separator). */
  topRule?: boolean;
  children: ReactNode;
}) {
  // In dark mode the "base" reads dark; "wash" is a faint primary tint over it.
  const surface =
    tone === "paper"
      ? "surface-paper"
      : mode === "dark"
        ? "surface-dark"
        : "surface-base";
  const washStyle =
    tone === "wash"
      ? {
          backgroundColor:
            mode === "dark"
              ? "color-mix(in srgb, var(--spec-primary) 16%, transparent)"
              : "color-mix(in srgb, var(--spec-primary) 7%, transparent)",
        }
      : undefined;

  return (
    <section
      className={`${surface} relative w-full ${className}`}
      style={washStyle}
    >
      {topRule && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "var(--landing-border)" }}
        />
      )}
      <div
        className={`mx-auto w-full max-w-5xl px-5 sm:px-8 ${innerClassName}`}
      >
        {children}
      </div>
    </section>
  );
}

export function EditorialBandsShell(props: ShellProps) {
  const { spec, theme, ctx, styleVars, mode } = props;
  const { formBlock } = splitFormAndContent(spec);

  const hero = spec.blocks.find((b) => b.type === "hero");
  const about = spec.blocks.find((b) => b.type === "about");
  const footer = spec.blocks.find((b) => b.type === "footer");
  // Everything between the hero and the form/about/footer — stats, value grid,
  // testimonial, cta, contact — streamed into their own alternating bands.
  const middle = spec.blocks.filter(
    (b) =>
      b.type !== "hero" &&
      b.type !== "form" &&
      b.type !== "about" &&
      b.type !== "footer",
  );

  return (
    <ShellRoot
      styleVars={styleVars}
      mode={mode}
      backgroundStyle={spec.theme.background_style}
    >
      {/* HEADER BAND */}
      <Band tone="base" mode={mode} innerClassName="py-5 sm:py-6">
        <ShellHeader ctx={ctx} theme={theme} />
      </Band>

      {/* HERO BAND — big editorial headline left, supporting text + CTA */}
      {hero && hero.type === "hero" && (
        <Band
          tone="base"
          mode={mode}
          topRule
          innerClassName="py-16 sm:py-20 lg:py-28"
        >
          <div className="flex flex-col gap-7 lg:max-w-[20ch]">
            {hero.eyebrow && (
              <div className="flex items-center gap-3">
                <span
                  className="h-px w-10"
                  style={{ background: "var(--spec-primary)" }}
                />
                <span
                  className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em]"
                  style={{ color: "var(--spec-primary)" }}
                >
                  {hero.eyebrow}
                </span>
              </div>
            )}
            <h1 className="text-display-3xl" style={{ maxWidth: "16ch" }}>
              {hero.headline}
            </h1>
          </div>
          {(hero.subhead ||
            hero.primary_cta ||
            hero.secondary_cta === "book_call") && (
            <div className="mt-8 flex flex-col gap-7 border-t border-[var(--landing-border)] pt-8 lg:flex-row lg:items-end lg:justify-between">
              {hero.subhead && (
                <p className="text-fluid-lg text-muted max-w-[52ch] leading-relaxed">
                  {hero.subhead}
                </p>
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
                  {hero.primary_cta || ctx.ctaText}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                {hero.secondary_cta === "book_call" && ctx.calendlyUrl && (
                  <button
                    type="button"
                    onClick={ctx.onBookCall}
                    className="btn btn-secondary btn-lg"
                  >
                    Schedule a Call
                  </button>
                )}
              </div>
            </div>
          )}
        </Band>
      )}

      {/* SUPPORTING BANDS — stats / value grid / testimonial / cta / contact */}
      {middle.map((block, i) => (
        <Band
          key={block.id}
          tone={i % 2 === 0 ? "wash" : "base"}
          mode={mode}
          topRule
          innerClassName="py-14 sm:py-18 lg:py-24"
        >
          <BlockRenderer block={block} ctx={ctx} />
        </Band>
      ))}

      {/* ABOUT BAND — inset square headshot beside the about copy */}
      {about && about.type === "about" && (
        <Band
          tone="paper"
          mode={mode}
          topRule
          innerClassName="py-14 sm:py-18 lg:py-24"
        >
          <div
            className={`grid gap-10 lg:items-start lg:gap-14 ${
              ctx.headshotUrl ? "lg:grid-cols-[260px_1fr]" : "lg:grid-cols-1"
            }`}
          >
            <Headshot
              ctx={ctx}
              shape="square"
              className="aspect-square w-full max-w-[260px] rounded-2xl border border-[var(--landing-border-strong)]"
            />
            <div className="min-w-0">
              <BlockRenderer block={about} ctx={ctx} />
            </div>
          </div>
        </Band>
      )}

      {/* FORM BAND — centered on a light surface so the form chrome reads well */}
      <Band
        tone="paper"
        mode={mode}
        topRule
        innerClassName="py-16 sm:py-20 lg:py-24"
      >
        <div className="mx-auto w-full max-w-2xl">
          <FormSlot formBlock={formBlock} ctx={ctx} theme={theme} />
        </div>
      </Band>

      {/* FOOTER BAND */}
      {footer && footer.type === "footer" && (
        <Band tone="base" mode={mode} topRule innerClassName="py-8 sm:py-10">
          <BlockRenderer block={footer} ctx={ctx} />
        </Band>
      )}
    </ShellRoot>
  );
}

export default EditorialBandsShell;
