// src/features/agent-roadmap/components/blocks/ImageBlockView.tsx
import type { ImageBlock } from "../../types/contentBlocks";

interface ImageBlockViewProps {
  block: ImageBlock;
}

export function ImageBlockView({ block }: ImageBlockViewProps) {
  const { url, alt, caption, width, height } = block.data;

  return (
    <figure className="my-2">
      <div className="overflow-hidden rounded-lg border border-border bg-muted shadow-sm">
        <img
          src={url}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          className="max-w-full h-auto block"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-xs text-muted-foreground italic text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
