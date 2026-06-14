// src/types/recruiting-design-spec.types.ts
//
// Structured, validated design spec for AI-composed recruiting landing pages.
// The AI emits ONLY this shape (never raw HTML / CSS / JS); trusted React
// renders it from a fixed block library.
//
// SECURITY CONTRACT: every field is one of —
//   • an allowlisted enum (font_pairing, radius, mode, background_style,
//     block type, hero variant, cta action, icon), or
//   • a validated hex color (#RRGGBB), or
//   • plain text rendered as React text (auto-escaped — never an attribute).
// CTA targets are ENUMS, never URLs, so the AI cannot inject a `javascript:` href.
// The runtime enforcement lives in src/lib/recruiting-design-spec.ts
// (validateDesignSpec), mirrored server-side in
// supabase/functions/generate-recruiting-design/spec-validator.ts.
// The allowlists below are the single source of truth — keep both validators in sync.

export const DESIGN_SPEC_VERSION = 1 as const;

// ============================================================================
// THEME ENUMS + RENDER MAPS
// ============================================================================

/** Font pairings — display+body families. ONLY fonts loaded in index.html. */
export const FONT_PAIRINGS = [
  "editorial",
  "modern",
  "grotesk",
  "mono",
  "impact",
] as const;
export type FontPairing = (typeof FONT_PAIRINGS)[number];

export const RADIUS_TOKENS = ["sharp", "soft", "round"] as const;
export type RadiusToken = (typeof RADIUS_TOKENS)[number];

export const PALETTE_MODES = ["light", "dark"] as const;
export type PaletteMode = (typeof PALETTE_MODES)[number];

export const BACKGROUND_STYLES = [
  "topo-grid",
  "flat",
  "floating-shapes",
  "lattice",
] as const;
export type BackgroundStyle = (typeof BACKGROUND_STYLES)[number];

/** display = headline font stack, body = paragraph/mono font stack. */
export const FONT_PAIRING_MAP: Record<
  FontPairing,
  { display: string; body: string }
> = {
  editorial: {
    display: `"Big Shoulders Display", "Arial Black", system-ui, sans-serif`,
    body: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`,
  },
  modern: {
    display: `"Archivo", system-ui, -apple-system, sans-serif`,
    body: `"Plus Jakarta Sans", system-ui, -apple-system, sans-serif`,
  },
  grotesk: {
    display: `"Hanken Grotesk", system-ui, -apple-system, sans-serif`,
    body: `"Inter", system-ui, -apple-system, sans-serif`,
  },
  mono: {
    display: `"Space Mono", ui-monospace, SFMono-Regular, monospace`,
    body: `"Space Mono", ui-monospace, SFMono-Regular, monospace`,
  },
  impact: {
    display: `"Anton", "Arial Black", system-ui, sans-serif`,
    body: `"Hanken Grotesk", system-ui, -apple-system, sans-serif`,
  },
};

export const RADIUS_MAP: Record<RadiusToken, string> = {
  sharp: "2px",
  soft: "8px",
  round: "16px",
};

// ============================================================================
// ICON ALLOWLIST (maps to a fixed lucide-react subset in blocks/icons.ts)
// ============================================================================

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
] as const;
export type SpecIcon = (typeof SPEC_ICONS)[number];

// ============================================================================
// LAYOUT SHELLS
// ============================================================================

/**
 * The top-level page LAYOUT — selects which trusted React shell renders the
 * spec. This is what makes templates structurally DIFFERENT (not just recolored):
 * each shell is its own hero treatment, headshot placement, and form position.
 *
 * NOT to be confused with the legacy `layout_variant` on RecruitingPageTheme
 * (split-panel/centered-card/...), which is vestigial and ignored by the renderer.
 *
 * Adding a value here requires a matching entry in the shell registry
 * (src/features/recruiting/layouts/shells/registry.ts) and the server mirror
 * (spec-validator.ts LAYOUT_NAMES). "split-form" is the default (back-compat with
 * every spec authored before this field existed → renders exactly as before).
 */
export const LAYOUT_NAMES = [
  "split-form",
  "cover-hero",
  "centered-funnel",
  "identity-sidebar",
  "editorial-bands",
  "stacked-card",
  "poster-impact",
  "split-hero-stack",
] as const;
export type LayoutName = (typeof LAYOUT_NAMES)[number];

// ============================================================================
// BLOCK ENUMS
// ============================================================================

export const BLOCK_TYPES = [
  "hero",
  "stats",
  "value_grid",
  "about",
  "testimonial",
  "form",
  "cta",
  "contact",
  "footer",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const HERO_VARIANTS = ["stacked", "split", "minimal"] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export const STATS_STYLES = ["lattice", "inline"] as const;
export type StatsStyle = (typeof STATS_STYLES)[number];

/** Primary CTAs always open the lead form. Secondary may book a call. */
export const CTA_ACTIONS = ["open_form", "book_call"] as const;
export type CtaAction = (typeof CTA_ACTIONS)[number];

export const SECONDARY_CTAS = ["book_call", "none"] as const;
export type SecondaryCta = (typeof SECONDARY_CTAS)[number];

// ============================================================================
// BLOCKS
// ============================================================================

interface BlockBase {
  /** Stable key for React lists; generated by the validator if missing. */
  id: string;
}

export interface HeroBlock extends BlockBase {
  type: "hero";
  variant: HeroVariant;
  eyebrow?: string;
  headline: string;
  subhead?: string;
  /** Button label only — always opens the lead form. */
  primary_cta?: string;
  secondary_cta?: SecondaryCta;
}

export interface StatItem {
  icon?: SpecIcon;
  value: string;
  label: string;
}
export interface StatsBlock extends BlockBase {
  type: "stats";
  style: StatsStyle;
  items: StatItem[];
}

export interface ValueItem {
  icon?: SpecIcon;
  title: string;
  body?: string;
}
export interface ValueGridBlock extends BlockBase {
  type: "value_grid";
  heading?: string;
  items: ValueItem[];
}

export interface AboutBlock extends BlockBase {
  type: "about";
  heading?: string;
  body: string;
}

export interface TestimonialBlock extends BlockBase {
  type: "testimonial";
  quote: string;
  attribution?: string;
}

/**
 * The lead-capture block. Carries ONLY cosmetic copy. The form fields and the
 * legally-required TCPA consent live inside LeadInterestForm and are NEVER
 * authored here — the validator strips any fields/consent/legal/html keys.
 */
export interface FormBlock extends BlockBase {
  type: "form";
  eyebrow?: string;
  heading?: string;
  subcopy?: string;
  cta_text?: string;
}

export interface CtaBlock extends BlockBase {
  type: "cta";
  headline: string;
  button_text?: string;
  action: CtaAction;
}

export interface ContactBlock extends BlockBase {
  type: "contact";
  show_phone?: boolean;
  show_socials?: boolean;
}

export interface FooterBlock extends BlockBase {
  type: "footer";
  show_copyright?: boolean;
}

export type DesignBlock =
  | HeroBlock
  | StatsBlock
  | ValueGridBlock
  | AboutBlock
  | TestimonialBlock
  | FormBlock
  | CtaBlock
  | ContactBlock
  | FooterBlock;

// ============================================================================
// THEME + SPEC
// ============================================================================

export interface SpecPalette {
  primary: string;
  accent: string;
}

export interface DesignTheme {
  palette: SpecPalette;
  mode: PaletteMode;
  font_pairing: FontPairing;
  radius: RadiusToken;
  background_style: BackgroundStyle;
}

export interface RecruitingDesignSpec {
  version: number;
  /** Which trusted render shell draws this spec. Defaults to "split-form". */
  layout: LayoutName;
  theme: DesignTheme;
  blocks: DesignBlock[];
}

// ============================================================================
// CAPS — counts + text lengths (enforced by the validator)
// ============================================================================

export const SPEC_CAPS = {
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
} as const;
