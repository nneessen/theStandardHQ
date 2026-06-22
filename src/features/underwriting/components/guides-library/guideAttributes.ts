// Derived presentation attributes for the Underwriting Guides browser.
//
// The `underwriting_guides` table stores no category / product / carrier-color
// columns, but the master–detail design (see the "Underwriting Guides v2"
// handoff) needs all three. Rather than migrate the schema, we DERIVE them here
// from data that already exists (the guide name + carrier id). This file is the
// single seam: promoting any of these to a real DB column later is a one-function
// change, not a rewrite.
//
// Colors resolve through the `.theme-v2` CSS vars (via the board `T` tokens), so
// every accent flips with light/dark automatically. Tints use `color-mix` so the
// wash is theme-reactive too (never a baked-in dark literal).

import { T } from "@/components/board";
import type { GuideWithCarrier } from "./groupGuidesByCarrier";

export type AccentKey =
  | "blue"
  | "green"
  | "amber"
  | "cyan"
  | "violet"
  | "slate";

/** Accent key → theme-reactive CSS color string. */
export const ACCENT: Record<AccentKey, string> = {
  blue: T.blue,
  green: T.green,
  amber: T.amber,
  cyan: T.cyan,
  violet: T.violet,
  // `--slate` isn't in the board ramp; the literal fallback is theme-neutral.
  slate: "var(--slate, #9aa6b8)",
};

/** A theme-reactive tinted wash of an accent. `pct` is 0–100. */
export function tint(accent: AccentKey, pct: number): string {
  return `color-mix(in srgb, ${ACCENT[accent]} ${pct}%, transparent)`;
}

// Carriers get a stable color identity (folder icon + dot), never a monogram.
const CARRIER_ACCENTS: AccentKey[] = [
  "blue",
  "green",
  "amber",
  "cyan",
  "violet",
  "slate",
];

/**
 * Deterministic carrier → accent. Same carrier id always maps to the same color
 * across sessions and users (it's a pure hash, no persistence needed).
 */
export function carrierAccent(carrierId: string): AccentKey {
  let h = 0;
  for (let i = 0; i < carrierId.length; i++) {
    h = (h * 31 + carrierId.charCodeAt(i)) >>> 0;
  }
  return CARRIER_ACCENTS[h % CARRIER_ACCENTS.length];
}

export const CATEGORIES = [
  "Underwriting",
  "Product",
  "Impairment",
  "Build Chart",
  "Reference",
  "Financial",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_ACCENT: Record<Category, AccentKey> = {
  Underwriting: "blue",
  Product: "violet",
  Impairment: "amber",
  "Build Chart": "cyan",
  Reference: "slate",
  Financial: "green",
};

/**
 * Classify a guide by document type from its name. Doc-type keywords win over
 * product keywords (a "Term Underwriting Guide" is Underwriting, not Product).
 * Falls back to the neutral "Reference" rather than guessing — a confidently
 * wrong badge looks worse than an honest neutral one.
 */
export function deriveCategory(name: string): Category {
  const n = name.toLowerCase();
  if (/impair|knockout|decline|\bmedical\b|condition/.test(n))
    return "Impairment";
  if (/build\s*chart|height\s*(?:&|and|\/)?\s*weight|\bbmi\b/.test(n))
    return "Build Chart";
  if (/financial|\bincome\b|net\s*worth|suitab/.test(n)) return "Financial";
  if (/underwrit|guidelines|\buw\b/.test(n)) return "Underwriting";
  if (
    /\bterm\b|\biul\b|whole\s*life|universal|annuit|final\s*expense|product/.test(
      n,
    )
  )
    return "Product";
  return "Reference";
}

/** Derive a product line from the guide name; "—" when nothing matches. */
export function deriveProduct(name: string): string {
  const n = name.toLowerCase();
  if (/\biul\b|indexed\s*universal/.test(n)) return "IUL";
  if (/\bterm\b/.test(n)) return "Term";
  if (/whole\s*life|\bwl\b/.test(n)) return "Whole Life";
  if (/final\s*expense|\bfex?\b/.test(n)) return "Final Expense";
  if (/universal\s*life|\bul\b/.test(n)) return "UL";
  if (/annuit/.test(n)) return "Annuity";
  return "—";
}

/** Bytes → "X.X MB" / "N KB"; "—" for missing/zero. */
export function fmtSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** ISO → "Jun 11, 2026"; "" when missing/invalid. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** A guide row with its derived presentation attributes attached. */
export interface EnrichedGuide extends GuideWithCarrier {
  _category: Category;
  _product: string;
  _accent: AccentKey;
}

export function enrichGuide(guide: GuideWithCarrier): EnrichedGuide {
  return {
    ...guide,
    _category: deriveCategory(guide.name),
    _product: deriveProduct(guide.name),
    _accent: carrierAccent(guide.carrier_id),
  };
}
