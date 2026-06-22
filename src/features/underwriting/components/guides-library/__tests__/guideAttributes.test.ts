import { describe, expect, it } from "vitest";
import {
  CATEGORY_ACCENT,
  carrierAccent,
  deriveCategory,
  deriveProduct,
  enrichGuide,
  fmtDate,
  fmtSize,
} from "../guideAttributes";
import type { GuideWithCarrier } from "../groupGuidesByCarrier";

describe("carrierAccent", () => {
  it("is deterministic for the same id", () => {
    expect(carrierAccent("carrier-123")).toBe(carrierAccent("carrier-123"));
  });

  it("always returns a known accent key", () => {
    const keys = ["blue", "green", "amber", "cyan", "violet", "slate"];
    for (const id of ["a", "carrier-xyz", "0000-1111", "national-life"]) {
      expect(keys).toContain(carrierAccent(id));
    }
  });

  it("spreads different ids across colors (not all one bucket)", () => {
    const ids = Array.from({ length: 24 }, (_, i) => `carrier-${i * 7 + 3}`);
    const colors = new Set(ids.map(carrierAccent));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe("deriveCategory", () => {
  it("classes doc-type keywords over product keywords", () => {
    expect(deriveCategory("Term Life Underwriting Guide")).toBe("Underwriting");
    expect(deriveCategory("IUL Underwriting Guidelines")).toBe("Underwriting");
  });

  it("detects impairment, build chart, and financial docs", () => {
    expect(deriveCategory("Impairment Guide — Diabetes")).toBe("Impairment");
    expect(deriveCategory("Height & Weight Build Chart")).toBe("Build Chart");
    expect(deriveCategory("Financial Suitability Worksheet")).toBe("Financial");
  });

  it("falls back to Product for bare product names, else Reference", () => {
    expect(deriveCategory("Term Product Brochure")).toBe("Product");
    expect(deriveCategory("Annuity Rate Sheet")).toBe("Product");
    expect(deriveCategory("Misc Carrier Memo")).toBe("Reference");
  });

  it("only ever returns a key that has an accent", () => {
    for (const name of ["x", "Term", "Build Chart", "income", "decline"]) {
      expect(CATEGORY_ACCENT[deriveCategory(name)]).toBeDefined();
    }
  });
});

describe("deriveProduct", () => {
  it("maps known product lines, else em dash", () => {
    expect(deriveProduct("IUL Guide")).toBe("IUL");
    expect(deriveProduct("Term Life Underwriting")).toBe("Term");
    expect(deriveProduct("Whole Life Brochure")).toBe("Whole Life");
    expect(deriveProduct("Annuity Suitability")).toBe("Annuity");
    expect(deriveProduct("General Reference Manual")).toBe("—");
  });
});

describe("fmtSize", () => {
  it("formats bytes into KB / MB and handles missing", () => {
    expect(fmtSize(null)).toBe("—");
    expect(fmtSize(0)).toBe("—");
    expect(fmtSize(900)).toBe("900 B");
    expect(fmtSize(2048)).toBe("2 KB");
    expect(fmtSize(5_242_880)).toBe("5.0 MB");
  });
});

describe("fmtDate", () => {
  it("formats ISO dates and tolerates junk", () => {
    expect(fmtDate("2026-06-11T00:00:00Z")).toContain("2026");
    expect(fmtDate(null)).toBe("");
    expect(fmtDate("not-a-date")).toBe("");
  });
});

describe("enrichGuide", () => {
  it("attaches derived category, product, and accent", () => {
    const base = {
      id: "g1",
      carrier_id: "c1",
      name: "Term Life Impairment Guide",
      file_name: "term.pdf",
      file_size_bytes: 1024,
      storage_path: "imo/c1/term.pdf",
      created_at: "2026-06-11T00:00:00Z",
      carrier: { id: "c1", name: "AFLAC" },
    } as unknown as GuideWithCarrier;
    const e = enrichGuide(base);
    expect(e._category).toBe("Impairment");
    expect(e._product).toBe("Term");
    expect(e._accent).toBe(carrierAccent("c1"));
  });
});
