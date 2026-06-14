// src/features/recruiting/layouts/shells/StackedCardShell.tsx
//
// The "stacked-card" layout — a modern, approachable page: a centered column on a
// TINTED canvas (a subtle wash of the recruiter's primary over the base surface),
// holding a vertical STACK of distinct rounded cards. Card 1 is a custom hero with
// a circular headshot on top; the remaining content blocks each get their own card;
// the lead FORM is the final card. Single-column natural document scroll — the form
// flows inline, so it can never clip the viewport.

import { ArrowRight } from "lucide-react";
import {
  ShellRoot,
  ShellHeader,
  Headshot,
  FormSlot,
  splitFormAndContent,
} from "./shellKit";
import { BlockRenderer } from "../blocks";
import type { ShellProps } from "./types";

/** A cohesive, tactile card: consistent radius, soft border, subtle shadow. */
const CARD_CLASS =
  "surface-paper rounded-[var(--landing-radius)] border " +
  "border-[var(--landing-border-strong)] shadow-[var(--landing-shadow-card)] " +
  "p-6 sm:p-8 lg:p-10";

export function StackedCardShell(props: ShellProps) {
  const { spec, theme, ctx, styleVars, mode } = props;
  const { formBlock, contentBlocks } = splitFormAndContent(spec);

  // Custom hero (rendered ourselves for a distinct hero CARD).
  const hero = spec.blocks.find((b) => b.type === "hero");
  // Content cards = everything except hero + form + footer (footer renders plainly
  // under the stack — it's page metadata, not a content card).
  const rest = contentBlocks.filter(
    (b) => b.type !== "hero" && b.type !== "footer",
  );
  const footer = contentBlocks.find((b) => b.type === "footer");

  const showSecondary =
    hero &&
    hero.type === "hero" &&
    hero.secondary_cta === "book_call" &&
    !!ctx.calendlyUrl;

  return (
    <ShellRoot
      styleVars={styleVars}
      mode={mode}
      backgroundStyle={spec.theme.background_style}
    >
      {/* Tinted canvas — a soft wash of the recruiter's primary over the base
          surface. Sits above the base, below the z-10 content (ShellRoot wraps
          children in z-10), so the cards read as floating on a colored field. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, var(--spec-primary) ${
            mode === "dark" ? "26%" : "12%"
          }, transparent) 0%, transparent 60%)`,
        }}
      />

      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10 lg:py-14">
        <div className="flex flex-col gap-5 sm:gap-6">
          <ShellHeader ctx={ctx} theme={theme} className="mb-1" />

          {/* CARD 1 — HERO: circular headshot, eyebrow, headline, subhead, CTAs. */}
          {hero && hero.type === "hero" && (
            <section
              className={`${CARD_CLASS} flex flex-col items-center text-center`}
            >
              <Headshot
                ctx={ctx}
                shape="circle"
                className="mb-5 h-24 w-24 border-2 border-[var(--landing-border-strong)] shadow-sm sm:h-28 sm:w-28"
              />

              {hero.eyebrow && (
                <span
                  className="landing-badge-pill mb-4"
                  style={{ color: "var(--spec-primary)" }}
                >
                  {hero.eyebrow}
                </span>
              )}

              <h1 className="text-display-xl font-display">{hero.headline}</h1>

              {hero.subhead && (
                <p className="text-fluid-base text-muted mx-auto mt-4 max-w-[46ch]">
                  {hero.subhead}
                </p>
              )}

              {(hero.primary_cta || showSecondary) && (
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
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
                  {showSecondary && (
                    <button
                      type="button"
                      onClick={ctx.onBookCall}
                      className="btn btn-secondary btn-lg"
                    >
                      Schedule a Call
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* CARDS 2..n — each remaining content block in its own card. */}
          {rest.map((block) => (
            <section key={block.id} className={CARD_CLASS}>
              <BlockRenderer block={block} ctx={ctx} />
            </section>
          ))}

          {/* FINAL CARD — the lead form (always via FormSlot). */}
          {formBlock && (
            <FormSlot
              formBlock={formBlock}
              ctx={ctx}
              theme={theme}
              className={CARD_CLASS}
            />
          )}

          {/* Footer renders plainly beneath the stack (not a card). */}
          {footer && (
            <div className="mt-1 text-center">
              <BlockRenderer block={footer} ctx={ctx} />
            </div>
          )}
        </div>
      </div>
    </ShellRoot>
  );
}

export default StackedCardShell;
