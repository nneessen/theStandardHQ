// src/features/recruiting/layouts/blocks/BlockRenderer.tsx
// Single switch from a validated DesignBlock to its safe React component.
// The `default` branch (unreachable for a validated spec) returns null as
// defense-in-depth against any future/unknown block type.

import type { DesignBlock } from "@/types/recruiting-design-spec.types";
import type { BlockRenderContext } from "./types";
import { HeroBlock } from "./HeroBlock";
import { StatsBlock } from "./StatsBlock";
import { ValueGridBlock } from "./ValueGridBlock";
import { AboutBlock } from "./AboutBlock";
import { TestimonialBlock } from "./TestimonialBlock";
import { FormBlock } from "./FormBlock";
import { CtaBlock } from "./CtaBlock";
import { ContactBlock } from "./ContactBlock";
import { FooterBlock } from "./FooterBlock";

export function BlockRenderer({
  block,
  ctx,
}: {
  block: DesignBlock;
  ctx: BlockRenderContext;
}) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} ctx={ctx} />;
    case "stats":
      return <StatsBlock block={block} />;
    case "value_grid":
      return <ValueGridBlock block={block} />;
    case "about":
      return <AboutBlock block={block} />;
    case "testimonial":
      return <TestimonialBlock block={block} />;
    case "form":
      return <FormBlock block={block} ctx={ctx} />;
    case "cta":
      return <CtaBlock block={block} ctx={ctx} />;
    case "contact":
      return <ContactBlock block={block} ctx={ctx} />;
    case "footer":
      return <FooterBlock block={block} ctx={ctx} />;
    default:
      return null;
  }
}
