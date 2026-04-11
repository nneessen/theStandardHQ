// src/features/agent-roadmap/components/blocks/ContentBlockView.tsx
//
// Discriminated-union dispatcher — renders the correct view component
// for any RoadmapContentBlock. Used by the agent runner and by the admin
// editor's preview mode.

import type { RoadmapContentBlock } from "../../types/contentBlocks";
import { RichTextBlockView } from "./RichTextBlockView";
import { ImageBlockView } from "./ImageBlockView";
import { VideoBlockView } from "./VideoBlockView";
import { ExternalLinkBlockView } from "./ExternalLinkBlockView";
import { CalloutBlockView } from "./CalloutBlockView";
import { CodeSnippetBlockView } from "./CodeSnippetBlockView";

interface ContentBlockViewProps {
  block: RoadmapContentBlock;
}

export function ContentBlockView({ block }: ContentBlockViewProps) {
  switch (block.type) {
    case "rich_text":
      return <RichTextBlockView block={block} />;
    case "image":
      return <ImageBlockView block={block} />;
    case "video":
      return <VideoBlockView block={block} />;
    case "external_link":
      return <ExternalLinkBlockView block={block} />;
    case "callout":
      return <CalloutBlockView block={block} />;
    case "code_snippet":
      return <CodeSnippetBlockView block={block} />;
    default: {
      // Exhaustiveness check — if a new block type is added to the union
      // without a case here, TS will fail this assignment at compile time.
      const exhaustive: never = block;
      // Unreachable at runtime — if it ever fires, a case above is missing.
      console.warn("Unknown roadmap content block type:", exhaustive);
      return null;
    }
  }
}

/**
 * Render a full content_blocks array in order.
 */
interface ContentBlockListViewProps {
  blocks: RoadmapContentBlock[];
  className?: string;
}

export function ContentBlockListView({
  blocks,
  className = "",
}: ContentBlockListViewProps) {
  if (blocks.length === 0) return null;
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  return (
    <div className={`space-y-3 ${className}`}>
      {sorted.map((block) => (
        <ContentBlockView key={block.id} block={block} />
      ))}
    </div>
  );
}
