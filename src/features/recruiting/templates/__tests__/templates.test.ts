// src/features/recruiting/templates/__tests__/templates.test.ts
//
// Every gallery template must be a clean, render-safe starting point: it has to
// pass validateDesignSpec UNCHANGED (so picking it produces exactly what was
// authored), carry exactly one form, a real layout, and at least one content block.

import { describe, it, expect } from "vitest";
import { RECRUITING_TEMPLATES } from "../index";
import { validateDesignSpec } from "@/lib/recruiting-design-spec";
import { LAYOUT_NAMES, SPEC_CAPS } from "@/types/recruiting-design-spec.types";

describe("recruiting templates", () => {
  it("has 8 templates with unique ids matching their spec.layout", () => {
    expect(RECRUITING_TEMPLATES).toHaveLength(8);
    const ids = RECRUITING_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of RECRUITING_TEMPLATES) {
      expect(t.spec.layout).toBe(t.id);
      expect((LAYOUT_NAMES as readonly string[]).includes(t.id)).toBe(true);
    }
  });

  it("covers every layout shell at least once", () => {
    const covered = new Set(RECRUITING_TEMPLATES.map((t) => t.spec.layout));
    for (const layout of LAYOUT_NAMES) {
      expect(covered.has(layout)).toBe(true);
    }
  });

  for (const t of RECRUITING_TEMPLATES) {
    describe(`${t.id} (${t.name})`, () => {
      const { spec, errors } = validateDesignSpec(t.spec);

      it("passes validateDesignSpec with NO content coercions", () => {
        // No dropped/clamped blocks, bad enums, injected form, etc. (block ids
        // are validator-owned and re-derived by position — not a coercion.)
        expect(errors).toEqual([]);
      });

      it("produces a stable (idempotent) validated render form", () => {
        // What renders is validateDesignSpec(spec); validating it again must be
        // byte-identical, so the gallery preview == the saved == the public page.
        expect(validateDesignSpec(spec).spec).toEqual(spec);
      });

      it("has exactly one form block", () => {
        expect(spec.blocks.filter((b) => b.type === "form")).toHaveLength(1);
      });

      it("has at least one non-form content block", () => {
        expect(spec.blocks.some((b) => b.type !== "form")).toBe(true);
      });

      it("respects the block cap", () => {
        expect(spec.blocks.length).toBeLessThanOrEqual(SPEC_CAPS.maxBlocks);
      });

      it("has a non-empty name and blurb", () => {
        expect(t.name.trim().length).toBeGreaterThan(0);
        expect(t.blurb.trim().length).toBeGreaterThan(0);
      });
    });
  }
});
