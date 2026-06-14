// src/features/recruiting/layouts/shells/SplitHeroStackShell.tsx
//
// The "split-hero-stack" layout ("Spotlight"). A versatile, balanced page:
//   • TOP — a WIDE split hero (lg:grid-cols-2): left = custom eyebrow/headline/
//     subhead/CTAs rendered from the hero block; right = a framed portrait
//     (headshot → hero image → branded panel fallback). Collapses to stacked on
//     mobile.
//   • BELOW — a NARROW centered single-column stack (max-w-3xl) of the remaining
//     content blocks, with the FORM mounted at its authored position, then
//     contact/footer. Natural document scroll (ShellRoot) so nothing clips.
//
// The wide-hero / narrow-stack width contrast is what makes this read as a
// deliberately designed page rather than a templated one.

import { ArrowRight } from "lucide-react";
import { BlockRenderer } from "../blocks";
import { ShellRoot, ShellHeader, Headshot, FormSlot } from "./shellKit";
import type { ShellProps } from "./types";

export function SplitHeroStackShell(props: ShellProps) {
  const { spec, theme, ctx, styleVars, mode } = props;

  const hero = spec.blocks.find((b) => b.type === "hero");
  // Everything except the hero flows in the centered stack, in authored order.
  // The form is special-cased to FormSlot (single-form guarantee + disclaimer);
  // every other block goes through BlockRenderer.
  const stackBlocks = spec.blocks.filter((b) => b.type !== "hero");

  return (
    <ShellRoot
      styleVars={styleVars}
      mode={mode}
      backgroundStyle={spec.theme.background_style}
    >
      <div className={mode === "dark" ? "surface-dark" : ""}>
        {/* ── WIDE HERO BAND ─────────────────────────────────────────── */}
        <div className="mx-auto w-full max-w-6xl px-5 pt-5 sm:px-8 lg:px-10">
          <ShellHeader ctx={ctx} theme={theme} />

          <section className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:gap-14 lg:py-20">
            {/* LEFT — copy */}
            <div className="flex flex-col items-start">
              {hero && hero.type === "hero" ? (
                <>
                  {hero.eyebrow && (
                    <div className="mb-6 flex items-center gap-3">
                      <span
                        className="h-px w-10"
                        style={{ background: "var(--spec-primary)" }}
                      />
                      <span
                        className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]"
                        style={{ color: "var(--spec-primary)" }}
                      >
                        {hero.eyebrow}
                      </span>
                    </div>
                  )}
                  <h1 className="text-display-3xl">{hero.headline}</h1>
                  {hero.subhead && (
                    <p className="text-fluid-lg text-muted mt-5 max-w-[46ch]">
                      {hero.subhead}
                    </p>
                  )}
                  <div className="mt-8 flex flex-wrap items-center gap-3">
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
                </>
              ) : (
                // Tolerate a missing hero — fall back to the display name.
                <h1 className="text-display-3xl">{ctx.displayName}</h1>
              )}
            </div>

            {/* RIGHT — framed portrait / branded panel */}
            <div className="order-first lg:order-none">
              <HeroPortrait props={props} />
            </div>
          </section>
        </div>

        {/* ── NARROW CONTENT + FORM STACK ────────────────────────────── */}
        <div className="mx-auto w-full max-w-3xl px-5 pb-16 sm:px-8 lg:pb-24">
          <div className="flex flex-col gap-10 lg:gap-14">
            {stackBlocks.map((block) =>
              block.type === "form" ? (
                <FormSlot
                  key={block.id}
                  formBlock={block}
                  ctx={ctx}
                  theme={theme}
                />
              ) : (
                <BlockRenderer key={block.id} block={block} ctx={ctx} />
              ),
            )}
          </div>
        </div>
      </div>
    </ShellRoot>
  );
}

/**
 * The hero's right column: framed headshot → hero image → branded panel. Always
 * holds a 4:5 frame so the split looks intentional even with no recruiter asset.
 */
function HeroPortrait({ props }: { props: ShellProps }) {
  const { ctx, theme } = props;

  if (ctx.headshotUrl) {
    return (
      <div
        className="overflow-hidden border border-[var(--landing-border-strong)]"
        style={{ borderRadius: "var(--landing-radius)" }}
      >
        <Headshot ctx={ctx} shape="square" className="aspect-[4/5] w-full" />
      </div>
    );
  }

  if (theme.hero_image_url) {
    return (
      <div
        className="aspect-[4/5] w-full overflow-hidden border border-[var(--landing-border-strong)] bg-cover bg-center"
        style={{
          borderRadius: "var(--landing-radius)",
          backgroundImage: `url(${encodeURI(theme.hero_image_url)})`,
        }}
      />
    );
  }

  // Branded fallback — primary block with the display name + a hairline accent.
  return (
    <div
      className="relative flex aspect-[4/5] w-full flex-col justify-end overflow-hidden p-7"
      style={{
        borderRadius: "var(--landing-radius)",
        background: "var(--spec-primary)",
        color: "var(--spec-primary-fg)",
      }}
    >
      <div className="topo-grid pointer-events-none absolute inset-0 opacity-20" />
      <span
        className="relative font-mono text-[11px] font-semibold uppercase tracking-[0.22em] opacity-70"
        style={{ color: "var(--spec-primary-fg)" }}
      >
        {ctx.displayName}
      </span>
      <span className="text-display-2xl relative mt-3 leading-[0.95]">
        Now Building Our Team
      </span>
    </div>
  );
}

export default SplitHeroStackShell;
