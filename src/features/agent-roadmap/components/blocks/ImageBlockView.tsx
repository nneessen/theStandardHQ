// src/features/agent-roadmap/components/blocks/ImageBlockView.tsx
import type { ImageBlock } from "../../types/contentBlocks";

interface ImageBlockViewProps {
  block: ImageBlock;
}

export function ImageBlockView({ block }: ImageBlockViewProps) {
  const { url, alt, caption, width, height } = block.data;

  return (
    <figure className="my-1">
      <img
        src={url}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        className="rounded-md border border-zinc-200 dark:border-zinc-800 max-w-full h-auto"
      />
      {caption && (
        <figcaption className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
