// Unit tests for the pure helpers in roadmapStorage.ts.
//
// These specifically cover B-2 — the file-extension whitelist that blocks
// double-extension uploads like `payload.html.png`. If this suite ever
// fails, review the ALLOWED_EXTENSIONS set in roadmapStorage.ts and the
// upload flow end-to-end.

import { describe, expect, it } from "vitest";
import {
  sanitizeFilename,
  extractAllowedExtension,
} from "../services/roadmapStorage";

describe("sanitizeFilename", () => {
  it("lowercases and preserves alphanumerics, dots, hyphens, underscores", () => {
    expect(sanitizeFilename("MyImage_v2.png")).toBe("myimage_v2.png");
  });

  it("replaces unsafe characters with hyphens", () => {
    expect(sanitizeFilename("hello world.png")).toBe("hello-world.png");
  });

  it("replaces every run of unsafe characters with a single hyphen", () => {
    // "hello world!.png" has two unsafe runs (space, then !), each gets
    // its own hyphen because they're separated by safe characters.
    expect(sanitizeFilename("hello world!.png")).toBe("hello-world-.png");
  });

  it("collapses consecutive separators", () => {
    expect(sanitizeFilename("a   b---c.png")).toBe("a-b-c.png");
  });

  it("strips leading and trailing hyphens", () => {
    expect(sanitizeFilename("---hello---")).toBe("hello");
  });

  it("truncates to 100 characters", () => {
    const long = "a".repeat(200);
    expect(sanitizeFilename(long).length).toBe(100);
  });

  it("strips path separators so a crafted filename can't escape the storage folder", () => {
    // Note: "." is a legal filename character (e.g. image.backup.png), so
    // ".." is NOT scrubbed — only the path separators that would let an
    // attacker escape the {agency}/{roadmap}/{item}/ prefix are. The real
    // security boundary is the separator, not the dot.
    const result = sanitizeFilename("../../etc/passwd");
    expect(result).not.toContain("/");
    expect(result).not.toContain("\\");
  });

  it("replaces forward and backward slashes with hyphens", () => {
    expect(sanitizeFilename("foo/bar.png")).not.toContain("/");
    expect(sanitizeFilename("foo\\bar.png")).not.toContain("\\");
  });
});

describe("extractAllowedExtension — accepts whitelisted types", () => {
  it.each(["jpg", "jpeg", "png", "gif", "webp", "svg"])(
    "accepts .%s",
    (ext) => {
      expect(extractAllowedExtension(`image.${ext}`)).toBe(ext);
    },
  );

  it("is case-insensitive", () => {
    expect(extractAllowedExtension("image.PNG")).toBe("png");
    expect(extractAllowedExtension("image.JPG")).toBe("jpg");
  });
});

describe("extractAllowedExtension — B-2 rejection suite", () => {
  it("rejects .html (stored XSS vector)", () => {
    expect(() => extractAllowedExtension("shell.html")).toThrow(
      /not supported/,
    );
  });

  it("rejects .php", () => {
    expect(() => extractAllowedExtension("shell.php")).toThrow(/not supported/);
  });

  it("rejects .js", () => {
    expect(() => extractAllowedExtension("script.js")).toThrow(/not supported/);
  });

  it("rejects .exe", () => {
    expect(() => extractAllowedExtension("malware.exe")).toThrow(
      /not supported/,
    );
  });

  it("rejects .svg.php (double extension — keeps the LAST extension, which is invalid)", () => {
    expect(() => extractAllowedExtension("shell.svg.php")).toThrow(
      /not supported/,
    );
  });

  it("rejects a filename with no extension", () => {
    expect(() => extractAllowedExtension("noext")).toThrow(/not supported/);
  });

  it("rejects an empty string", () => {
    expect(() => extractAllowedExtension("")).toThrow(/not supported/);
  });
});
