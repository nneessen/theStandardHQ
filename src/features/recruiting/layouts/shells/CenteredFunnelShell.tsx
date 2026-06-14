// src/features/recruiting/layouts/shells/CenteredFunnelShell.tsx
//
// The "centered-funnel" layout: a high-conversion, focused page. A NARROW centered
// column (max-w-xl) holds a circular headshot above a centered eyebrow + headline
// + short subhead + primary CTA, then the lead FORM almost immediately (above the
// fold). Supporting reassurance (value grid + testimonial) and the footer fall
// BELOW the form. Single-column natural document scroll — no pinning, so the form
// can never clip the viewport. Generous whitespace, centered text, very little chrome.
//
// We compose ShellRoot directly (not NaturalScrollShell's default) because this
// archetype needs the form ABOVE the supporting blocks and a custom centered hero
// rather than the generic left-aligned HeroBlock.

import {
  ShellRoot,
  ShellHeader,
  Headshot,
  ContentStream,
  FormSlot,
  splitFormAndContent,
} from "./shellKit";
import type { ShellProps } from "./types";

export function CenteredFunnelShell(props: ShellProps) {
  const { spec, theme, ctx, styleVars, mode } = props;
  const { formBlock } = splitFormAndContent(spec);

  // Custom centered hero (rule 5) — tolerate a missing hero block.
  const heroBlock = spec.blocks.find((b) => b.type === "hero");
  const hero = heroBlock && heroBlock.type === "hero" ? heroBlock : null;

  // Everything else (value_grid / testimonial / contact / footer, …) below the form.
  const rest = spec.blocks.filter(
    (b) => b.type !== "hero" && b.type !== "form",
  );

  return (
    <ShellRoot
      styleVars={styleVars}
      mode={mode}
      backgroundStyle={spec.theme.background_style}
      // Full-bleed dark surface in dark mode (surface-dark wins on the co-classed
      // root); light mode keeps the default surface-base from ShellRoot.
      className={mode === "dark" ? "surface-dark" : ""}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-9 px-5 py-8 sm:px-8 lg:gap-11 lg:py-12">
        <ShellHeader ctx={ctx} theme={theme} />

        {/* Minimal centered hero: headshot → eyebrow → headline → subhead → CTA */}
        {hero && (
          <section className="flex flex-col items-center gap-4 text-center">
            <Headshot
              ctx={ctx}
              shape="circle"
              className="h-24 w-24 ring-1 ring-[var(--landing-border)] sm:h-28 sm:w-28"
            />
            {hero.eyebrow && (
              <span
                className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: "var(--spec-primary)" }}
              >
                {hero.eyebrow}
              </span>
            )}
            <h1 className="text-display-2xl">{hero.headline}</h1>
            {hero.subhead && (
              <p className="text-fluid-base text-muted max-w-[40ch]">
                {hero.subhead}
              </p>
            )}
            {(hero.primary_cta || hero.secondary_cta === "book_call") && (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
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
            )}
          </section>
        )}

        {/* The form, high on the page (above the fold). Rendered ONLY via FormSlot.
            Inline (un-carded) so it reads correctly in BOTH light and dark mode:
            LeadInterestForm's inputs are already light, and in dark mode the form's
            heading sits on the dark surface (readable) — a white card here would
            invert the heading via the .surface-dark h2 descendant rule. */}
        <FormSlot formBlock={formBlock} ctx={ctx} theme={theme} />

        {/* Compact supporting reassurance + footer, below the form. */}
        {rest.length > 0 && (
          <ContentStream
            blocks={rest}
            ctx={ctx}
            className="flex flex-col gap-10 lg:gap-12"
          />
        )}
      </div>
    </ShellRoot>
  );
}

export default CenteredFunnelShell;
