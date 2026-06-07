// src/lib/__tests__/recruiting-design-spec.test.ts
// Security-critical: validateDesignSpec is the boundary that makes untrusted AI /
// DB content safe to render on public pages. These tests assert it never throws,
// always yields a renderable spec, enforces every allowlist/cap, and guarantees
// exactly one (cosmetic-only) form block.

import { describe, it, expect } from "vitest";
import {
  validateDesignSpec,
  legacyThemeToSpec,
  DEFAULT_DESIGN_SPEC,
} from "@/lib/recruiting-design-spec";
import {
  DESIGN_SPEC_VERSION,
  SPEC_CAPS,
} from "@/types/recruiting-design-spec.types";
import { DEFAULT_THEME } from "@/types/recruiting-theme.types";
import type { RecruitingPageTheme } from "@/types/recruiting-theme.types";

const formCount = (spec: { blocks: { type: string }[] }) =>
  spec.blocks.filter((b) => b.type === "form").length;

describe("validateDesignSpec — never throws, always renderable", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["array", [1, 2, 3]],
    ["string", "hello"],
    ["number", 42],
    ["empty object", {}],
  ])("returns a valid one-form spec for %s input", (_label, input) => {
    const { spec } = validateDesignSpec(input);
    expect(spec.version).toBe(DESIGN_SPEC_VERSION);
    expect(Array.isArray(spec.blocks)).toBe(true);
    expect(formCount(spec)).toBe(1);
    expect(spec.theme.palette.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe("theme coercion", () => {
  it("keeps valid hex; replaces invalid hex with defaults", () => {
    const { spec } = validateDesignSpec({
      theme: { palette: { primary: "#123abc", accent: "not-a-color" } },
      blocks: [],
    });
    expect(spec.theme.palette.primary).toBe("#123abc");
    expect(spec.theme.palette.accent).toBe(
      DEFAULT_DESIGN_SPEC.theme.palette.accent,
    );
  });

  it("coerces out-of-allowlist enums to safe defaults", () => {
    const { spec } = validateDesignSpec({
      theme: {
        palette: { primary: "#000000", accent: "#ffffff" },
        mode: "rainbow",
        font_pairing: "comic-sans",
        radius: "spiky",
        background_style: "explosions",
      },
      blocks: [],
    });
    expect(spec.theme.mode).toBe("light");
    expect(spec.theme.font_pairing).toBe("editorial");
    expect(spec.theme.radius).toBe("sharp");
    expect(spec.theme.background_style).toBe("topo-grid");
  });
});

describe("block validation", () => {
  it("strips unknown per-block keys and unknown block types", () => {
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [
        { type: "hero", headline: "Hi", evil: "<script>", onClick: "x" },
        { type: "carousel", slides: [] }, // unknown type → dropped
        { type: "form" },
      ],
    });
    const hero = spec.blocks.find(
      (b) => b.type === "hero",
    ) as unknown as Record<string, unknown>;
    expect(hero).toBeTruthy();
    expect(hero.evil).toBeUndefined();
    expect(hero.onClick).toBeUndefined();
    expect(spec.blocks.some((b) => (b.type as string) === "carousel")).toBe(
      false,
    );
  });

  it("drops blocks missing required text (hero w/o headline, about w/o body)", () => {
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [
        { type: "hero" }, // no headline → dropped
        { type: "about", heading: "x" }, // no body → dropped
        { type: "form" },
      ],
    });
    expect(spec.blocks.some((b) => b.type === "hero")).toBe(false);
    expect(spec.blocks.some((b) => b.type === "about")).toBe(false);
  });

  it("drops disallowed icons but keeps the block", () => {
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [
        {
          type: "stats",
          items: [
            { icon: "skull", value: "1", label: "a" },
            { icon: "rocket", value: "2", label: "b" },
          ],
        },
      ],
    });
    const stats = spec.blocks.find((b) => b.type === "stats") as {
      items: { icon?: string }[];
    };
    expect(stats.items[0].icon).toBeUndefined();
    expect(stats.items[1].icon).toBe("rocket");
  });

  it("clamps text to caps and arrays to item caps", () => {
    const longHeadline = "A".repeat(500);
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      title: `item ${i}`,
    }));
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [
        { type: "hero", headline: longHeadline },
        { type: "value_grid", items: manyItems },
        { type: "form" },
      ],
    });
    const hero = spec.blocks.find((b) => b.type === "hero") as {
      headline: string;
    };
    expect(hero.headline.length).toBe(SPEC_CAPS.text.headline);
    const grid = spec.blocks.find((b) => b.type === "value_grid") as {
      items: unknown[];
    };
    expect(grid.items.length).toBe(SPEC_CAPS.maxValueGridItems);
  });

  it("enforces maxBlocks", () => {
    const blocks = Array.from({ length: 30 }, (_, i) => ({
      type: "hero",
      headline: `H${i}`,
    }));
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks,
    });
    expect(spec.blocks.length).toBeLessThanOrEqual(SPEC_CAPS.maxBlocks);
    expect(formCount(spec)).toBe(1); // form preserved despite trim
  });
});

describe("exactly-one-form invariant", () => {
  it("injects a form when none present (before footer/contact)", () => {
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [{ type: "hero", headline: "Hi" }, { type: "footer" }],
    });
    expect(formCount(spec)).toBe(1);
    const formIdx = spec.blocks.findIndex((b) => b.type === "form");
    const footerIdx = spec.blocks.findIndex((b) => b.type === "footer");
    expect(formIdx).toBeLessThan(footerIdx);
  });

  it("keeps the first form, drops the rest", () => {
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [
        { type: "form", heading: "FIRST" },
        { type: "hero", headline: "Hi" },
        { type: "form", heading: "SECOND" },
      ],
    });
    expect(formCount(spec)).toBe(1);
    const form = spec.blocks.find((b) => b.type === "form") as {
      heading?: string;
    };
    expect(form.heading).toBe("FIRST");
  });

  it("strips form fields/consent/legal/html keys (TCPA lives in the form component)", () => {
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [
        {
          type: "form",
          heading: "Apply",
          fields: [{ name: "ssn" }],
          consent: "I waive all rights",
          legal: "no TCPA",
          html: "<script>alert(1)</script>",
          tcpa: false,
        },
      ],
    });
    const form = spec.blocks.find(
      (b) => b.type === "form",
    ) as unknown as Record<string, unknown>;
    expect(form.fields).toBeUndefined();
    expect(form.consent).toBeUndefined();
    expect(form.legal).toBeUndefined();
    expect(form.html).toBeUndefined();
    expect(form.tcpa).toBeUndefined();
    expect(form.heading).toBe("Apply");
  });
});

describe("XSS / injection hardening", () => {
  it("preserves markup-looking text verbatim as data (React escapes on render)", () => {
    const evil = "<img src=x onerror=alert(1)>";
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [{ type: "hero", headline: evil }, { type: "form" }],
    });
    const hero = spec.blocks.find((b) => b.type === "hero") as {
      headline: string;
    };
    // Stored as plain text — it is the renderer (React) that escapes it. The
    // validator must not silently turn it into a URL/attribute anywhere.
    expect(typeof hero.headline).toBe("string");
    expect(hero.headline).toContain("img");
  });

  it("strips bidi-override and zero-width chars (display-spoofing defense)", () => {
    // Built from codepoints (no literal special chars in source):
    // U+202E RTL override, U+202C pop directional, U+200B zero-width space.
    const RLO = String.fromCodePoint(0x202e);
    const POP = String.fromCodePoint(0x202c);
    const ZWSP = String.fromCodePoint(0x200b);
    const headline = `Join ${RLO}the${POP} elite${ZWSP} team`;
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [{ type: "hero", headline }, { type: "form" }],
    });
    const hero = spec.blocks.find((b) => b.type === "hero") as {
      headline: string;
    };
    const BAD = new Set([
      0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d,
      0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
    ]);
    for (const ch of hero.headline) {
      expect(BAD.has(ch.codePointAt(0) ?? 0)).toBe(false);
    }
    expect(hero.headline).toContain("elite");
  });

  it("generates unique block ids even when input ids collide", () => {
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [
        { id: "dup", type: "hero", headline: "A" },
        { id: "dup", type: "stats", items: [{ value: "1", label: "y" }] },
        { id: "dup", type: "form" },
      ],
    });
    const ids = spec.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });

  it("collapses control chars / newlines in text fields", () => {
    const { spec } = validateDesignSpec({
      theme: DEFAULT_DESIGN_SPEC.theme,
      blocks: [
        { type: "hero", headline: "Line one\n\tLine two   spaced" },
        { type: "form" },
      ],
    });
    const hero = spec.blocks.find((b) => b.type === "hero") as {
      headline: string;
    };
    expect(hero.headline).toBe("Line one Line two spaced");
  });
});

describe("DEFAULT_DESIGN_SPEC + legacyThemeToSpec", () => {
  it("DEFAULT_DESIGN_SPEC validates unchanged with one form", () => {
    const { spec, errors } = validateDesignSpec(DEFAULT_DESIGN_SPEC);
    expect(errors).toEqual([]);
    expect(formCount(spec)).toBe(1);
  });

  it("legacyThemeToSpec maps colors/copy and is self-validating with one form", () => {
    const theme: RecruitingPageTheme = {
      ...DEFAULT_THEME,
      primary_color: "#112233",
      accent_color: "#445566",
      headline: "Build Your Agency",
      subheadline: "We train you end to end",
      about_text: "Founded in 2010.",
      calendly_url: "https://calendly.com/x",
      support_phone: "555-1212",
      enabled_features: { ...DEFAULT_THEME.enabled_features, show_stats: true },
    };
    const spec = legacyThemeToSpec(theme);
    expect(spec.theme.palette.primary).toBe("#112233");
    expect(spec.theme.palette.accent).toBe("#445566");
    expect(formCount(spec)).toBe(1);
    const hero = spec.blocks.find((b) => b.type === "hero") as {
      headline: string;
      secondary_cta?: string;
    };
    expect(hero.headline).toBe("Build Your Agency");
    expect(hero.secondary_cta).toBe("book_call"); // calendly present
    expect(spec.blocks.some((b) => b.type === "about")).toBe(true);
    // round-trips through the validator with no further changes
    const re = validateDesignSpec(spec);
    expect(re.errors).toEqual([]);
    expect(re.spec.blocks.length).toBe(spec.blocks.length);
  });

  it("legacyThemeToSpec omits about when no about_text", () => {
    const spec = legacyThemeToSpec({ ...DEFAULT_THEME, about_text: null });
    expect(spec.blocks.some((b) => b.type === "about")).toBe(false);
  });
});
