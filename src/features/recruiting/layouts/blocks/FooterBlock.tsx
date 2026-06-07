// src/features/recruiting/layouts/blocks/FooterBlock.tsx
import type { FooterBlock as FooterBlockData } from "@/types/recruiting-design-spec.types";
import type { BlockRenderContext } from "./types";

export function FooterBlock({
  block,
  ctx,
}: {
  block: FooterBlockData;
  ctx: BlockRenderContext;
}) {
  if (block.show_copyright === false) return null;
  return (
    <footer className="text-eyebrow font-mono opacity-70">
      © {new Date().getFullYear()} {ctx.displayName}
    </footer>
  );
}
