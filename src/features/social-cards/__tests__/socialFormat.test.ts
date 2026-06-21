// Formatters shared by the social cards. Pinned so the de-duplicated helpers
// (initials was copy-pasted in two cards) can't silently diverge.

import { describe, it, expect } from "vitest";
import { toLastInitial, usd, initials } from "../socialFormat";

describe("toLastInitial", () => {
  it("first name + last initial", () => {
    expect(toLastInitial("Marcus Webb")).toBe("Marcus W.");
  });
  it("keeps an apostrophe last name's first letter", () => {
    expect(toLastInitial("Liam O'Connor")).toBe("Liam O.");
  });
  it("returns a single name unchanged", () => {
    expect(toLastInitial("Priya")).toBe("Priya");
  });
  it("collapses middle names — the last token wins", () => {
    expect(toLastInitial("Mary Jo Saunders")).toBe("Mary S.");
  });
  it("trims and normalizes internal whitespace", () => {
    expect(toLastInitial("  Marcus   Webb ")).toBe("Marcus W.");
  });
  it("handles empty input", () => {
    expect(toLastInitial("")).toBe("");
  });
});

describe("usd", () => {
  it("whole-dollar with thousands separators", () => {
    expect(usd(1234567)).toBe("$1,234,567");
  });
  it("rounds to the nearest dollar", () => {
    expect(usd(1234.6)).toBe("$1,235");
  });
  it("formats zero", () => {
    expect(usd(0)).toBe("$0");
  });
});

describe("initials", () => {
  it("takes the first two tokens' initials", () => {
    expect(initials("Marcus Webb")).toBe("MW");
  });
  it("works on the last-initial display form", () => {
    expect(initials("Marcus W.")).toBe("MW");
  });
  it("returns one initial for a single name", () => {
    expect(initials("Priya")).toBe("P");
  });
  it("caps at two initials", () => {
    expect(initials("Mary Jo Saunders")).toBe("MJ");
  });
});
