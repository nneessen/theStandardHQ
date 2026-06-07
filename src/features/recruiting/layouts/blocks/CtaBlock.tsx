// src/features/recruiting/layouts/blocks/CtaBlock.tsx
import { ArrowRight } from "lucide-react";
import type { CtaBlock as CtaBlockData } from "@/types/recruiting-design-spec.types";
import type { BlockRenderContext } from "./types";

export function CtaBlock({
  block,
  ctx,
}: {
  block: CtaBlockData;
  ctx: BlockRenderContext;
}) {
  // If the spec asks to "book a call" but the recruiter has no Calendly URL, fall
  // back to opening the form — and DON'T keep a "Schedule a Call" label (that
  // would promise a booking flow the click won't deliver).
  const wantsBook = block.action === "book_call";
  const canBook = wantsBook && !!ctx.calendlyUrl;
  const onClick = canBook ? ctx.onBookCall : ctx.onOpenForm;
  const label = canBook
    ? block.button_text || "Schedule a Call"
    : wantsBook
      ? ctx.ctaText
      : block.button_text || ctx.ctaText;
  return (
    <section
      className="rounded-[var(--landing-radius)] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      style={{
        background: "var(--spec-primary)",
        color: "var(--spec-primary-fg)",
      }}
    >
      <h3
        className="font-display font-black uppercase tracking-tight text-2xl leading-none"
        style={{ color: "var(--spec-primary-fg)" }}
      >
        {block.headline}
      </h3>
      <button
        type="button"
        onClick={onClick}
        className="btn btn-lg shrink-0"
        style={{
          background: "var(--spec-accent)",
          color: "var(--spec-accent-fg)",
          borderColor: "var(--spec-accent)",
        }}
      >
        {label}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}
