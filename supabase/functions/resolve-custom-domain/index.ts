// supabase/functions/resolve-custom-domain/index.ts
// Edge Function: resolve-custom-domain
// PUBLIC endpoint (no auth) - resolves hostname to recruiter_slug + theme
// Returns recruiter_slug and branding theme, never exposes user_id, imo_id, or status
// SECURITY: All response fields are explicitly whitelisted - never spread from DB

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

// Layout variant type
type LayoutVariant =
  | "split-panel"
  | "centered-card"
  | "hero-slide"
  | "multi-section";

// Logo size type
type LogoSize = "small" | "medium" | "large" | "xlarge";

// Theme interface matching get_public_recruiting_theme RPC response
// These are the ONLY fields that can be returned to the public
interface RecruitingPageTheme {
  recruiter_first_name: string;
  recruiter_last_name: string;
  layout_variant: LayoutVariant;
  logo_size: LogoSize;
  display_name: string;
  headline: string;
  subheadline: string;
  about_text: string | null;
  primary_color: string;
  accent_color: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  hero_image_url: string | null;
  cta_text: string;
  calendly_url: string | null;
  support_phone: string | null;
  social_links: Record<string, string>;
  disclaimer_text: string | null;
  enabled_features: Record<string, boolean>;
  default_city: string | null;
  default_state: string | null;
  // AI-composed design spec. Deliberate exception to this file's
  // whitelist-every-field rule: a full discriminated-union spec can't be deeply
  // validated here without duplicating the frontend validator. Deep validation is
  // delegated to (a) the edge generator at write time and (b) the frontend
  // renderer (validateDesignSpec), which re-validates before render. We only
  // guarantee here that it's a plain object or null — never an array/scalar.
  design_spec: Record<string, unknown> | null;
}

interface ResolveResponse {
  recruiter_slug: string;
  theme: RecruitingPageTheme;
}

/**
 * Validate layout variant
 */
function isValidLayoutVariant(value: unknown): value is LayoutVariant {
  return (
    value === "split-panel" ||
    value === "centered-card" ||
    value === "hero-slide" ||
    value === "multi-section"
  );
}

/**
 * Validate logo size
 */
function isValidLogoSize(value: unknown): value is LogoSize {
  return (
    value === "small" ||
    value === "medium" ||
    value === "large" ||
    value === "xlarge"
  );
}

/**
 * Sanitize and whitelist theme fields from RPC response
 * SECURITY: Only returns explicitly whitelisted fields
 * Never use object spread on untrusted data
 */
function sanitizeTheme(rawTheme: Record<string, unknown>): RecruitingPageTheme {
  return {
    // Identity - strings only
    recruiter_first_name: String(rawTheme.recruiter_first_name || ""),
    recruiter_last_name: String(rawTheme.recruiter_last_name || ""),

    // Layout - validated enum
    layout_variant: isValidLayoutVariant(rawTheme.layout_variant)
      ? rawTheme.layout_variant
      : "split-panel",

    // Logo size - validated enum
    logo_size: isValidLogoSize(rawTheme.logo_size)
      ? rawTheme.logo_size
      : "medium",

    // Branding - strings only
    display_name: String(rawTheme.display_name || "Insurance Agency"),
    headline: String(rawTheme.headline || "Join Our Team"),
    subheadline: String(
      rawTheme.subheadline || "Build your career in insurance",
    ),
    about_text: rawTheme.about_text ? String(rawTheme.about_text) : null,

    // Colors - validate hex format, fallback to defaults
    primary_color: isValidHexColor(rawTheme.primary_color)
      ? String(rawTheme.primary_color)
      : "#0ea5e9",
    accent_color: isValidHexColor(rawTheme.accent_color)
      ? String(rawTheme.accent_color)
      : "#22c55e",

    // Assets - URLs must be http(s) or null
    logo_light_url: isValidUrl(rawTheme.logo_light_url)
      ? String(rawTheme.logo_light_url)
      : null,
    logo_dark_url: isValidUrl(rawTheme.logo_dark_url)
      ? String(rawTheme.logo_dark_url)
      : null,
    hero_image_url: isValidUrl(rawTheme.hero_image_url)
      ? String(rawTheme.hero_image_url)
      : null,

    // CTA & Actions
    cta_text: String(rawTheme.cta_text || "Apply Now"),
    calendly_url: isValidUrl(rawTheme.calendly_url)
      ? String(rawTheme.calendly_url)
      : null,
    support_phone: rawTheme.support_phone
      ? String(rawTheme.support_phone)
      : null,

    // Social links - validate all URLs
    social_links: sanitizeSocialLinks(rawTheme.social_links),

    // Compliance
    disclaimer_text: rawTheme.disclaimer_text
      ? String(rawTheme.disclaimer_text)
      : null,

    // Features - boolean only
    enabled_features: sanitizeEnabledFeatures(rawTheme.enabled_features),

    // Location
    default_city: rawTheme.default_city ? String(rawTheme.default_city) : null,
    default_state: rawTheme.default_state
      ? String(rawTheme.default_state)
      : null,

    // AI-composed design spec — shallow guard (plain object or null). The
    // frontend renderer re-validates the full structure before render.
    design_spec:
      rawTheme.design_spec &&
      typeof rawTheme.design_spec === "object" &&
      !Array.isArray(rawTheme.design_spec)
        ? (rawTheme.design_spec as Record<string, unknown>)
        : null,
  };
}

/**
 * Validate hex color format
 */
function isValidHexColor(value: unknown): boolean {
  if (!value || typeof value !== "string") return false;
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

/**
 * Validate URL is http(s) scheme
 */
function isValidUrl(value: unknown): boolean {
  if (!value || typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Sanitize social links - only valid http(s) URLs
 */
function sanitizeSocialLinks(links: unknown): Record<string, string> {
  if (!links || typeof links !== "object") return {};

  const result: Record<string, string> = {};
  const allowedKeys = ["facebook", "instagram", "twitter", "youtube"];

  for (const key of allowedKeys) {
    const value = (links as Record<string, unknown>)[key];
    if (isValidUrl(value)) {
      result[key] = String(value);
    }
  }

  return result;
}

/**
 * Sanitize enabled features - booleans only
 */
function sanitizeEnabledFeatures(features: unknown): Record<string, boolean> {
  if (!features || typeof features !== "object") {
    return { show_stats: true, collect_phone: true, show_display_name: true };
  }

  const result: Record<string, boolean> = {};
  const allowedKeys = [
    "show_stats",
    "show_testimonials",
    "collect_phone",
    "show_location",
    "show_about",
    "show_display_name",
  ];

  for (const key of allowedKeys) {
    const value = (features as Record<string, unknown>)[key];
    if (typeof value === "boolean") {
      result[key] = value;
    }
  }

  return result;
}

function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  // For custom domains, we need to allow any origin since the request
  // will come from the custom domain itself
  const origin = requestOrigin || "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    // Cache the response for 60 seconds
    "Cache-Control": "public, max-age=60, s-maxage=60",
  };
}

// Reserved/blocked patterns
const BLOCKED_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "::1",
  ".local",
  ".localhost",
  ".test",
  ".example",
  ".invalid",
];

const RESERVED_DOMAINS = [
  "thestandardhq.com",
  "www.thestandardhq.com",
  ".vercel.app",
  ".vercel.sh",
];

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(null, { status: 404, headers: corsHeaders });
  }

  try {
    // Get hostname from query params
    const url = new URL(req.url);
    const hostname = url.searchParams.get("hostname");

    // Validate hostname is provided
    if (!hostname || typeof hostname !== "string") {
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    const normalized = hostname.toLowerCase().trim();

    // Security: Reject invalid hostnames (return 404, no details)
    // Max length check
    if (normalized.length > 253 || normalized.length < 5) {
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    // Must have at least 2 dots (subdomain requirement)
    const dotCount = (normalized.match(/\./g) || []).length;
    if (dotCount < 2) {
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    // Reject IP addresses
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(normalized)) {
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    // Reject blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (normalized === pattern || normalized.endsWith(pattern)) {
        return new Response(null, { status: 404, headers: corsHeaders });
      }
    }

    // Reject reserved domains (prevents resolver loops)
    for (const reserved of RESERVED_DOMAINS) {
      if (normalized === reserved || normalized.endsWith(reserved)) {
        return new Response(null, { status: 404, headers: corsHeaders });
      }
    }

    // Create admin client (service_role needed to bypass RLS for public lookup)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Query for active domain (uses partial index for performance)
    const { data: domain, error: domainError } = await supabaseAdmin
      .from("custom_domains")
      .select("user_id")
      .eq("hostname", normalized)
      .eq("status", "active")
      .maybeSingle();

    // Domain not found or not active - return 404 (no details)
    if (domainError || !domain) {
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    // Fetch user's current recruiter_slug (dynamic lookup)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("recruiter_slug")
      .eq("id", domain.user_id)
      .maybeSingle();

    // User not found or no slug - return 404 (no details)
    if (profileError || !profile || !profile.recruiter_slug) {
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    // Fetch theme using the RPC (handles precedence: user -> IMO -> platform defaults)
    const { data: theme, error: themeError } = await supabaseAdmin.rpc(
      "get_public_recruiting_theme",
      { p_slug: profile.recruiter_slug },
    );

    // If theme fetch fails or the slug resolves to a now-private/unlisted IMO,
    // return 404 instead of leaking the recruiter slug.
    if (themeError || !theme) {
      console.warn(
        "[resolve-custom-domain] Theme fetch failed:",
        themeError?.message,
      );
      return new Response(null, { status: 404, headers: corsHeaders });
    }

    // Success! Return recruiter_slug and sanitized theme
    // SECURITY: Use sanitizeTheme to whitelist fields - never spread raw DB data
    const response: ResolveResponse = {
      recruiter_slug: profile.recruiter_slug,
      theme: sanitizeTheme(theme as Record<string, unknown>),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("[resolve-custom-domain] Unhandled error:", err);
    // Return 404 for any errors (don't leak info)
    return new Response(null, { status: 404, headers: getCorsHeaders(null) });
  }
});
