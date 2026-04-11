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
// (a) valid types, (b) max lengths, (c) valid http(s) URL format WHEN a URL
// is actually present.
//
// SECURITY: URLs are restricted to http(s) schemes. `z.string().url()` alone
// accepts `javascript:`, `data:`, and `file:` URIs because WHATWG treats them
// as valid URLs. Those schemes become stored XSS vectors the moment a block
// renderer drops the string into an <a href>. The scheme check below is
// load-bearing — do not relax it without updating ExternalLinkBlockView.
// --------------------------------------------------------------------------

const baseBlockShape = {
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
};

/** Allowed URL protocol prefixes — http(s) only. Empty string is also accepted
 *  for fields in "just-created, not yet filled in" state. */
const HTTP_URL_RE = /^https?:\/\//i;

/** Check that a stored URL is safe to render as an href. Use this both in the
 *  validator AND at render time as defense-in-depth. */
export function isSafeExternalUrl(url: string): boolean {
  return url === "" || HTTP_URL_RE.test(url);
}

const optionalUrl = z.string().max(2048).refine(isSafeExternalUrl, {
  message: "URL must start with http:// or https:// (or be empty).",
});

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
 * Translate a zod error into a user-readable sentence (L-8). Zod's default
 * `error.message` is a JSON string of ZodIssue objects, which is unusable
 * in a toast. We pluck the first issue and map common codes to friendly
 * text. If the issue can't be translated, we fall back to zod's own message.
 */
function friendlyZodError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Content block is invalid.";

  // Path: [blockIndex, "data", "fieldName"] — extract the field name
  const field = issue.path[issue.path.length - 1];
  const fieldLabel = typeof field === "string" ? field : "field";

  switch (issue.code) {
    case "invalid_type":
      return `${fieldLabel} has the wrong type.`;
    case "invalid_enum_value":
      return `${fieldLabel} has an invalid value.`;
    case "too_big":
      return `${fieldLabel} is too long.`;
    case "too_small":
      return `${fieldLabel} is required.`;
    case "invalid_union_discriminator":
      return `Unknown content block type.`;
    case "custom":
      // Our .refine() calls produce "custom" issues with a readable message
      return issue.message || `${fieldLabel} is not valid.`;
    default:
      return issue.message || "Content block is invalid.";
  }
}

/**
 * Validate a content_blocks array. Throws with a readable message on failure.
 * Call this before any mutation that writes content_blocks to the DB.
 */
export function validateContentBlocks(blocks: unknown): RoadmapContentBlock[] {
  let parsed: RoadmapContentBlock[];
  try {
    parsed = roadmapContentBlocksSchema.parse(blocks) as RoadmapContentBlock[];
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(friendlyZodError(err));
    }
    throw err;
  }

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

  return parsed;
}
