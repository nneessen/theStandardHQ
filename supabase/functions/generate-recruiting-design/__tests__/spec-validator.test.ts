// supabase/functions/generate-recruiting-design/__tests__/spec-validator.test.ts
// Run: deno test supabase/functions/generate-recruiting-design/
import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { validateDesignSpec, isUsableSpec } from "../spec-validator.ts";

// deno-lint-ignore no-explicit-any
const blocks = (r: any) => r.spec.blocks as any[];
// deno-lint-ignore no-explicit-any
const forms = (r: any) => blocks(r).filter((b) => b.type === "form").length;

Deno.test("non-object input yields a safe one-form spec", () => {
  for (const input of [null, undefined, "x", 5, [1, 2]]) {
    const r = validateDesignSpec(input);
    assertEquals(forms(r), 1);
    assertEquals(r.spec.version, 1);
  }
});

Deno.test("valid spec passes and is usable", () => {
  const r = validateDesignSpec({
    version: 1,
    theme: { palette: { primary: "#112233", accent: "#445566" } },
    blocks: [
      { type: "hero", variant: "split", headline: "Join us" },
      { type: "form", heading: "Apply" },
    ],
  });
  assertEquals(forms(r), 1);
  assert(isUsableSpec(r.spec));
  assertEquals(r.errors.length, 0);
});

Deno.test("missing form is injected", () => {
  const r = validateDesignSpec({
    blocks: [{ type: "hero", headline: "Hi" }, { type: "footer" }],
  });
  assertEquals(forms(r), 1);
  const idxForm = blocks(r).findIndex((b) => b.type === "form");
  const idxFooter = blocks(r).findIndex((b) => b.type === "footer");
  assert(idxForm < idxFooter);
});

Deno.test("multiple forms reduced to one (first kept)", () => {
  const r = validateDesignSpec({
    blocks: [
      { type: "form", heading: "FIRST" },
      { type: "hero", headline: "Hi" },
      { type: "form", heading: "SECOND" },
    ],
  });
  assertEquals(forms(r), 1);
  const form = blocks(r).find((b) => b.type === "form");
  assertEquals(form.heading, "FIRST");
});

Deno.test("unknown block type is dropped", () => {
  const r = validateDesignSpec({
    blocks: [
      { type: "carousel" },
      { type: "hero", headline: "Hi" },
      { type: "form" },
    ],
  });
  assert(!blocks(r).some((b) => b.type === "carousel"));
  assert(blocks(r).some((b) => b.type === "hero"));
});

Deno.test("bad hex palette falls back to defaults; enums coerced", () => {
  const r = validateDesignSpec({
    theme: {
      palette: { primary: "red", accent: "#445566" },
      mode: "rainbow",
      font_pairing: "comic",
      radius: "spiky",
      background_style: "boom",
    },
    blocks: [{ type: "form" }],
  });
  // deno-lint-ignore no-explicit-any
  const theme = r.spec.theme as any;
  assertEquals(theme.palette.primary, "#0ea5e9");
  assertEquals(theme.palette.accent, "#445566");
  assertEquals(theme.mode, "light");
  assertEquals(theme.font_pairing, "editorial");
  assertEquals(theme.radius, "sharp");
  assertEquals(theme.background_style, "topo-grid");
});

Deno.test("disallowed icon dropped, block kept", () => {
  const r = validateDesignSpec({
    blocks: [
      {
        type: "stats",
        items: [
          { icon: "skull", value: "1", label: "a" },
          { icon: "rocket", value: "2", label: "b" },
        ],
      },
      { type: "form" },
    ],
  });
  const stats = blocks(r).find((b) => b.type === "stats");
  assertEquals(stats.items[0].icon, undefined);
  assertEquals(stats.items[1].icon, "rocket");
});

Deno.test(
  "form forbidden keys (fields/consent/legal/html) are stripped",
  () => {
    const r = validateDesignSpec({
      blocks: [
        {
          type: "form",
          heading: "Apply",
          fields: [{ name: "ssn" }],
          consent: "waive",
          legal: "none",
          html: "<script>alert(1)</script>",
        },
      ],
    });
    const form = blocks(r).find((b) => b.type === "form");
    assertEquals(form.fields, undefined);
    assertEquals(form.consent, undefined);
    assertEquals(form.legal, undefined);
    assertEquals(form.html, undefined);
    assertEquals(form.heading, "Apply");
  },
);

Deno.test("caps enforced: blocks, stat items, text length", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    type: "hero",
    headline: `H${i}`,
  }));
  const r = validateDesignSpec({ blocks: many });
  assert(blocks(r).length <= 12);
  assertEquals(forms(r), 1);

  const r2 = validateDesignSpec({
    blocks: [{ type: "hero", headline: "A".repeat(500) }, { type: "form" }],
  });
  const hero = blocks(r2).find((b) => b.type === "hero");
  assertEquals(hero.headline.length, 120);
});

Deno.test("markup-looking text is preserved as data (no crash)", () => {
  const r = validateDesignSpec({
    blocks: [
      { type: "hero", headline: "<img src=x onerror=alert(1)>" },
      { type: "form" },
    ],
  });
  const hero = blocks(r).find((b) => b.type === "hero");
  assert(typeof hero.headline === "string");
  assert(hero.headline.includes("img"));
});

Deno.test("isUsableSpec false when only a form", () => {
  const r = validateDesignSpec({ blocks: [{ type: "form" }] });
  assertEquals(isUsableSpec(r.spec), false);
});

Deno.test("strips bidi-override / zero-width chars from text", () => {
  const RLO = String.fromCodePoint(0x202e);
  const ZWSP = String.fromCodePoint(0x200b);
  const r = validateDesignSpec({
    blocks: [
      { type: "hero", headline: `Join ${RLO}the${ZWSP} team` },
      { type: "form" },
    ],
  });
  const hero = blocks(r).find((b) => b.type === "hero");
  const BAD = new Set([
    0x200b, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068,
    0x2069, 0xfeff,
  ]);
  for (const ch of hero.headline as string) {
    assert(!BAD.has((ch as string).codePointAt(0) ?? 0));
  }
});

Deno.test("generates unique block ids even when input ids collide", () => {
  const r = validateDesignSpec({
    blocks: [
      { id: "dup", type: "hero", headline: "A" },
      { id: "dup", type: "stats", items: [{ value: "1", label: "y" }] },
      { id: "dup", type: "form" },
    ],
  });
  const ids = blocks(r).map((b) => b.id);
  assertEquals(new Set(ids).size, ids.length);
});
