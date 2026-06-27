// Unit tests for the pure photo-precedence resolver (Phase C). Covers the n=0 guard,
// single photo, rotation wraparound, manual-override precedence, and the primary fallback
// — the rule that keeps C-A (no photos → profile photo) and C-B (rotate → photos[idx]) in lockstep.

import { describe, it, expect } from "vitest";
import { resolveDisplayPhoto } from "../photoRotation";

describe("resolveDisplayPhoto", () => {
  it("falls back to the primary avatar when the agent has NO rotation photos (n=0)", () => {
    expect(
      resolveDisplayPhoto({
        photos: [],
        rotationIdx: 3,
        profilePhotoUrl: "primary.jpg",
      }),
    ).toBe("primary.jpg");
    // …and to null when there is no primary either (→ initials placeholder).
    expect(
      resolveDisplayPhoto({ photos: [], profilePhotoUrl: null }),
    ).toBeNull();
    expect(resolveDisplayPhoto({})).toBeNull();
  });

  it("a manual override always wins, regardless of photos/rotation", () => {
    expect(
      resolveDisplayPhoto({
        manualOverride: "override.png",
        photos: ["a.jpg", "b.jpg"],
        rotationIdx: 1,
        profilePhotoUrl: "primary.jpg",
      }),
    ).toBe("override.png");
  });

  it("returns the only photo for a single-photo set (n=1) at any cursor", () => {
    expect(resolveDisplayPhoto({ photos: ["solo.jpg"], rotationIdx: 0 })).toBe(
      "solo.jpg",
    );
    expect(resolveDisplayPhoto({ photos: ["solo.jpg"], rotationIdx: 99 })).toBe(
      "solo.jpg",
    );
  });

  it("wraps the rotation cursor modulo the photo count", () => {
    const photos = ["a.jpg", "b.jpg"]; // n=2
    expect(resolveDisplayPhoto({ photos, rotationIdx: 0 })).toBe("a.jpg");
    expect(resolveDisplayPhoto({ photos, rotationIdx: 1 })).toBe("b.jpg");
    // idx=5, n=2 → 5 mod 2 = 1 → photos[1]
    expect(resolveDisplayPhoto({ photos, rotationIdx: 5 })).toBe("b.jpg");
    expect(resolveDisplayPhoto({ photos, rotationIdx: 4 })).toBe("a.jpg");
  });

  it("is negative-safe (a corrupt/negative cursor never throws or returns undefined)", () => {
    const photos = ["a.jpg", "b.jpg", "c.jpg"]; // n=3
    expect(resolveDisplayPhoto({ photos, rotationIdx: -1 })).toBe("c.jpg");
    expect(resolveDisplayPhoto({ photos, rotationIdx: -4 })).toBe("c.jpg");
  });

  it("prefers a rotation photo over the primary avatar when photos exist", () => {
    expect(
      resolveDisplayPhoto({
        photos: ["rot.jpg"],
        rotationIdx: 0,
        profilePhotoUrl: "primary.jpg",
      }),
    ).toBe("rot.jpg");
  });
});
