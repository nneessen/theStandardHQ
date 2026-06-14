// src/lib/recruiting-design-spec.ts
//
// THE SECURITY BOUNDARY for AI-composed recruiting pages.
//
// validateDesignSpec() takes ANY untrusted input (AI output, a stored jsonb row,
// a tampered payload) and returns a spec that is guaranteed safe to render:
//   • enums coerced to safe defaults (never rejected outright)
//   • hex colors validated; bad colors → default palette
//   • icons restricted to the allowlist; unknown → dropped
//   • text clamped to caps; required-but-empty fields drop their block
//   • unknown keys stripped (incl. any form fields/consent/legal/html keys)
//   • EXACTLY ONE form block guaranteed (injected if 0, first-kept if >1)
// It NEVER throws. The renderer (PublicJoinPage) calls this on every public load.
//
// A server-side mirror lives in
// supabase/functions/generate-recruiting-design/spec-validator.ts — the icon /
// enum / cap allowlists in recruiting-design-spec.types.ts are the shared source
// of truth; keep both in sync.

import {
  DESIGN_SPEC_VERSION,
  FONT_PAIRINGS,
  RADIUS_TOKENS,
  PALETTE_MODES,
  BACKGROUND_STYLES,
  LAYOUT_NAMES,
  SPEC_ICONS,
  HERO_VARIANTS,
  STATS_STYLES,
  CTA_ACTIONS,
  SECONDARY_CTAS,
  SPEC_CAPS,
  type RecruitingDesignSpec,
  type DesignBlock,
  type DesignTheme,
  type SpecIcon,
  type StatItem,
  type ValueItem,
} from "@/types/recruiting-design-spec.types";
import type { RecruitingPageTheme } from "@/types/recruiting-theme.types";
import { DEFAULT_THEME } from "@/types/recruiting-theme.types";
import { isValidHexColor } from "@/lib/recruiting-theme";

// ----------------------------------------------------------------------------
// Primitive coercion helpers
// ----------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Codepoints stripped from rendered text. Beyond C0/DEL we also drop C1 controls,
// zero-width chars, and bidi formatting/overrides — React escapes HTML but does
// NOT neutralize these, so a tampered/AI spec could otherwise spoof display
// (Trojan-source-style reversed/hidden copy) on the public page.
function isUnsafeFormatCodepoint(code: number): boolean {
  return (
    code < 0x20 || // C0 controls (newline handled separately for multiline)
    code === 0x7f || // DEL
    (code >= 0x80 && code <= 0x9f) || // C1 controls
    code === 0x200b ||
    code === 0x200c ||
    code === 0x200d ||
    code === 0xfeff || // zero-width + BOM
    code === 0x200e ||
    code === 0x200f || // LRM / RLM
    (code >= 0x202a && code <= 0x202e) || // bidi embeddings + overrides
    (code >= 0x2066 && code <= 0x2069) // bidi isolates
  );
}

function cleanText(
  v: unknown,
  max: number,
  multiline = false,
): string | undefined {
  if (typeof v !== "string") return undefined;
  // Single-line fields collapse ALL whitespace to one space. Long-form fields
  // (multiline) collapse spaces/tabs but keep paragraph breaks (max 2 newlines).
  // Then drop non-printable / display-spoofing codepoints. We do NOT strip angle
  // brackets: React escapes them on render, and stripping would mangle valid copy
  // (e.g. "P&C < 5 yrs"). Render-as-text is the safety guarantee.
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
      out += ch; // keep newline
      continue;
    }
    if (!isUnsafeFormatCodepoint(code)) out += ch;
  }
  out = out.trim();
  if (!out) return undefined;
  return out.slice(0, max);
}

function pickEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

function pickEnumOpt<T extends string>(
  v: unknown,
  allowed: readonly T[],
): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

function pickIcon(v: unknown): SpecIcon | undefined {
  return pickEnumOpt(v, SPEC_ICONS);
}

function validHexOr(v: unknown, fallback: string): string {
  return typeof v === "string" && isValidHexColor(v) ? v : fallback;
}

function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

// ----------------------------------------------------------------------------
// Defaults
// ----------------------------------------------------------------------------

export const DEFAULT_DESIGN_SPEC: RecruitingDesignSpec = {
  version: DESIGN_SPEC_VERSION,
  layout: "split-form",
  theme: {
    palette: {
      primary: DEFAULT_THEME.primary_color,
      accent: DEFAULT_THEME.accent_color,
    },
    mode: "light",
    font_pairing: "editorial",
    radius: "sharp",
    background_style: "topo-grid",
  },
  blocks: [
    {
      id: "hero-0",
      type: "hero",
      variant: "split",
      eyebrow: "Recruiting Now",
      headline: DEFAULT_THEME.headline,
      subhead: DEFAULT_THEME.subheadline,
      primary_cta: DEFAULT_THEME.cta_text,
      secondary_cta: "none",
    },
    {
      id: "form-0",
      type: "form",
      heading: "Express Your Interest",
      subcopy: "Fill out the form and we'll be in touch within 24-48 hours.",
    },
  ],
};

function defaultFormBlock(idSuffix = "auto"): DesignBlock {
  return {
    id: `form-${idSuffix}`,
    type: "form",
    heading: "Express Your Interest",
    subcopy: "Fill out the form and we'll be in touch within 24-48 hours.",
  };
}

// ----------------------------------------------------------------------------
// Theme validation
// ----------------------------------------------------------------------------

function validateTheme(input: unknown): DesignTheme {
  const t = isRecord(input) ? input : {};
  const p = isRecord(t.palette) ? t.palette : {};
  return {
    palette: {
      primary: validHexOr(p.primary, DEFAULT_DESIGN_SPEC.theme.palette.primary),
      accent: validHexOr(p.accent, DEFAULT_DESIGN_SPEC.theme.palette.accent),
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

// ----------------------------------------------------------------------------
// Per-block validation. Returns a cleaned block, or null to DROP it.
// `index` only feeds the generated id, so output is deterministic.
// ----------------------------------------------------------------------------

function validateBlock(input: unknown, index: number): DesignBlock | null {
  if (!isRecord(input)) return null;
  const type = input.type;
  // The validator OWNS block ids — always derive a unique one from the position
  // (never trust input.id, which could collide and break React keys at render).
  const id = `${typeof type === "string" ? type : "block"}-${index}`;
  const cap = SPEC_CAPS.text;

  switch (type) {
    case "hero": {
      const headline = cleanText(input.headline, cap.headline);
      if (!headline) return null; // hero needs a headline
      return {
        id,
        type: "hero",
        variant: pickEnum(input.variant, HERO_VARIANTS, "split"),
        eyebrow: cleanText(input.eyebrow, cap.eyebrow),
        headline,
        subhead: cleanText(input.subhead, cap.subhead),
        primary_cta: cleanText(input.primary_cta, cap.ctaText),
        secondary_cta: pickEnumOpt(input.secondary_cta, SECONDARY_CTAS),
      };
    }
    case "stats": {
      const rawItems = Array.isArray(input.items) ? input.items : [];
      const items: StatItem[] = [];
      for (const raw of rawItems) {
        if (items.length >= SPEC_CAPS.maxStatsItems) break;
        if (!isRecord(raw)) continue;
        const value = cleanText(raw.value, cap.statValue);
        const label = cleanText(raw.label, cap.statLabel);
        if (!value || !label) continue;
        items.push({ icon: pickIcon(raw.icon), value, label });
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
      const rawItems = Array.isArray(input.items) ? input.items : [];
      const items: ValueItem[] = [];
      for (const raw of rawItems) {
        if (items.length >= SPEC_CAPS.maxValueGridItems) break;
        if (!isRecord(raw)) continue;
        const title = cleanText(raw.title, cap.itemTitle);
        if (!title) continue;
        items.push({
          icon: pickIcon(raw.icon),
          title,
          body: cleanText(raw.body, cap.itemBody),
        });
      }
      if (items.length === 0) return null;
      return {
        id,
        type: "value_grid",
        heading: cleanText(input.heading, cap.heading),
        items,
      };
    }
    case "about": {
      const body = cleanText(input.body, cap.body, true);
      if (!body) return null;
      return {
        id,
        type: "about",
        heading: cleanText(input.heading, cap.heading),
        body,
      };
    }
    case "testimonial": {
      const quote = cleanText(input.quote, cap.quote, true);
      if (!quote) return null;
      return {
        id,
        type: "testimonial",
        quote,
        attribution: cleanText(input.attribution, cap.attribution),
      };
    }
    case "form": {
      // Cosmetic copy ONLY. Any fields/consent/legal/html keys are dropped here
      // by simply never reading them — the real form is LeadInterestForm.
      return {
        id,
        type: "form",
        eyebrow: cleanText(input.eyebrow, cap.eyebrow),
        heading: cleanText(input.heading, cap.heading),
        subcopy: cleanText(input.subcopy, cap.subhead),
        cta_text: cleanText(input.cta_text, cap.ctaText),
      };
    }
    case "cta": {
      const headline = cleanText(input.headline, cap.headline);
      if (!headline) return null;
      return {
        id,
        type: "cta",
        headline,
        button_text: cleanText(input.button_text, cap.ctaText),
        action: pickEnum(input.action, CTA_ACTIONS, "open_form"),
      };
    }
    case "contact": {
      return {
        id,
        type: "contact",
        show_phone: pickBool(input.show_phone, true),
        show_socials: pickBool(input.show_socials, true),
      };
    }
    case "footer": {
      return {
        id,
        type: "footer",
        show_copyright: pickBool(input.show_copyright, true),
      };
    }
    default:
      // Unknown / future block type → drop (forward-compatible).
      return null;
  }
}

// ----------------------------------------------------------------------------
// Public validator
// ----------------------------------------------------------------------------

export interface ValidateResult {
  /** Always a renderable, safe spec. */
  spec: RecruitingDesignSpec;
  /** Human-readable notes about what was coerced/dropped (for wizard feedback). */
  errors: string[];
}

export function validateDesignSpec(input: unknown): ValidateResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { spec: DEFAULT_DESIGN_SPEC, errors: ["Spec was not an object."] };
  }

  const theme = validateTheme(input.theme);

  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];
  if (!Array.isArray(input.blocks)) errors.push("blocks was not an array.");

  let blocks: DesignBlock[] = [];
  rawBlocks.forEach((raw, i) => {
    const block = validateBlock(raw, i);
    if (block) blocks.push(block);
    else errors.push(`Dropped invalid block at index ${i}.`);
  });

  // Guarantee EXACTLY ONE form block.
  const formCount = blocks.filter((b) => b.type === "form").length;
  if (formCount === 0) {
    // Inject before the first footer/contact, else append.
    const tailIdx = blocks.findIndex(
      (b) => b.type === "footer" || b.type === "contact",
    );
    const form = defaultFormBlock();
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

  // Enforce maxBlocks while ALWAYS preserving the single form block.
  if (blocks.length > SPEC_CAPS.maxBlocks) {
    const kept = blocks.slice(0, SPEC_CAPS.maxBlocks);
    if (!kept.some((b) => b.type === "form")) {
      const form = blocks.find((b) => b.type === "form")!;
      kept[kept.length - 1] = form;
    }
    blocks = kept;
    errors.push(`Too many blocks; trimmed to ${SPEC_CAPS.maxBlocks}.`);
  }

  // layout selects the trusted render shell; default "split-form" preserves the
  // pre-layout-field look for any spec (legacy/AI/template) that omits it.
  const layout = pickEnum(input.layout, LAYOUT_NAMES, "split-form");

  return {
    spec: { version: DESIGN_SPEC_VERSION, layout, theme, blocks },
    errors,
  };
}

// ----------------------------------------------------------------------------
// Legacy fallback: turn an existing RecruitingPageTheme (colors/copy/features)
// into an equivalent on-brand spec. Renders the 100% of recruiters who have no
// design_spec yet. Output is guaranteed to pass validateDesignSpec unchanged.
// ----------------------------------------------------------------------------

export function legacyThemeToSpec(
  theme: RecruitingPageTheme,
): RecruitingDesignSpec {
  const features = theme.enabled_features ?? {};
  const blocks: DesignBlock[] = [];

  blocks.push({
    id: "hero-0",
    type: "hero",
    variant: "split",
    eyebrow: "Recruiting Now",
    headline: theme.headline || DEFAULT_THEME.headline,
    subhead: theme.subheadline || DEFAULT_THEME.subheadline,
    primary_cta: theme.cta_text || DEFAULT_THEME.cta_text,
    secondary_cta: theme.calendly_url ? "book_call" : "none",
  });

  // NOTE: the legacy fallback deliberately does NOT fabricate stats or earnings
  // claims (e.g. "$20K+ avg", "30+ carriers", "uncapped earnings"). Those would
  // be unverified factual/income claims published on a public recruiting page the
  // agency never authored. Specific numbers only come from the AI builder, where
  // the agent authors the copy. Here we use neutral, non-factual benefits.
  blocks.push({
    id: "values-0",
    type: "value_grid",
    heading: "Why join us",
    items: [
      { icon: "book-open", title: "Full training" },
      { icon: "users", title: "Mentorship" },
      { icon: "clock", title: "Flexible schedule" },
      { icon: "trending-up", title: "Career growth" },
      { icon: "handshake", title: "Supportive team" },
      { icon: "zap", title: "Modern tools" },
    ],
  });

  if (features.show_about !== false && theme.about_text) {
    blocks.push({
      id: "about-0",
      type: "about",
      heading: "About",
      body: theme.about_text,
    });
  }

  blocks.push({
    id: "form-0",
    type: "form",
    eyebrow: "Apply",
    heading: "Express Your Interest",
    subcopy: "Fill out the form and we'll be in touch within 24-48 hours.",
    cta_text: theme.cta_text || DEFAULT_THEME.cta_text,
  });

  blocks.push({
    id: "contact-0",
    type: "contact",
    show_phone: !!theme.support_phone,
    show_socials: true,
  });
  blocks.push({ id: "footer-0", type: "footer", show_copyright: true });

  // Run through the validator so the result is provably canonical/safe.
  return validateDesignSpec({
    version: DESIGN_SPEC_VERSION,
    layout: "split-form",
    theme: {
      palette: {
        primary: theme.primary_color || DEFAULT_THEME.primary_color,
        accent: theme.accent_color || DEFAULT_THEME.accent_color,
      },
      mode: "light",
      font_pairing: "editorial",
      radius: "sharp",
      background_style: "topo-grid",
    },
    blocks,
  }).spec;
}
