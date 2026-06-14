// src/types/recruiting-theme.types.ts
// TypeScript types for recruiting page branding/theming

import type { RecruitingDesignSpec } from "./recruiting-design-spec.types";

/**
 * Layout variant options for recruiting pages
 */
export type LayoutVariant =
  | "split-panel"
  | "centered-card"
  | "hero-slide"
  | "multi-section";

/**
 * Logo size options
 */
export type LogoSize = "small" | "medium" | "large" | "xlarge";

/**
 * Logo size to pixel mapping
 */
export const LOGO_SIZE_MAP: Record<
  LogoSize,
  { desktop: number; mobile: number }
> = {
  small: { desktop: 56, mobile: 40 },
  medium: { desktop: 80, mobile: 56 },
  large: { desktop: 112, mobile: 80 },
  xlarge: { desktop: 144, mobile: 104 },
};

/**
 * Social media link configuration
 */
export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

/**
 * Feature flags for recruiting page customization
 */
export interface EnabledFeatures {
  show_stats?: boolean;
  show_testimonials?: boolean;
  collect_phone?: boolean;
  show_location?: boolean;
  show_about?: boolean;
  show_display_name?: boolean; // Show/hide the display name heading
}

/**
 * Public recruiting page theme data
 * Returned by get_public_recruiting_theme RPC and resolve-custom-domain edge function
 */
export interface RecruitingPageTheme {
  // Recruiter identity
  recruiter_first_name: string;
  recruiter_last_name: string;

  // Layout
  layout_variant: LayoutVariant;
  logo_size: LogoSize;

  // Branding
  display_name: string;
  headline: string;
  subheadline: string;
  about_text: string | null;

  // Colors (hex format)
  primary_color: string;
  accent_color: string;

  // Assets
  logo_light_url: string | null;
  logo_dark_url: string | null;
  hero_image_url: string | null;
  /** Recruiter portrait/headshot. Optional until the column is populated. */
  headshot_url?: string | null;

  // CTA & Actions
  cta_text: string;
  calendly_url: string | null;
  support_phone: string | null;

  // Social & Compliance
  social_links: SocialLinks;
  disclaimer_text: string | null;

  // Features
  enabled_features: EnabledFeatures;

  // Location
  default_city: string | null;
  default_state: string | null;

  // AI-composed design (null = fall back to the legacy theme fields above)
  design_spec: RecruitingDesignSpec | null;
}

/**
 * Settings stored in recruiting_page_settings table
 * User-editable branding configuration
 */
export interface RecruitingPageSettings {
  id: string;
  user_id: string;
  imo_id: string;

  // Layout
  layout_variant: LayoutVariant;
  logo_size: LogoSize;

  // Branding
  display_name: string | null;
  headline: string | null;
  subheadline: string | null;
  about_text: string | null;

  // Colors
  primary_color: string | null;
  accent_color: string | null;

  // Assets
  logo_light_url: string | null;
  logo_dark_url: string | null;
  hero_image_url: string | null;
  headshot_url: string | null;

  // CTA & Actions
  cta_text: string | null;
  calendly_url: string | null;
  support_phone: string | null;

  // Social & Compliance
  social_links: SocialLinks;
  disclaimer_text: string | null;

  // Features
  enabled_features: EnabledFeatures;

  // Location
  default_city: string | null;
  default_state: string | null;

  // AI-composed design
  design_spec: RecruitingDesignSpec | null;
  design_prompt: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating/updating recruiting page settings
 */
export interface RecruitingPageSettingsInput {
  layout_variant?: LayoutVariant;
  logo_size?: LogoSize;
  display_name?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  about_text?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  logo_light_url?: string | null;
  logo_dark_url?: string | null;
  hero_image_url?: string | null;
  headshot_url?: string | null;
  cta_text?: string | null;
  calendly_url?: string | null;
  support_phone?: string | null;
  social_links?: SocialLinks;
  disclaimer_text?: string | null;
  enabled_features?: EnabledFeatures;
  default_city?: string | null;
  default_state?: string | null;
  design_spec?: RecruitingDesignSpec | null;
  design_prompt?: string | null;
}

/**
 * Platform default theme values
 * Used when no user/IMO settings exist
 */
export const DEFAULT_THEME: RecruitingPageTheme = {
  recruiter_first_name: "",
  recruiter_last_name: "",
  layout_variant: "split-panel",
  logo_size: "medium",
  display_name: "Insurance Agency",
  headline: "Join Our Team",
  subheadline: "Build your career in insurance",
  about_text: null,
  primary_color: "#0ea5e9", // sky-500
  accent_color: "#22c55e", // green-500
  logo_light_url: null,
  logo_dark_url: null,
  hero_image_url: null,
  headshot_url: null,
  cta_text: "Apply Now",
  calendly_url: null,
  support_phone: null,
  social_links: {},
  disclaimer_text: null,
  enabled_features: {
    show_stats: true,
    collect_phone: true,
    show_location: false,
    show_about: true,
    show_testimonials: false,
    show_display_name: false,
  },
  default_city: null,
  default_state: null,
  design_spec: null,
};

/**
 * Color presets for the color picker
 */
export const COLOR_PRESETS = {
  primary: [
    { name: "Sky", value: "#0ea5e9" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Indigo", value: "#6366f1" },
    { name: "Purple", value: "#a855f7" },
    { name: "Pink", value: "#ec4899" },
    { name: "Rose", value: "#f43f5e" },
    { name: "Red", value: "#ef4444" },
    { name: "Orange", value: "#f97316" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Emerald", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Slate", value: "#64748b" },
  ],
  accent: [
    { name: "Green", value: "#22c55e" },
    { name: "Emerald", value: "#10b981" },
    { name: "Teal", value: "#14b8a6" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Sky", value: "#0ea5e9" },
    { name: "Amber", value: "#f59e0b" },
    { name: "Yellow", value: "#eab308" },
    { name: "Orange", value: "#f97316" },
    { name: "Rose", value: "#f43f5e" },
    { name: "Pink", value: "#ec4899" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Slate", value: "#64748b" },
  ],
};

/**
 * Asset type for upload service
 */
export type RecruitingAssetType =
  | "logo_light"
  | "logo_dark"
  | "hero"
  | "headshot";

/**
 * Storage path structure for recruiting assets
 */
export const RECRUITING_ASSETS_BUCKET = "recruiting-assets";

export function getAssetPath(
  userId: string,
  type: RecruitingAssetType,
  filename: string,
): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
  return `${userId}/${type}_${timestamp}_${sanitizedFilename}`;
}
