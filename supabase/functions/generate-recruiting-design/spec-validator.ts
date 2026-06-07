// supabase/functions/generate-recruiting-design/spec-validator.ts
//
// Server-side mirror of src/lib/recruiting-design-spec.ts. Deno cannot import
// from src/, so the allowlists/caps below are DUPLICATED — they must stay in
// sync with src/types/recruiting-design-spec.types.ts (the source of truth).
//
// NOTE: this is a QUALITY / REPAIR gate, not the security boundary. The real
// boundary is the client validator that re-validates on every public render.
// Here we coerce the model's output into a clean, renderable spec and report
// what was dropped so the handler can ask the model to fix it.

export const DESIGN_SPEC_VERSION = 1;

// Exported so system-prompt.ts derives its enum/icon lists from the SAME source
// (one fewer hand-maintained copy). These still mirror
// src/types/recruiting-design-spec.types.ts across the Deno/Vite boundary.
export const FONT_PAIRINGS = [
  "editorial",
  "modern",
  "grotesk",
  "mono",
  "impact",
];
export const RADIUS_TOKENS = ["sharp", "soft", "round"];
export const PALETTE_MODES = ["light", "dark"];
export const BACKGROUND_STYLES = [
  "topo-grid",
  "flat",
  "floating-shapes",
  "lattice",
];
const HERO_VARIANTS = ["stacked", "split", "minimal"];
const STATS_STYLES = ["lattice", "inline"];
const CTA_ACTIONS = ["open_form", "book_call"];
const SECONDARY_CTAS = ["book_call", "none"];
export const SPEC_ICONS = [
  "cpu",
  "network",
  "shield",
  "sparkles",
  "arrow-right",
  "phone",
  "instagram",
  "dollar-sign",
  "book-open",
  "clock",
  "rocket",
  "users",
  "map-pin",
  "zap",
  "trending-up",
  "award",
  "check",
  "star",
  "briefcase",
  "target",
  "heart",
  "graduation-cap",
  "handshake",
  "line-chart",
  "badge-check",
];

const CAPS = {
  maxBlocks: 12,
  maxStatsItems: 4,
  maxValueGridItems: 6,
  text: {
    eyebrow: 40,
    headline: 120,
    subhead: 280,
    heading: 80,
    body: 600,
    quote: 400,
    attribution: 80,
    ctaText: 32,
    statValue: 12,
    statLabel: 40,
    itemTitle: 60,
    itemBody: 200,
  },
};

const DEFAULT_PALETTE = { primary: "#0ea5e9", accent: "#22c55e" };

type Json = Record<string, unknown>;

function isRecord(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Mirror of isUnsafeFormatCodepoint in src/lib/recruiting-design-spec.ts. Drops
// C0/DEL, C1 controls, zero-width chars, and bidi formatting/overrides so a model
// (or tampered) spec can't spoof display on the public page.
function isUnsafeFormatCodepoint(code: number): boolean {
  return (
    code < 0x20 ||
    code === 0x7f ||
    (code >= 0x80 && code <= 0x9f) ||
    code === 0x200b ||
    code === 0x200c ||
    code === 0x200d ||
    code === 0xfeff ||
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

function cleanText(
  v: unknown,
  max: number,
  multiline = false,
): string | undefined {
  if (typeof v !== "string") return undefined;
  const collapsed = multiline
    ? v
        .replace(/[^\S\n]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : v.replace(/\s+/g, " ").trim();
  let out = "";
  for (const ch of collapsed) {
    const code = ch.codePointAt(0) ?? 0;
    if (multiline && code === 0x0a) {
      out += ch;
      continue;
    }
    if (!isUnsafeFormatCodepoint(code)) out += ch;
  }
  out = out.trim();
  if (!out) return undefined;
  return out.slice(0, max);
}

function pickEnum(v: unknown, allowed: string[], fallback: string): string {
  return typeof v === "string" && allowed.includes(v) ? v : fallback;
}
function pickEnumOpt(v: unknown, allowed: string[]): string | undefined {
  return typeof v === "string" && allowed.includes(v) ? v : undefined;
}
function pickIcon(v: unknown): string | undefined {
  return pickEnumOpt(v, SPEC_ICONS);
}
function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
}
function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function validateTheme(input: unknown): Json {
  const t = isRecord(input) ? input : {};
  const p = isRecord(t.palette) ? t.palette : {};
  return {
    palette: {
      primary: isHex(p.primary) ? p.primary : DEFAULT_PALETTE.primary,
      accent: isHex(p.accent) ? p.accent : DEFAULT_PALETTE.accent,
    },
    mode: pickEnum(t.mode, PALETTE_MODES, "light"),
    font_pairing: pickEnum(t.font_pairing, FONT_PAIRINGS, "editorial"),
    radius: pickEnum(t.radius, RADIUS_TOKENS, "sharp"),
    background_style: pickEnum(
      t.background_style,
      BACKGROUND_STYLES,
      "topo-grid",
    ),
  };
}

function validateBlock(input: unknown, index: number): Json | null {
  if (!isRecord(input)) return null;
  const type = input.type;
  // Validator owns ids — derive from position, never trust input.id (collisions
  // would break React keys at render).
  const id = `${typeof type === "string" ? type : "block"}-${index}`;
  const c = CAPS.text;

  switch (type) {
    case "hero": {
      const headline = cleanText(input.headline, c.headline);
      if (!headline) return null;
      return {
        id,
        type: "hero",
        variant: pickEnum(input.variant, HERO_VARIANTS, "split"),
        eyebrow: cleanText(input.eyebrow, c.eyebrow),
        headline,
        subhead: cleanText(input.subhead, c.subhead),
        primary_cta: cleanText(input.primary_cta, c.ctaText),
        secondary_cta: pickEnumOpt(input.secondary_cta, SECONDARY_CTAS),
      };
    }
    case "stats": {
      const raw = Array.isArray(input.items) ? input.items : [];
      const items: Json[] = [];
      for (const r of raw) {
        if (items.length >= CAPS.maxStatsItems) break;
        if (!isRecord(r)) continue;
        const value = cleanText(r.value, c.statValue);
        const label = cleanText(r.label, c.statLabel);
        if (!value || !label) continue;
        items.push({ icon: pickIcon(r.icon), value, label });
      }
      if (items.length === 0) return null;
      return {
        id,
        type: "stats",
        style: pickEnum(input.style, STATS_STYLES, "lattice"),
        items,
      };
    }
    case "value_grid": {
      const raw = Array.isArray(input.items) ? input.items : [];
      const items: Json[] = [];
      for (const r of raw) {
        if (items.length >= CAPS.maxValueGridItems) break;
        if (!isRecord(r)) continue;
        const title = cleanText(r.title, c.itemTitle);
        if (!title) continue;
        items.push({
          icon: pickIcon(r.icon),
          title,
          body: cleanText(r.body, c.itemBody),
        });
      }
      if (items.length === 0) return null;
      return {
        id,
        type: "value_grid",
        heading: cleanText(input.heading, c.heading),
        items,
      };
    }
    case "about": {
      const body = cleanText(input.body, c.body, true);
      if (!body) return null;
      return {
        id,
        type: "about",
        heading: cleanText(input.heading, c.heading),
        body,
      };
    }
    case "testimonial": {
      const quote = cleanText(input.quote, c.quote, true);
      if (!quote) return null;
      return {
        id,
        type: "testimonial",
        quote,
        attribution: cleanText(input.attribution, c.attribution),
      };
    }
    case "form": {
      // Cosmetic copy ONLY — fields/consent/legal/html are never read.
      return {
        id,
        type: "form",
        eyebrow: cleanText(input.eyebrow, c.eyebrow),
        heading: cleanText(input.heading, c.heading),
        subcopy: cleanText(input.subcopy, c.subhead),
        cta_text: cleanText(input.cta_text, c.ctaText),
      };
    }
    case "cta": {
      const headline = cleanText(input.headline, c.headline);
      if (!headline) return null;
      return {
        id,
        type: "cta",
        headline,
        button_text: cleanText(input.button_text, c.ctaText),
        action: pickEnum(input.action, CTA_ACTIONS, "open_form"),
      };
    }
    case "contact":
      return {
        id,
        type: "contact",
        show_phone: pickBool(input.show_phone, true),
        show_socials: pickBool(input.show_socials, true),
      };
    case "footer":
      return {
        id,
        type: "footer",
        show_copyright: pickBool(input.show_copyright, true),
      };
    default:
      return null;
  }
}

export interface ServerValidateResult {
  spec: Json;
  errors: string[];
}

/** Coerce untrusted model output into a clean, renderable spec. Never throws. */
export function validateDesignSpec(input: unknown): ServerValidateResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return {
      spec: {
        version: DESIGN_SPEC_VERSION,
        theme: validateTheme(undefined),
        blocks: [
          { id: "form-auto", type: "form", heading: "Express Your Interest" },
        ],
      },
      errors: ["Spec was not an object."],
    };
  }

  const theme = validateTheme(input.theme);
  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];
  if (!Array.isArray(input.blocks)) errors.push("blocks was not an array.");

  let blocks: Json[] = [];
  rawBlocks.forEach((raw: unknown, i: number) => {
    const b = validateBlock(raw, i);
    if (b) blocks.push(b);
    else errors.push(`Dropped invalid block at index ${i}.`);
  });

  const formCount = blocks.filter((b) => b.type === "form").length;
  if (formCount === 0) {
    const tailIdx = blocks.findIndex(
      (b) => b.type === "footer" || b.type === "contact",
    );
    const form = {
      id: "form-auto",
      type: "form",
      heading: "Express Your Interest",
    };
    if (tailIdx === -1) blocks.push(form);
    else blocks.splice(tailIdx, 0, form);
    errors.push("No form block present; injected the lead form.");
  } else if (formCount > 1) {
    let seen = false;
    blocks = blocks.filter((b) => {
      if (b.type !== "form") return true;
      if (seen) return false;
      seen = true;
      return true;
    });
    errors.push("Multiple form blocks; kept the first.");
  }

  if (blocks.length > CAPS.maxBlocks) {
    const kept = blocks.slice(0, CAPS.maxBlocks);
    if (!kept.some((b) => b.type === "form")) {
      kept[kept.length - 1] = blocks.find((b) => b.type === "form")!;
    }
    blocks = kept;
    errors.push(`Too many blocks; trimmed to ${CAPS.maxBlocks}.`);
  }

  return { spec: { version: DESIGN_SPEC_VERSION, theme, blocks }, errors };
}

/** A spec is "usable" if it has at least one non-form content block. */
export function isUsableSpec(spec: ServerValidateResult["spec"]): boolean {
  const blocks = Array.isArray(spec.blocks) ? (spec.blocks as Json[]) : [];
  return blocks.some((b) => b.type !== "form");
}
