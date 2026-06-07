// src/features/recruiting/layouts/blocks/TestimonialBlock.tsx
import type { TestimonialBlock as TestimonialBlockData } from "@/types/recruiting-design-spec.types";

export function TestimonialBlock({ block }: { block: TestimonialBlockData }) {
  return (
    <section className="relative max-w-[60ch]">
      <span
        className="quote-mark absolute -top-4 -left-1 select-none"
        style={{ color: "var(--spec-accent)" }}
        aria-hidden="true"
      >
        &ldquo;
      </span>
      <blockquote className="relative pl-8 pt-2">
        <p className="text-fluid-lg leading-snug font-display font-medium normal-case tracking-normal whitespace-pre-line">
          {block.quote}
        </p>
        {block.attribution && (
          <footer className="text-eyebrow mt-3">— {block.attribution}</footer>
        )}
      </blockquote>
    </section>
  );
}
