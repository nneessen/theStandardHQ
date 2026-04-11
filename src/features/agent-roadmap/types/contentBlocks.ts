// src/features/agent-roadmap/types/contentBlocks.ts
//
// Discriminated union for roadmap item content blocks.
// Stored as a JSONB array on roadmap_items.content_blocks.
// Validated client-side with zod before every write (see contentBlocksValidator.ts).

export type BlockId = string;

export interface BaseBlock {
  id: BlockId;
  order: number;
}

export interface RichTextBlock extends BaseBlock {
  type: "rich_text";
  data: {
    /** Sanitized HTML from TipTapEditor — TipTap runs sanitizeHtml on every emit */
    html: string;
  };
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  data: {
    /** Public URL from Supabase Storage (roadmap-content bucket) */
    url: string;
    /** Storage path so we can find & delete the object later */
    storagePath: string;
    /** Required for accessibility */
    alt: string;
    caption?: string;
    width?: number;
    height?: number;
  };
}

export type VideoPlatform = "youtube" | "vimeo" | "loom" | "other";

export interface VideoBlock extends BaseBlock {
  type: "video";
  data: {
    url: string;
    platform: VideoPlatform;
    title?: string;
    thumbnailUrl?: string;
  };
}

export interface ExternalLinkBlock extends BaseBlock {
  type: "external_link";
  data: {
    url: string;
    label: string;
    description?: string;
    /** Optional favicon URL (fetched via google s2 service) */
    favicon?: string;
  };
}

export type CalloutVariant = "info" | "warning" | "tip" | "success";

export interface CalloutBlock extends BaseBlock {
  type: "callout";
  data: {
    variant: CalloutVariant;
    title?: string;
    /** Plain text only — no HTML. Keep callouts simple. */
    body: string;
  };
}

export interface CodeSnippetBlock extends BaseBlock {
  type: "code_snippet";
  data: {
    code: string;
    /** Optional language hint (e.g. "bash", "sql") for syntax highlighting */
    language?: string;
    /** Optional label shown above the code block (e.g. "Run this in Terminal") */
    label?: string;
  };
}

export type RoadmapContentBlock =
  | RichTextBlock
  | ImageBlock
  | VideoBlock
  | ExternalLinkBlock
  | CalloutBlock
  | CodeSnippetBlock;

export type RoadmapContentBlockType = RoadmapContentBlock["type"];

export const CONTENT_BLOCK_TYPES: RoadmapContentBlockType[] = [
  "rich_text",
  "image",
  "video",
  "external_link",
  "callout",
  "code_snippet",
];

/**
 * Pretty label for each block type — used by the block type picker menu and
 * any admin UI that needs to render a human-readable name.
 */
export const CONTENT_BLOCK_LABELS: Record<RoadmapContentBlockType, string> = {
  rich_text: "Rich text",
  image: "Image",
  video: "Video",
  external_link: "External link",
  callout: "Callout",
  code_snippet: "Code snippet",
};
