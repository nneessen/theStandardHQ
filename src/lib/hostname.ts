// src/lib/hostname.ts
// Single source of truth for classifying the current hostname.
//
// The app renders three kinds of hosts:
//   - "primary"            -> the platform app/marketing site (thestandardhq.com, www, localhost, vercel previews)
//   - "platform-subdomain" -> a zero-config branded recruiting page at {slug}.thestandardhq.com
//   - "custom"             -> a user's own white-label domain (e.g. join.theiragency.com)
//
// Both CustomDomainContext and App.tsx consume this so host detection never drifts.

/** The platform's own apex domain. Direct subdomains are zero-config branded recruiting pages. */
export const PLATFORM_APEX = "thestandardhq.com";

/** Hosts that are the platform itself (app/marketing), NOT a recruiter page. */
export const PRIMARY_DOMAINS = [
  PLATFORM_APEX,
  `www.${PLATFORM_APEX}`,
  "localhost",
  "127.0.0.1",
];

/**
 * Subdomain labels under thestandardhq.com reserved for the platform (app chrome / infra).
 * These must NEVER be treated as a recruiter slug — they render as the primary site.
 */
export const RESERVED_SUBDOMAIN_LABELS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "static",
  "assets",
  "cdn",
  "auth",
  "staging",
  "preview",
]);

/** Vercel preview/deploy hosts are treated as primary (the app, not a recruiter page). */
export function isVercelPreview(hostname: string): boolean {
  return hostname.endsWith(".vercel.app") || hostname.endsWith(".vercel.sh");
}

/** True when the host is the platform app/marketing site (not a custom or branded domain). */
export function isPrimaryHost(hostname: string): boolean {
  return PRIMARY_DOMAINS.includes(hostname) || isVercelPreview(hostname);
}

/**
 * For a zero-config branded subdomain `{slug}.thestandardhq.com`, return the slug.
 *
 * Returns null for the apex, www/other reserved labels, deeper nests
 * (a.b.thestandardhq.com), or any host that isn't a direct subdomain of the
 * platform apex. The slug must match the recruiter_slug format enforced in
 * UserProfile (lowercase a-z0-9 + hyphens, 3-50 chars, no leading/trailing hyphen).
 */
export function getPlatformSubdomainSlug(hostname: string): string | null {
  const host = (hostname || "").toLowerCase().trim();
  const suffix = `.${PLATFORM_APEX}`;
  if (!host.endsWith(suffix)) return null;

  const label = host.slice(0, -suffix.length);
  // Must be a single label — {slug}.thestandardhq.com only, not deeper nests.
  if (!label || label.includes(".")) return null;
  if (RESERVED_SUBDOMAIN_LABELS.has(label)) return null;

  // Match recruiter_slug validation: 3-50 chars, a-z0-9 + hyphen, no leading/trailing hyphen.
  if (label.length < 3 || label.length > 50) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) return null;

  return label;
}

export type HostClassification =
  | { kind: "primary" }
  | { kind: "platform-subdomain"; slug: string }
  | { kind: "custom" };

/**
 * Classify a hostname into how the app should render it.
 *
 * - Reserved or malformed subdomains of the platform apex fall back to "primary"
 *   (they render the app/marketing site, never a recruiter page) to avoid leaking
 *   infra hosts into the public funnel.
 */
export function classifyHost(hostname: string): HostClassification {
  const host = (hostname || "").toLowerCase().trim();

  if (!host || isPrimaryHost(host)) return { kind: "primary" };

  const slug = getPlatformSubdomainSlug(host);
  if (slug) return { kind: "platform-subdomain", slug };

  // A subdomain of the platform apex that is reserved/invalid -> render as primary.
  if (host === PLATFORM_APEX || host.endsWith(`.${PLATFORM_APEX}`)) {
    return { kind: "primary" };
  }

  return { kind: "custom" };
}
