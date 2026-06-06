// Hostname validation + DNS instruction helpers for custom domains.
//
// Ownership/verification is handled entirely by Vercel: a single CNAME pointing
// at Vercel proves DNS control and auto-issues SSL. There is no homegrown TXT
// verification (the previous `_thestandardhq-verify` TXT lookup was both
// redundant and broken — Deno.resolveDns appended the edge container's search
// suffix, so it could never resolve).

/**
 * Generate the single CNAME record the user must add for a custom subdomain.
 * @param hostname full subdomain, e.g. "join.example.com"
 * @param cnameTarget the CNAME value to point at (Vercel's real target, or the
 *   generic fallback "cname.vercel-dns.com")
 */
export function getDnsInstructions(
  hostname: string,
  cnameTarget = "cname.vercel-dns.com",
): {
  cname: { name: string; value: string };
} {
  // Extract subdomain prefix (everything before the base domain)
  // e.g., "join.example.com" -> "join"
  const parts = hostname.split(".");
  const subdomainPrefix = parts.slice(0, -2).join(".");

  return {
    cname: {
      name: subdomainPrefix,
      value: cnameTarget,
    },
  };
}

/**
 * Validate hostname format for custom domains
 * Additional validation beyond database CHECK constraint
 */
export function validateHostname(hostname: string): {
  valid: boolean;
  error?: string;
} {
  // Must be provided
  if (!hostname || typeof hostname !== "string") {
    return { valid: false, error: "Hostname is required" };
  }

  // Normalize and check
  const normalized = hostname.toLowerCase().trim();

  // Max 253 characters (DNS limit)
  if (normalized.length > 253) {
    return { valid: false, error: "Hostname exceeds 253 character limit" };
  }

  // Must have at least 2 dots (subdomain requirement)
  const dotCount = (normalized.match(/\./g) || []).length;
  if (dotCount < 2) {
    return {
      valid: false,
      error:
        "Only subdomains are supported (e.g., join.yourdomain.com). Apex domains are not supported.",
    };
  }

  // Reject IP addresses
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(normalized)) {
    return { valid: false, error: "IP addresses are not allowed" };
  }

  // Reject localhost and common dev domains
  const blockedPatterns = [
    "localhost",
    "127.0.0.1",
    "::1",
    ".local",
    ".localhost",
    ".test",
    ".example",
    ".invalid",
  ];
  for (const pattern of blockedPatterns) {
    if (normalized === pattern || normalized.endsWith(pattern)) {
      return { valid: false, error: `Reserved hostname: ${pattern}` };
    }
  }

  // Reject our own domains (prevents resolver loops)
  const reservedDomains = [
    "thestandardhq.com",
    "www.thestandardhq.com",
    ".vercel.app",
    ".vercel.sh",
  ];
  for (const reserved of reservedDomains) {
    if (normalized === reserved || normalized.endsWith(reserved)) {
      return {
        valid: false,
        error: "Cannot use The Standard or Vercel domains",
      };
    }
  }

  // Check each label length (max 63 chars per DNS spec)
  const labels = normalized.split(".");
  for (const label of labels) {
    if (label.length > 63) {
      return {
        valid: false,
        error: "Each part of the hostname must be 63 characters or less",
      };
    }
    if (label.length < 2) {
      return {
        valid: false,
        error: "Each part of the hostname must be at least 2 characters",
      };
    }
    // Check for valid characters (alphanumeric and hyphens, no leading/trailing hyphens)
    if (
      !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(label) &&
      !/^[a-z0-9]{2}$/.test(label)
    ) {
      // Allow 2-char labels without hyphen check
      if (label.length === 2 && /^[a-z0-9]{2}$/.test(label)) {
        continue;
      }
      return {
        valid: false,
        error: `Invalid label "${label}": must be alphanumeric with optional hyphens (not at start/end)`,
      };
    }
  }

  return { valid: true };
}
