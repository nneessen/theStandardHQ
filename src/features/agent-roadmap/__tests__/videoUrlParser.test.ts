// Unit tests for parseVideoUrl — detects YouTube/Vimeo/Loom URLs and
// produces embed URLs. The validator accepts URLs up-front but this parser
// is what determines whether the agent runner renders an inline iframe
// or falls back to an "Open externally" link.

import { describe, expect, it } from "vitest";
import { parseVideoUrl } from "../services/videoUrlParser";

describe("parseVideoUrl — YouTube", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts the video id from %s", (url, expectedId) => {
    const result = parseVideoUrl(url);
    expect(result.platform).toBe("youtube");
    expect(result.id).toBe(expectedId);
    expect(result.embedUrl).toBe(`https://www.youtube.com/embed/${expectedId}`);
  });

  it("handles URLs with extra query params", () => {
    const result = parseVideoUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=abc",
    );
    expect(result.platform).toBe("youtube");
    expect(result.id).toBe("dQw4w9WgXcQ");
  });
});

describe("parseVideoUrl — Vimeo", () => {
  it("parses vimeo.com/123456789", () => {
    const result = parseVideoUrl("https://vimeo.com/123456789");
    expect(result.platform).toBe("vimeo");
    expect(result.id).toBe("123456789");
    expect(result.embedUrl).toBe("https://player.vimeo.com/video/123456789");
  });

  it("parses vimeo.com/video/123456789", () => {
    const result = parseVideoUrl("https://vimeo.com/video/123456789");
    expect(result.platform).toBe("vimeo");
    expect(result.id).toBe("123456789");
  });
});

describe("parseVideoUrl — Loom", () => {
  it("parses loom.com/share/{id}", () => {
    const result = parseVideoUrl("https://www.loom.com/share/abcdef1234567890");
    expect(result.platform).toBe("loom");
    expect(result.id).toBe("abcdef1234567890");
    expect(result.embedUrl).toBe("https://www.loom.com/embed/abcdef1234567890");
  });

  it("parses loom.com/embed/{id}", () => {
    const result = parseVideoUrl("https://www.loom.com/embed/abcdef1234567890");
    expect(result.platform).toBe("loom");
    expect(result.id).toBe("abcdef1234567890");
  });
});

describe("parseVideoUrl — other / unknown", () => {
  it("returns 'other' for a Wistia URL", () => {
    const result = parseVideoUrl("https://fast.wistia.com/embed/iframe/abc");
    expect(result.platform).toBe("other");
    expect(result.embedUrl).toBeUndefined();
  });

  it("returns 'other' for a random https URL", () => {
    const result = parseVideoUrl("https://example.com/video.mp4");
    expect(result.platform).toBe("other");
    expect(result.id).toBeUndefined();
  });

  it("returns 'other' for an empty string", () => {
    const result = parseVideoUrl("");
    expect(result.platform).toBe("other");
  });

  it("trims leading/trailing whitespace before parsing", () => {
    const result = parseVideoUrl("  https://youtu.be/dQw4w9WgXcQ  ");
    expect(result.platform).toBe("youtube");
    expect(result.id).toBe("dQw4w9WgXcQ");
  });
});
