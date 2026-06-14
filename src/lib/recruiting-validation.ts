// src/lib/recruiting-validation.ts
// Zod schemas for validating recruiting page branding data
// Prevents runtime errors from malformed JSONB and XSS via URL injection

import { z } from "zod";
import type {
  SocialLinks,
  EnabledFeatures,
  RecruitingPageTheme,
  RecruitingPageSettings,
  LayoutVariant,
} from "@/types/recruiting-theme.types";
import { DEFAULT_THEME } from "@/types/recruiting-theme.types";

// ============================================================================
// LAYOUT VARIANT VALIDATION
// ============================================================================

const layoutVariantSchema = z.enum([
  "split-panel",
  "centered-card",
  "hero-slide",
  "multi-section",
]);

export function isValidLayoutVariant(value: unknown): value is LayoutVariant {
  return layoutVariantSchema.safeParse(value).success;
}

// ============================================================================
// LOGO SIZE VALIDATION
// ============================================================================

const logoSizeSchema = z.enum(["small", "medium", "large", "xlarge"]);

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Safe URL schema - only allows http:// or https:// protocols
 * Prevents javascript:, data:, and other dangerous schemes
 */
const safeUrlSchema = z
  .string()
  .refine(
    (url) => {
      if (!url || url.trim() === "") return true; // Empty is OK
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must use http:// or https:// protocol" },
  )
  .optional()
  .nullable();

/**
 * Validate a single URL string
 */
export function isValidSafeUrl(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ============================================================================
// HEX COLOR VALIDATION
// ============================================================================

/**
 * Hex color schema - validates format #RRGGBB
 */
const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, { message: "Color must be in #RRGGBB format" })
  .optional()
  .nullable();

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string | null | undefined): boolean {
  if (!color) return true;
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// ============================================================================
// SOCIAL LINKS SCHEMA
// ============================================================================

/**
 * Schema for social_links JSONB field
 * Validates structure and ensures all URLs are safe
 * Using passthrough() instead of strict() to handle any extra DB metadata gracefully
 */
export const socialLinksSchema = z
  .object({
    facebook: safeUrlSchema,
    instagram: safeUrlSchema,
    twitter: safeUrlSchema,
    youtube: safeUrlSchema,
  })
  .passthrough()
  .optional()
  .nullable();

/**
 * Validate and sanitize social links JSONB
 * Returns safe defaults on failure
 * Converts null values to undefined for SocialLinks type compatibility
 */
export function validateSocialLinks(data: unknown): SocialLinks {
  try {
    // Handle null/undefined input
    if (data === null || data === undefined) {
      return {};
    }

    // If data is not an object, return empty
    if (typeof data !== "object") {
      console.warn(
        "[recruiting-validation] social_links is not an object:",
        typeof data,
      );
      return {};
    }

    const result = socialLinksSchema.parse(data);
    if (!result) return {};

    // Convert null to undefined for type compatibility
    // Also filter out empty strings
    const cleaned: SocialLinks = {};
    if (result.facebook && result.facebook.trim() !== "") {
      cleaned.facebook = result.facebook;
    }
    if (result.instagram && result.instagram.trim() !== "") {
      cleaned.instagram = result.instagram;
    }
    if (result.twitter && result.twitter.trim() !== "") {
      cleaned.twitter = result.twitter;
    }
    if (result.youtube && result.youtube.trim() !== "") {
      cleaned.youtube = result.youtube;
    }

    return cleaned;
  } catch (error) {
    console.warn(
      "[recruiting-validation] Invalid social_links data, using defaults:",
      error,
      "Input was:",
      data,
    );
    return {};
  }
}

// ============================================================================
// ENABLED FEATURES SCHEMA
// ============================================================================

/**
 * Schema for enabled_features JSONB field
 */
export const enabledFeaturesSchema = z
  .object({
    show_stats: z.boolean().optional(),
    show_testimonials: z.boolean().optional(),
    collect_phone: z.boolean().optional(),
    show_location: z.boolean().optional(),
    show_about: z.boolean().optional(),
    show_display_name: z.boolean().optional(),
  })
  .strict()
  .optional()
  .nullable();

/**
 * Validate and sanitize enabled features JSONB
 * Returns safe defaults on failure
 */
export function validateEnabledFeatures(data: unknown): EnabledFeatures {
  try {
    const result = enabledFeaturesSchema.parse(data);
    return result || DEFAULT_THEME.enabled_features;
  } catch (error) {
    console.warn(
      "[recruiting-validation] Invalid enabled_features data, using defaults:",
      error,
    );
    return DEFAULT_THEME.enabled_features;
  }
}

// ============================================================================
// FULL THEME VALIDATION
// ============================================================================

/**
 * Schema for the full public recruiting page theme
 */
export const recruitingPageThemeSchema = z.object({
  recruiter_first_name: z.string().default(""),
  recruiter_last_name: z.string().default(""),
  layout_variant: layoutVariantSchema.default("split-panel"),
  logo_size: logoSizeSchema.default("medium"),
  display_name: z.string().default(DEFAULT_THEME.display_name),
  headline: z.string().default(DEFAULT_THEME.headline),
  subheadline: z.string().default(DEFAULT_THEME.subheadline),
  about_text: z.string().nullable().default(null),
  primary_color: hexColorSchema.default(DEFAULT_THEME.primary_color),
  accent_color: hexColorSchema.default(DEFAULT_THEME.accent_color),
  logo_light_url: safeUrlSchema,
  logo_dark_url: safeUrlSchema,
  hero_image_url: safeUrlSchema,
  headshot_url: safeUrlSchema,
  cta_text: z.string().default(DEFAULT_THEME.cta_text),
  calendly_url: safeUrlSchema,
  support_phone: z.string().nullable().optional(),
  social_links: socialLinksSchema.default({}),
  disclaimer_text: z.string().nullable().optional(),
  enabled_features: enabledFeaturesSchema.default(
    DEFAULT_THEME.enabled_features,
  ),
  default_city: z.string().nullable().optional(),
  default_state: z.string().nullable().optional(),
  // Untrusted jsonb passed through verbatim — the renderer (PublicJoinPage)
  // re-validates via validateDesignSpec() before anything is shown. Without this
  // line the z.object() would silently DROP design_spec on read.
  design_spec: z.any().nullable().optional().default(null),
});

/**
 * Validate and sanitize full theme data from database/API
 * Returns safe defaults for any invalid fields
 */
export function validateRecruitingTheme(data: unknown): RecruitingPageTheme {
  try {
    // Handle null/undefined
    if (!data) {
      return DEFAULT_THEME;
    }

    const result = recruitingPageThemeSchema.parse(data);

    // Ensure social_links and enabled_features are objects, not null
    return {
      ...result,
      social_links: result.social_links || {},
      enabled_features:
        result.enabled_features || DEFAULT_THEME.enabled_features,
    } as RecruitingPageTheme;
  } catch (error) {
    console.error(
      "[recruiting-validation] Theme validation failed, using defaults:",
      error,
    );
    return DEFAULT_THEME;
  }
}

// ============================================================================
// SETTINGS INPUT VALIDATION
// ============================================================================

/**
 * Schema for branding settings input (create/update)
 */
export const brandingSettingsInputSchema = z.object({
  layout_variant: layoutVariantSchema.optional(),
  logo_size: logoSizeSchema.optional(),
  display_name: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  subheadline: z.string().nullable().optional(),
  about_text: z.string().nullable().optional(),
  primary_color: hexColorSchema,
  accent_color: hexColorSchema,
  logo_light_url: safeUrlSchema,
  logo_dark_url: safeUrlSchema,
  hero_image_url: safeUrlSchema,
  headshot_url: safeUrlSchema,
  cta_text: z.string().nullable().optional(),
  calendly_url: safeUrlSchema,
  support_phone: z.string().nullable().optional(),
  social_links: socialLinksSchema,
  disclaimer_text: z.string().nullable().optional(),
  enabled_features: enabledFeaturesSchema,
  default_city: z.string().nullable().optional(),
  default_state: z.string().nullable().optional(),
  // Persisted as jsonb. The wizard validates the spec client-side before save,
  // and the public renderer re-validates on every load — so a loose passthrough
  // here is safe.
  design_spec: z.any().nullable().optional(),
  design_prompt: z.string().nullable().optional(),
});

export type ValidatedBrandingInput = z.infer<
  typeof brandingSettingsInputSchema
>;

/**
 * Validate branding settings input before saving
 * Throws error if validation fails (caller should handle)
 */
export function validateBrandingInput(data: unknown): ValidatedBrandingInput {
  return brandingSettingsInputSchema.parse(data);
}

/**
 * Safely validate branding input, returning errors instead of throwing
 */
export function safeParseBrandingInput(data: unknown): {
  success: boolean;
  data?: ValidatedBrandingInput;
  errors?: string[];
} {
  const result = brandingSettingsInputSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map(
    (e) => `${e.path.join(".")}: ${e.message}`,
  );

  return { success: false, errors };
}

// ============================================================================
// SETTINGS ROW VALIDATION
// ============================================================================

/**
 * Validate settings row from database
 * Ensures JSONB fields are properly typed
 */
export function validateSettingsRow(
  row: unknown,
): RecruitingPageSettings | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const data = row as Record<string, unknown>;

  // Validate JSONB fields
  const social_links = validateSocialLinks(data.social_links);
  const enabled_features = validateEnabledFeatures(data.enabled_features);

  return {
    ...data,
    social_links,
    enabled_features,
  } as RecruitingPageSettings;
}
