// src/features/recruiting/layouts/blocks/FormBlock.tsx
//
// Renders the cosmetic chrome around LeadInterestForm. The form fields and the
// legally-required TCPA consent live ENTIRELY inside LeadInterestForm and are
// never authored by the design spec — this block only supplies heading copy.

import type { FormBlock as FormBlockData } from "@/types/recruiting-design-spec.types";
import type { BlockRenderContext } from "./types";
import { LeadInterestForm } from "../../components/public/LeadInterestForm";

export function FormBlock({
  block,
  ctx,
}: {
  block: FormBlockData;
  ctx: BlockRenderContext;
}) {
  return (
    <section id="lead-form" className="scroll-mt-6">
      {block.eyebrow && (
        <div className="section-eyebrow-row !mb-4">
          <span className="section-eyebrow-line" />
          <span className="section-eyebrow-label">{block.eyebrow}</span>
        </div>
      )}
      <h2 className="text-display-xl mb-2">
        {block.heading || "Express Your Interest"}
      </h2>
      {block.subcopy && (
        <p className="text-fluid-base text-muted mb-6">{block.subcopy}</p>
      )}
      <LeadInterestForm
        recruiterSlug={ctx.recruiterId}
        onSuccess={ctx.onFormSuccess}
        ctaText={block.cta_text || ctx.ctaText}
        primaryColor={ctx.palette.primary}
      />
    </section>
  );
}
