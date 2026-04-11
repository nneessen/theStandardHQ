// Unit tests for contentBlocksValidator — focuses on the "just-created empty
// block" case that bit us in production (callout + 4 other types failing
// validation on add because .min(1) rejected empty strings).
//
// These tests exist to make sure we never reintroduce that trap.

import { describe, expect, it } from "vitest";
import { validateContentBlocks } from "../services/contentBlocksValidator";
import { createEmptyBlock } from "../components/blocks/BlockTypePickerMenu";
import type {
  RoadmapContentBlockType,
  RoadmapContentBlock,
} from "../types/contentBlocks";

const EMPTY_BLOCK_TYPES: RoadmapContentBlockType[] = [
  "rich_text",
  "image",
  "video",
  "external_link",
  "callout",
  "code_snippet",
];

describe("validateContentBlocks — freshly-created empty blocks", () => {
  // This loop catches the exact bug the user hit: adding a block with empty
  // text/URL fields should NOT throw. Every newly-created block is born empty
  // because the user fills it in after adding.
  it.each(EMPTY_BLOCK_TYPES)("accepts an empty %s block", (type) => {
    const block = createEmptyBlock(type, 0);
    expect(() => validateContentBlocks([block])).not.toThrow();
  });

  it("accepts an array mixing all six empty block types", () => {
    const blocks = EMPTY_BLOCK_TYPES.map((type, idx) =>
      createEmptyBlock(type, idx),
    );
    expect(() => validateContentBlocks(blocks)).not.toThrow();
  });

  it("accepts an empty array", () => {
    expect(() => validateContentBlocks([])).not.toThrow();
  });
});

describe("validateContentBlocks — populated blocks", () => {
  it("accepts a populated rich_text block", () => {
    const block: RoadmapContentBlock = {
      id: "a",
      order: 0,
      type: "rich_text",
      data: { html: "<p>Hello</p>" },
    };
    expect(() => validateContentBlocks([block])).not.toThrow();
  });

  it("accepts a populated image block with a valid URL", () => {
    const block: RoadmapContentBlock = {
      id: "a",
      order: 0,
      type: "image",
      data: {
        url: "https://example.com/image.png",
        storagePath: "agency/roadmap/item/uuid-filename.png",
        alt: "Example",
      },
    };
    expect(() => validateContentBlocks([block])).not.toThrow();
  });

  it("accepts a populated callout block with title and body", () => {
    const block: RoadmapContentBlock = {
      id: "a",
      order: 0,
      type: "callout",
      data: { variant: "tip", title: "Heads up", body: "Do this first" },
    };
    expect(() => validateContentBlocks([block])).not.toThrow();
  });
});

describe("validateContentBlocks — rejects malformed input", () => {
  it("rejects a non-array", () => {
    expect(() => validateContentBlocks({} as unknown)).toThrow();
  });

  it("rejects a block with an unknown type", () => {
    expect(() =>
      validateContentBlocks([
        {
          id: "a",
          order: 0,
          type: "unknown",
          data: {},
        } as unknown as RoadmapContentBlock,
      ]),
    ).toThrow();
  });

  it("rejects an image block with a malformed URL", () => {
    const block = {
      id: "a",
      order: 0,
      type: "image",
      data: {
        url: "not-a-url",
        storagePath: "",
        alt: "",
      },
    };
    expect(() =>
      validateContentBlocks([block as unknown as RoadmapContentBlock]),
    ).toThrow();
  });

  it("rejects a callout block with an unknown variant", () => {
    const block = {
      id: "a",
      order: 0,
      type: "callout",
      data: { variant: "bogus", body: "hi" },
    };
    expect(() =>
      validateContentBlocks([block as unknown as RoadmapContentBlock]),
    ).toThrow();
  });

  it("rejects a rich_text block whose html exceeds 100k chars", () => {
    const block: RoadmapContentBlock = {
      id: "a",
      order: 0,
      type: "rich_text",
      data: { html: "x".repeat(100_001) },
    };
    expect(() => validateContentBlocks([block])).toThrow();
  });
});
