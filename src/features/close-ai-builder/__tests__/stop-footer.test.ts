import { describe, expect, it } from "vitest";
import { enforceStopFooter, hasStopFooter } from "../lib/stop-footer";

describe("hasStopFooter", () => {
  it("detects canonical Reply STOP", () => {
    expect(hasStopFooter("Hey there. Reply STOP to opt out.")).toBe(true);
  });
  it("detects Text STOP variant", () => {
    expect(hasStopFooter("Quick note — Text STOP to unsubscribe")).toBe(true);
  });
  it("ignores body that has no opt-out", () => {
    expect(hasStopFooter("Hi {{ contact.first_name }}, got a sec?")).toBe(
      false,
    );
  });
});

describe("enforceStopFooter — include=true", () => {
  it("appends footer when missing (one-liner)", () => {
    expect(enforceStopFooter("Hi there", true)).toBe(
      "Hi there Reply STOP to opt out",
    );
  });

  it("appends with blank-line separator for multiline", () => {
    expect(enforceStopFooter("Hey {{first}}\nGot a sec?", true)).toBe(
      "Hey {{first}}\nGot a sec?\n\nReply STOP to opt out",
    );
  });

  it("is a no-op when footer already present", () => {
    const original = "Hey there. Reply STOP to opt out.";
    expect(enforceStopFooter(original, true)).toBe(original);
  });

  it("is idempotent (calling twice yields the same string)", () => {
    const once = enforceStopFooter("Hi", true);
    expect(enforceStopFooter(once, true)).toBe(once);
  });
});

describe("enforceStopFooter — include=false", () => {
  it("strips a trailing canonical footer", () => {
    expect(enforceStopFooter("Hi there. Reply STOP to opt out.", false)).toBe(
      "Hi there.",
    );
  });

  it("strips a Text STOP variant footer", () => {
    expect(
      enforceStopFooter("Catch you soon — Text STOP to unsubscribe", false),
    ).toBe("Catch you soon");
  });

  it("leaves body alone when no footer present", () => {
    expect(enforceStopFooter("No footer here", false)).toBe("No footer here");
  });

  it("is idempotent", () => {
    const once = enforceStopFooter("Hi. Reply STOP to opt out.", false);
    expect(enforceStopFooter(once, false)).toBe(once);
  });
});

describe("enforceStopFooter — edge cases", () => {
  it("returns empty string for empty input", () => {
    expect(enforceStopFooter("", true)).toBe("");
    expect(enforceStopFooter("   ", false)).toBe("");
  });

  it("trims surrounding whitespace before processing", () => {
    expect(enforceStopFooter("  Hi  ", true)).toBe("Hi Reply STOP to opt out");
  });
});

describe("enforceStopFooter — broader keyword coverage", () => {
  it("detects Msg STOP variant as a footer", () => {
    expect(hasStopFooter("Hi there. Msg STOP to opt out.")).toBe(true);
    expect(enforceStopFooter("Hi there. Msg STOP to opt out.", false)).toBe(
      "Hi there.",
    );
  });

  it("detects 'STOP to unsubscribe' pattern (no leading verb)", () => {
    expect(hasStopFooter("Hey there. STOP to unsubscribe")).toBe(true);
  });
});

describe("enforceStopFooter — mid-text STOP behavior", () => {
  // A trailing footer is the only thing that counts as a "footer". Mid-text
  // mentions are body content and should not block append nor be stripped.
  it("does NOT treat mid-text 'Reply STOP' as a footer", () => {
    const body = "Reply STOP at any time. Hey {{first}}, got a sec?";
    expect(hasStopFooter(body)).toBe(false);
  });

  it("appends a real footer when toggle ON, even if STOP appears mid-text", () => {
    const body = "Reply STOP anytime. Hey there!";
    const result = enforceStopFooter(body, true);
    expect(result.endsWith("Reply STOP to opt out")).toBe(true);
  });

  it("does NOT strip mid-text 'Reply STOP' when toggle OFF", () => {
    const body = "Reply STOP anytime. Hey there!";
    expect(enforceStopFooter(body, false)).toBe(body);
  });
});
