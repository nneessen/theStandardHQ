// src/features/agent-roadmap/services/contentBlocksValidator.ts
//
// Zod schemas mirroring the RoadmapContentBlock discriminated union.
// Used to validate content_blocks arrays before every write. A failure here
// rejects the mutation and shows a toast — we never let malformed JSONB
// into the database.

import { z } from "zod";
import type { RoadmapContentBlock } from "../types/contentBlocks";
import {
  MAX_CONTENT_BLOCKS_PER_ITEM,
  MAX_CONTENT_BLOCKS_PAYLOAD_BYTES,
} from "../constants";

// --------------------------------------------------------------------------
// The validator intentionally accepts "empty" block payloads. Blocks are
// authored live — users add a new block (which starts with blank text/URL
// fields) and fill it in afterwards. Rejecting empty strings here would
// block the editor from persisting the just-created block. We only enforce
// (a) valid types, (b) max lengths, (c) valid URL format WHEN a URL is
// actually present.
// --------------------------------------------------------------------------

const baseBlockShape = {
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
};

/** Accept either an empty string or a valid URL. */
const optionalUrl = z.string().url().or(z.literal(""));

const richTextBlockSchema = z.object({
  ...baseBlockShape,
  type: z.literal("rich_text"),
  data: z.object({
    // HTML is already sanitized by TipTapEditor before reaching here;
    // we still enforce a max length to prevent pathological payloads.
    html: z.string().max(100_000),
  }),
});

const imageBlockSchema = z.object({
  ...baseBlockShape,
  type: z.literal("image"),
  data: z.object({
    url: optionalUrl,
    storagePath: z.string(),
    alt: z.string().max(500),
    caption: z.string().max(1000).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
});

const videoBlockSchema = z.object({
  ...baseBlockShape,
  type: z.literal("video"),
  data: z.object({
    url: optionalUrl,
    platform: z.enum(["youtube", "vimeo", "loom", "other"]),
    title: z.string().max(300).optional(),
    thumbnailUrl: optionalUrl.optional(),
  }),
});

const externalLinkBlockSchema = z.object({
  ...baseBlockShape,
  type: z.literal("external_link"),
  data: z.object({
    url: optionalUrl,
    label: z.string().max(300),
    description: z.string().max(1000).optional(),
    favicon: optionalUrl.optional(),
  }),
});

const calloutBlockSchema = z.object({
  ...baseBlockShape,
  type: z.literal("callout"),
  data: z.object({
    variant: z.enum(["info", "warning", "tip", "success"]),
    title: z.string().max(200).optional(),
    body: z.string().max(2000),
  }),
});

const codeSnippetBlockSchema = z.object({
  ...baseBlockShape,
  type: z.literal("code_snippet"),
  data: z.object({
    code: z.string().max(10_000),
    language: z.string().max(50).optional(),
    label: z.string().max(200).optional(),
  }),
});

export const roadmapContentBlockSchema = z.discriminatedUnion("type", [
  richTextBlockSchema,
  imageBlockSchema,
  videoBlockSchema,
  externalLinkBlockSchema,
  calloutBlockSchema,
  codeSnippetBlockSchema,
]);

export const roadmapContentBlocksSchema = z
  .array(roadmapContentBlockSchema)
  .max(MAX_CONTENT_BLOCKS_PER_ITEM, {
    message: `Items cannot contain more than ${MAX_CONTENT_BLOCKS_PER_ITEM} content blocks.`,
  });

/**
 * Validate a content_blocks array. Throws with a readable message on failure.
 * Call this before any mutation that writes content_blocks to the DB.
 */
export function validateContentBlocks(blocks: unknown): RoadmapContentBlock[] {
  const parsed = roadmapContentBlocksSchema.parse(blocks);

  // Defense-in-depth: reject payloads over ~500KB. The DB has no limit but
  // bloated tree queries degrade the editor and runner UX. Nick will never
  // hit this in practice.
  const payloadSize = JSON.stringify(parsed).length;
  if (payloadSize > MAX_CONTENT_BLOCKS_PAYLOAD_BYTES) {
    throw new Error(
      `Content blocks payload (${Math.round(payloadSize / 1024)}KB) exceeds ` +
        `the ${Math.round(MAX_CONTENT_BLOCKS_PAYLOAD_BYTES / 1024)}KB limit. ` +
        `Split this item into multiple smaller items.`,
    );
  }

  return parsed as RoadmapContentBlock[];
}
