// src/features/recruiting/layouts/blocks/AboutBlock.tsx
import type { AboutBlock as AboutBlockData } from "@/types/recruiting-design-spec.types";

export function AboutBlock({ block }: { block: AboutBlockData }) {
  return (
    <section className="space-y-3 max-w-[60ch]">
      {block.heading && (
        <div className="section-eyebrow-row !mb-0">
          <span className="section-eyebrow-line" />
          <span className="section-eyebrow-label">{block.heading}</span>
        </div>
      )}
      <p className="text-fluid-base leading-relaxed whitespace-pre-line">
        {block.body}
      </p>
    </section>
  );
}
