// supabase/functions/_shared/webhookUrl.ts
// SSRF guard for user-authored outbound webhook URLs.

/**
 * Validate and return a webhook target URL, rejecting anything that could
 * exfiltrate to / pivot into internal infrastructure (SSRF):
 *  - non-https schemes
 *  - ALL IPv6 literals (covers loopback ::1, IPv4-mapped ::ffff:127.0.0.1,
 *    ULA fc00::/7, link-local fe80::/10) — legitimate webhooks use hostnames/IPv4
 *  - loopback / private / link-local IPv4 literals
 *  - cloud-metadata + localhost hosts (incl. trailing-dot FQDN form)
 *  - this project's own Supabase host (SUPABASE_URL)
 *
 * NOTE: callers must ALSO disable redirect-following (fetch redirect:"manual"),
 * because this only validates the initial host, not a 3xx redirect target.
 * Residual gap: decimal/octal-encoded IPv4 literals and DNS-rebinding are not
 * covered here (would require resolve-time enforcement / egress controls).
 */
export function assertSafeWebhookUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Webhook URL is not a valid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use https");
  }
  // Normalize: strip IPv6 brackets and a single trailing FQDN dot (which DNS
  // resolves identically, e.g. "169.254.169.254." -> "169.254.169.254").
  const host = parsed.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");

  // Block ALL IPv6 literals in one rule — removes the whole IPv6 bypass surface
  // (loopback, IPv4-mapped, ULA, link-local). A real IPv6 literal always
  // contains ":", so plain hostnames like "fdic.gov"/"fcc.gov" are unaffected.
  if (host.includes(":")) {
    throw new Error("Webhook URL may not target an IPv6 literal");
  }

  const blockedHosts = new Set([
    "localhost",
    "0.0.0.0",
    "127.0.0.1",
    "169.254.169.254",
    "metadata.google.internal",
  ]);
  if (blockedHosts.has(host)) {
    throw new Error("Webhook URL targets a blocked host");
  }
  // Private / loopback / link-local IPv4 literals.
  if (
    /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
      host,
    )
  ) {
    throw new Error("Webhook URL targets a private/loopback address");
  }
  // Never let a webhook call back into this project's Supabase host. Resolve the
  // env host in its OWN try (so a bad env value is ignored) and compare OUTSIDE
  // it — otherwise the rejection throw would be swallowed by the parse catch.
  const selfUrl = Deno.env.get("SUPABASE_URL");
  let selfHost: string | null = null;
  if (selfUrl) {
    try {
      selfHost = new URL(selfUrl).hostname.toLowerCase().replace(/\.$/, "");
    } catch {
      selfHost = null;
    }
  }
  if (selfHost && selfHost === host) {
    throw new Error("Webhook URL may not target the Supabase host");
  }
  return parsed;
}
